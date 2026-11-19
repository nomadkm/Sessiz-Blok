// ISOLATED world: kozmetik filtreleme + YouTube reklam atlatma + durum senkronu
(async () => {
  const { enabled = true, allow = [] } = await chrome.storage.local.get(["enabled", "allow"]);
  // iframe içindeysek istisna, en üstteki sayfanın alan adına göre değerlendirilir
  let topHost = location.hostname;
  try {
    const ao = location.ancestorOrigins;
    if (ao && ao.length) topHost = new URL(ao[ao.length - 1]).hostname;
  } catch (_) {}
  const siteOff = allow.some((h) => topHost === h || topHost.endsWith("." + h));
  const active = enabled && !siteOff;
  document.dispatchEvent(new CustomEvent("sb-state", { detail: active ? "1" : "0" }));
  if (!active) return;

  // Sadece GERÇEK reklam içeriği barındıran elementleri gizle.
  // Boş "bait" div'lere dokunmayız, böylece tuzak kontrolleri tetiklenmez.
  const adBox = [
    ".ad-banner", ".ad-container", ".ad-wrapper", ".adsbygoogle",
    "[id^='google_ads']", "[id^='div-gpt-ad']", "[class*='sponsored']", ".ytp-ad-overlay-container"
  ];
  const style = document.createElement("style");
  style.textContent =
    adBox.map(s => `${s}:has(iframe,img,ins,video)`).join(",") +
    "{display:none !important}" +
    "ytd-ad-slot-renderer,ytd-promoted-sparkles-web-renderer,#masthead-ad,.ytp-ad-overlay-container{display:none !important}";
  (document.head || document.documentElement).appendChild(style);

  // Filtre listelerinden gelen kozmetik kurallar (arka plandan istenir)
  try {
    const res = await chrome.runtime.sendMessage({
      type: "cosmetic", hostname: location.hostname, top: window === top
    });
    const sels = res ? [...res.generic, ...res.specific] : [];
    if (sels.length) {
      // Genel seçiciler sadece içinde gerçek reklam içeriği olan elementleri gizler.
      // Boş "bait" div'ler görünür kalır, anti-adblock tespiti tetiklenmez.
      // Yavaşlık görürsen BAIT_GUARD'ı false yap.
      const BAIT_GUARD = true;
      const KEEP = "iframe,img,ins,video,object,embed,canvas,svg,a[href]";
      const sheet = new CSSStyleSheet();
      const add = (s, guard) => {
        const sel = guard && !/^a[\[.#:]|href/.test(s) ? `:is(${s}):has(${KEEP})` : s;
        try { sheet.insertRule(`${sel}{display:none !important}`); } catch (_) {}
      };
      res.generic.forEach(s => add(s, BAIT_GUARD));
      res.specific.forEach(s => add(s, false));
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
  } catch (_) {}

  // YouTube video reklamı: atla / hızlandır
  if (location.hostname.endsWith("youtube.com")) {
    setInterval(() => {
      const player = document.querySelector(".html5-video-player");
      const video = document.querySelector("video.html5-main-video");
      if (!player || !video) return;
      if (player.classList.contains("ad-showing")) {
        video.muted = true;
        video.playbackRate = 16;
        if (isFinite(video.duration)) video.currentTime = video.duration;
        const skip = document.querySelector(
          ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
        if (skip) skip.click();
      }
    }, 300);
  }
})();
