// MAIN world: sayfanın kendi JS ortamında, document_start'ta çalışır.
(() => {
  let enabled = true;
  document.addEventListener("sb-state", (e) => { enabled = e.detail === "1"; });

  // Son "yeni sekme açma" anı (tab-under tespiti için)
  let lastOpen = 0;
  const markOpen = () => { lastOpen = Date.now(); };

  // 1) Kullanıcı etkileşimi olmadan açılan popup/popunder'ları engelle
  const realOpen = window.open;
  window.open = function (...args) {
    const userInitiated = navigator.userActivation && navigator.userActivation.isActive;
    if (enabled && !userInitiated) return null;
    markOpen();
    return realOpen.apply(this, args);
  };

  // Kod ile tetiklenen <a target=_blank>.click() de yeni sekme açar
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (...a) {
    if ((this.target || "").toLowerCase() === "_blank") markOpen();
    return realClick.apply(this, a);
  };

  // 2) Görünmez tam sayfa tıklama tuzaklarını (click hijack) engelle
  document.addEventListener("click", (e) => {
    if (!enabled) return;
    const a = e.target.closest && e.target.closest("a[target=_blank]");
    if (!a || !e.isTrusted) return;
    markOpen();
    const r = a.getBoundingClientRect();
    const covers = r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9;
    const invisible = parseFloat(getComputedStyle(a).opacity) < 0.05;
    if (covers || invisible) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // 3) Tab-under: yeni sekme açıldıktan hemen sonra ESKİ sayfanın başka bir siteye
  //    yönlendirilmesini (video yeni sekmede, eski sekme reklama döner) iptal et.
  if (window.navigation) {
    navigation.addEventListener("navigate", (e) => {
      if (!enabled || e.userInitiated || e.hashChange || e.downloadRequest !== null) return;
      if (e.navigationType === "traverse" || e.navigationType === "reload") return;
      if (Date.now() - lastOpen > 3000) return;
      let dest;
      try { dest = new URL(e.destination.url); } catch (_) { return; }
      if (dest.origin === location.origin) return;
      if (e.cancelable) e.preventDefault();
    });
  }

  // 4) Anti-adblock tespitlerini yanıltmak için reklam kütüphanesi taklitleri
  try {
    if (!window.adsbygoogle) {
      const fake = []; fake.loaded = true; fake.push = () => 0;
      window.adsbygoogle = fake;
    }
  } catch (_) {}

  // 5) YouTube: oynatıcı verisinden reklam yerleşimlerini temizle
  if (location.hostname.endsWith("youtube.com")) {
    const strip = (o) => {
      if (enabled && o && typeof o === "object") {
        delete o.adPlacements; delete o.adSlots; delete o.playerAds;
      }
      return o;
    };
    let val;
    Object.defineProperty(window, "ytInitialPlayerResponse", {
      configurable: true,
      get: () => val,
      set: (v) => { val = strip(v); }
    });
    const origParse = JSON.parse;
    JSON.parse = function (...a) { return strip(origParse.apply(this, a)); };
  }
})();
