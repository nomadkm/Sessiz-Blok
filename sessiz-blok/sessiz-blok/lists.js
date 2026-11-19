// Filtre listelerini indirir ve Chrome'un dinamik kurallarına çevirir.
const LISTS = {
  easylist: "https://easylist.to/easylist/easylist.txt",
  easyprivacy: "https://easylist.to/easylist/easyprivacy.txt",
  ublock: "https://ublockorigin.github.io/uAssets/filters/filters.txt",
  peterlowe: "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext"
};
const MAX_DYNAMIC = 25000; // Chrome dinamik kural sınırı 30.000, kalanı istisnalara bırakılır
const FIRST_ID = 10000;
const TYPES = {
  script: "script", image: "image", stylesheet: "stylesheet", object: "object",
  xmlhttprequest: "xmlhttprequest", subdocument: "sub_frame", ping: "ping", media: "media",
  font: "font", websocket: "websocket", other: "other", document: "main_frame"
};
const ALIAS = { xhr: "xmlhttprequest", frame: "subdocument", css: "stylesheet" };
const BAD_COSMETIC = /:(-abp-|has-text|xpath|matches-|upward|remove|style|-ext-|contains|nth-ancestor|min-text|watch-attr|others|shadow|matches-path)/;
const COSMETIC = /^([^#$ ]*)##(.+)$/;
const ASCII = /^[\x00-\x7f]*$/;

export function parseNetwork(line) {
  const exception = line.startsWith("@@");
  if (exception) line = line.slice(2);
  const i = line.lastIndexOf("$");
  const pat = i >= 0 ? line.slice(0, i) : line;
  const opts = i >= 0 ? line.slice(i + 1) : "";
  if (!pat || pat === "*" || pat === "|" || pat === "||" || !ASCII.test(pat) ||
      pat.startsWith("||*") || (pat.length > 1 && pat.startsWith("/") && pat.endsWith("/"))) return null;

  const cond = { urlFilter: pat };
  const types = [], ntypes = [], domIn = [], domEx = [];
  let important = false;
  for (const o of opts.toLowerCase().split(",").filter(Boolean)) {
    const neg = o.startsWith("~");
    let k = o.replace(/^~+/, "");
    k = ALIAS[k] || k;
    if (TYPES[k]) (neg ? ntypes : types).push(TYPES[k]);
    else if (k === "third-party" || k === "3p") cond.domainType = neg ? "firstParty" : "thirdParty";
    else if (k === "first-party" || k === "1p") cond.domainType = neg ? "thirdParty" : "firstParty";
    else if (k.startsWith("domain=")) {
      for (const d of k.slice(7).split("|")) {
        if (!ASCII.test(d) || d.includes("*")) return null;
        (d.startsWith("~") ? domEx : domIn).push(d.replace(/^~+/, ""));
      }
    } else if (k === "popup") {
      if (!pat.startsWith("||")) return null; // sadece alan adı bazlı popup kuralları
      types.push("main_frame");
    } else if (k === "important") important = true;
    else if (k === "match-case") cond.isUrlFilterCaseSensitive = true;
    else return null; // desteklenmeyen seçenek (csp, redirect, removeparam...)
  }
  if (types.length) cond.resourceTypes = [...new Set(types)].sort();
  else if (ntypes.length) cond.excludedResourceTypes = [...new Set(ntypes)].sort();
  if (domIn.length) cond.initiatorDomains = domIn;
  if (domEx.length) cond.excludedInitiatorDomains = domEx;
  return {
    exception,
    rule: { priority: exception ? 2 : important ? 3 : 1,
            action: { type: exception ? "allow" : "block" }, condition: cond }
  };
}

export function parseCosmetic(line, generic, domains) {
  const m = COSMETIC.exec(line);
  if (!m) return;
  const prefix = m[1], sel = m[2].trim();
  if (!sel || sel.startsWith("+js") || sel.startsWith("^") || BAD_COSMETIC.test(sel) ||
      sel.includes("{") || sel.includes("}") || !ASCII.test(sel)) return;
  if (!prefix) { generic.add(sel); return; }
  for (const d of prefix.toLowerCase().split(",")) {
    if (d && !d.startsWith("~") && !d.includes("*") && ASCII.test(d)) {
      if (!domains.has(d)) domains.set(d, new Set());
      domains.get(d).add(sel);
    }
  }
}

// Saf fonksiyon: liste metinlerinden kural + kozmetik veri üretir (test edilebilir)
export function convert(texts, maxRules = MAX_DYNAMIC) {
  const blocks = [], allows = [], seen = new Set();
  const generic = new Set(), domains = new Map();
  for (const text of texts) {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line[0] === "!" || line[0] === "[") continue;
      if (line.includes("##")) { parseCosmetic(line, generic, domains); continue; }
      if (/#[@?$%]#/.test(line)) continue;
      const r = parseNetwork(line);
      if (!r) continue;
      const key = JSON.stringify(r.rule);
      if (seen.has(key)) continue;
      seen.add(key);
      (r.exception ? allows : blocks).push(r.rule);
    }
  }
  const value = (r) => {
    const c = r.condition;
    const simple = Object.keys(c).length === 1 ||
      (c.resourceTypes && c.resourceTypes.length === 1 && c.resourceTypes[0] === "main_frame");
    return c.urlFilter.startsWith("||") && simple ? 0 : 1;
  };
  blocks.sort((a, b) => value(a) - value(b));
  const nAllow = Math.min(allows.length, Math.floor(maxRules / 10));
  const rules = blocks.slice(0, maxRules - nAllow).concat(allows.slice(0, nAllow))
    .map((r, i) => ({ id: FIRST_ID + i, ...r }));
  const dom = {};
  for (const [d, s] of domains) dom[d] = [...s];
  return { rules, generic: [...generic], domains: dom, counts: { blocks: blocks.length, allows: allows.length } };
}

export async function updateLists() {
  const texts = [];
  for (const url of Object.values(LISTS)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) texts.push(await res.text());
    } catch (_) {}
  }
  if (!texts.length) throw new Error("listeler indirilemedi");
  const { rules, generic, domains } = convert(texts);

  const dnr = chrome.declarativeNetRequest;
  const old = await dnr.getDynamicRules();
  await dnr.updateDynamicRules({ removeRuleIds: old.filter((r) => r.id >= FIRST_ID).map((r) => r.id) });

  // Dinamik kurallarda tek bir geçersiz kural tüm ekleme işlemini düşürür:
  // başarısız parçayı ikiye bölerek geçersiz kuralları ayıkla.
  let added = 0;
  const addChunk = async (chunk) => {
    try {
      await dnr.updateDynamicRules({ addRules: chunk });
      added += chunk.length;
    } catch (e) {
      if (/quota|limit|exceed/i.test(String(e.message))) throw e;
      if (chunk.length > 1) {
        const mid = chunk.length >> 1;
        await addChunk(chunk.slice(0, mid));
        await addChunk(chunk.slice(mid));
      }
    }
  };
  for (let i = 0; i < rules.length; i += 2000) await addChunk(rules.slice(i, i + 2000));

  await chrome.storage.local.set({ cosmeticData: { generic, domains } });
  return added;
}
