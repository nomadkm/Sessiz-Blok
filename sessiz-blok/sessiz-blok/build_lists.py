#!/usr/bin/env python3
"""Filtre listelerini (EasyList vb.) Chrome kurallarına çevirir.

Kullanım:  python3 build_lists.py [--max-rules 90000] [--only-local]
Çıktı:     list_1.json, list_2.json, ...  (ağ kuralları, manifest.json otomatik güncellenir)
           cosmetic.json                  (kozmetik gizleme seçicileri)
İnternet yoksa lists/ klasörüne .txt dosyalarını elle koyup --only-local kullan.
"""
import argparse, json, os, re, urllib.request

LISTS = {
    "easylist": "https://easylist.to/easylist/easylist.txt",
    "easyprivacy": "https://easylist.to/easylist/easyprivacy.txt",
    "ublock-filters": "https://ublockorigin.github.io/uAssets/filters/filters.txt",
    "peter-lowe": "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext",
}
TYPES = {"script": "script", "image": "image", "stylesheet": "stylesheet", "object": "object",
         "xmlhttprequest": "xmlhttprequest", "subdocument": "sub_frame", "ping": "ping",
         "media": "media", "font": "font", "websocket": "websocket", "other": "other",
         "document": "main_frame"}
ALIAS = {"xhr": "xmlhttprequest", "frame": "subdocument", "css": "stylesheet"}
BAD_COSMETIC = re.compile(r":(-abp-|has-text|xpath|matches-|upward|remove|style|-ext-|contains|"
                          r"nth-ancestor|min-text|watch-attr|others|shadow|matches-path)")
COSMETIC = re.compile(r"^([^#$ ]*)##(.+)$")


def parse_network(line):
    exception = line.startswith("@@")
    if exception:
        line = line[2:]
    pat, opts = (line.rpartition("$")[0], line.rpartition("$")[2]) if "$" in line else (line, "")
    if (not pat or pat in ("*", "|", "||") or not pat.isascii() or pat.startswith("||*")
            or (len(pat) > 1 and pat.startswith("/") and pat.endswith("/"))):
        return None
    cond, types, ntypes, dom_in, dom_ex = {"urlFilter": pat}, [], [], [], []
    important = False
    for o in filter(None, opts.lower().split(",")):
        neg, k = o.startswith("~"), o.lstrip("~")
        k = ALIAS.get(k, k)
        if k in TYPES:
            (ntypes if neg else types).append(TYPES[k])
        elif k in ("third-party", "3p"):
            cond["domainType"] = "firstParty" if neg else "thirdParty"
        elif k in ("first-party", "1p"):
            cond["domainType"] = "thirdParty" if neg else "firstParty"
        elif k.startswith("domain="):
            for d in k[7:].split("|"):
                if not d.isascii() or "*" in d:
                    return None
                (dom_ex if d.startswith("~") else dom_in).append(d.lstrip("~"))
        elif k == "popup":
            if not pat.startswith("||"):
                return None  # sadece alan adı bazlı popup kuralları
            types.append("main_frame")
        elif k == "important":
            important = True
        elif k == "match-case":
            cond["isUrlFilterCaseSensitive"] = True
        else:
            return None  # desteklenmeyen seçenek (csp, redirect, removeparam...)
    if types:
        cond["resourceTypes"] = sorted(set(types))
    elif ntypes:
        cond["excludedResourceTypes"] = sorted(set(ntypes))
    if dom_in:
        cond["initiatorDomains"] = dom_in
    if dom_ex:
        cond["excludedInitiatorDomains"] = dom_ex
    prio = 2 if exception else (3 if important else 1)
    return exception, {"priority": prio, "action": {"type": "allow" if exception else "block"},
                       "condition": cond}


def parse_cosmetic(line, generic, domains):
    m = COSMETIC.match(line)
    if not m:
        return
    prefix, sel = m.group(1), m.group(2).strip()
    if (not sel or sel.startswith(("+js", "^")) or BAD_COSMETIC.search(sel)
            or "{" in sel or "}" in sel or not sel.isascii()):
        return
    if not prefix:
        generic.add(sel)
        return
    for d in prefix.lower().split(","):
        if d and not d.startswith("~") and "*" not in d and d.isascii():
            domains.setdefault(d, set()).add(sel)


def fetch(name, url, only_local):
    os.makedirs("lists", exist_ok=True)
    path = f"lists/{name}.txt"
    if not only_local:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "sessiz-blok-build"})
            open(path, "wb").write(urllib.request.urlopen(req, timeout=60).read())
            print(f"indirildi: {name}")
        except Exception as e:
            print(f"UYARI: {name} indirilemedi ({e})")
    return path if os.path.exists(path) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-rules", type=int, default=90000)
    ap.add_argument("--only-local", action="store_true")
    a = ap.parse_args()

    blocks, allows, seen = [], [], set()
    generic, domains = set(), {}
    for name, url in LISTS.items():
        path = fetch(name, url, a.only_local)
        if not path:
            continue
        for raw in open(path, encoding="utf-8", errors="ignore"):
            line = raw.strip()
            if not line or line[0] in "![":
                continue
            if "##" in line:
                parse_cosmetic(line, generic, domains)
                continue
            if "#@#" in line or "#?#" in line or "#$#" in line or "#%#" in line:
                continue
            r = parse_network(line)
            if not r:
                continue
            exc, rule = r
            key = json.dumps(rule, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            (allows if exc else blocks).append(rule)

    # Seçeneksiz ||alan-adı^ kuralları en değerlisi: önce onları al
    def value(r):
        c = r["condition"]
        simple = len(c) == 1 or c.get("resourceTypes") == ["main_frame"]
        return 0 if c["urlFilter"].startswith("||") and simple else 1
    blocks.sort(key=value)
    n_allow = min(len(allows), a.max_rules // 10)
    rules = blocks[: a.max_rules - n_allow] + allows[:n_allow]
    print(f"ağ kuralı: {len(rules)} (engel {len(blocks)}, istisna {len(allows)})")

    # 30.000'lik parçalara böl, manifest'i güncelle
    manifest = json.load(open("manifest.json"))
    resources = [r for r in manifest["declarative_net_request"]["rule_resources"] if r["id"] == "ads"]
    for f in os.listdir("."):
        if re.fullmatch(r"list_\d+\.json", f):
            os.remove(f)
    for i in range(0, len(rules), 30000):
        n = i // 30000 + 1
        chunk = [{"id": j, **r} for j, r in enumerate(rules[i:i + 30000], 1)]
        json.dump(chunk, open(f"list_{n}.json", "w"), separators=(",", ":"))
        resources.append({"id": f"list_{n}", "enabled": True, "path": f"list_{n}.json"})
    manifest["declarative_net_request"]["rule_resources"] = resources
    json.dump(manifest, open("manifest.json", "w"), indent=2, ensure_ascii=False)

    json.dump({"generic": sorted(generic), "domains": {d: sorted(s) for d, s in domains.items()}},
              open("cosmetic.json", "w"), separators=(",", ":"))
    print(f"kozmetik: {len(generic)} genel, {len(domains)} siteye özel alan adı")


if __name__ == "__main__":
    main()
