import { getState, syncAllowRules } from "./common.js";

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("tr-TR");
let host = null, tabId = null, allow = [], enabled = true;

const setSwitch = (el, on) => el.setAttribute("aria-checked", String(on));

function renderSite() {
  const btn = $("site");
  if (!host) {
    $("host").textContent = "Bu sayfada kullanılamaz";
    btn.disabled = true;
    setSwitch(btn, false);
    return;
  }
  $("host").textContent = host;
  btn.disabled = !enabled;
  setSwitch(btn, enabled && !allow.includes(host));
}

function renderStatus(st) {
  const el = $("status");
  $("update").disabled = st?.state === "running";
  if (!st) el.textContent = "Henüz güncellenmedi. Şimdilik eklentiyle gelen listeler kullanılıyor.";
  else if (st.state === "running") el.textContent = "Listeler indiriliyor…";
  else if (st.state === "ok") {
    const day = new Date(st.time).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    el.textContent = `Son güncelleme ${day}. ${fmt.format(st.count)} ek kural yüklendi.`;
  } else el.textContent = `Güncelleme başarısız: ${st.message}`;
}

async function init() {
  ({ enabled, allow } = await getState());
  setSwitch($("global"), enabled);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  try {
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol) && !u.hostname.startsWith("[")) host = u.hostname.replace(/^www\./, "");
  } catch (_) {}
  renderSite();
  const { updateStatus } = await chrome.storage.local.get("updateStatus");
  renderStatus(updateStatus);
}

$("global").addEventListener("click", async () => {
  enabled = !enabled;
  await chrome.storage.local.set({ enabled });
  await syncAllowRules();
  setSwitch($("global"), enabled);
  renderSite();
  $("reload").hidden = false;
});

$("site").addEventListener("click", async () => {
  if (!host) return;
  allow = allow.includes(host) ? allow.filter((h) => h !== host) : [...allow, host];
  await chrome.storage.local.set({ allow });
  await syncAllowRules();
  renderSite();
  $("reload").hidden = false;
});

$("reload").addEventListener("click", () => {
  if (tabId !== null) chrome.tabs.reload(tabId);
  window.close();
});

$("update").addEventListener("click", () => chrome.runtime.sendMessage({ type: "update" }));
chrome.storage.onChanged.addListener((c) => { if (c.updateStatus) renderStatus(c.updateStatus.newValue); });

init();
