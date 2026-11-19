import { updateLists } from "./lists.js";
import { syncAllowRules } from "./common.js";

// Kozmetik veri: güncellenmiş liste varsa o, yoksa pakete gömülü cosmetic.json.
// Dosya sayfalara açılmaz, böylece siteler eklentiyi dosya yoklayarak tespit edemez.
let dataPromise;
function load() {
  dataPromise ||= chrome.storage.local.get("cosmeticData").then(async ({ cosmeticData }) => {
    if (cosmeticData) return cosmeticData;
    try { return await (await fetch(chrome.runtime.getURL("cosmetic.json"))).json(); }
    catch (_) { return { generic: [], domains: {} }; }
  });
  return dataPromise;
}

let updating = false;
async function runUpdate() {
  if (updating) return;
  updating = true;
  await chrome.storage.local.set({ updateStatus: { state: "running" } });
  try {
    const count = await updateLists();
    dataPromise = null;
    await chrome.storage.local.set({ updateStatus: { state: "ok", time: Date.now(), count } });
  } catch (e) {
    await chrome.storage.local.set({ updateStatus: { state: "error", message: String(e.message || e) } });
  } finally {
    updating = false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type === "update") { runUpdate(); return; }
  if (msg?.type !== "cosmetic") return;
  load().then((d) => {
    const specific = [];
    const parts = String(msg.hostname).split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const sel = d.domains[parts.slice(i).join(".")];
      if (sel) specific.push(...sel);
    }
    send({ generic: msg.top ? d.generic : [], specific });
  });
  return true;
});

// Haftalık otomatik güncelleme
chrome.runtime.onInstalled.addListener(async () => {
  await syncAllowRules();
  const { updateStatus } = await chrome.storage.local.get("updateStatus");
  chrome.alarms.create("update-lists", {
    periodInMinutes: 7 * 24 * 60,
    ...(updateStatus?.state === "ok" ? {} : { delayedInMinutes: 1 })
  });
});
chrome.runtime.onStartup.addListener(() => syncAllowRules());
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "update-lists") runUpdate(); });
