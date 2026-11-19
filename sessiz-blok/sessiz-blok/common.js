// Kimlik aralıkları: 1-899 site istisnaları, 999 genel kapatma, 10000+ otomatik liste kuralları
export const ID_GLOBAL_OFF = 999;

export async function getState() {
  const { enabled = true, allow = [] } = await chrome.storage.local.get(["enabled", "allow"]);
  return { enabled, allow };
}

// Kayıtlı duruma göre istisna kurallarını yeniden kurar.
// "allowAllRequests" kuralı, eşleşen sayfanın tüm isteklerini engelleme dışı bırakır.
export async function syncAllowRules() {
  const { enabled, allow } = await getState();
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = old.filter((r) => r.id < 1000).map((r) => r.id);
  const addRules = allow.slice(0, 900).map((host, i) => ({
    id: i + 1,
    priority: 10,
    action: { type: "allowAllRequests" },
    condition: { urlFilter: `||${host}^`, resourceTypes: ["main_frame", "sub_frame"] }
  }));
  if (!enabled) {
    addRules.push({
      id: ID_GLOBAL_OFF,
      priority: 20,
      action: { type: "allowAllRequests" },
      condition: { urlFilter: "|http", resourceTypes: ["main_frame", "sub_frame"] }
    });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  await chrome.action.setBadgeBackgroundColor({ color: "#5b6b70" });
  await chrome.action.setBadgeText({ text: enabled ? "" : "off" });
}
