(function () {
  var g = (window.googletag = window.googletag || {});
  var chain = new Proxy(function () {}, {
    get: function (_, k) { return k === "then" ? undefined : chain; },
    apply: function () { return chain; }
  });
  var queued = Array.isArray(g.cmd) ? g.cmd.slice() : [];
  g.apiReady = true; g.pubadsReady = true;
  g.pubads = g.defineSlot = g.defineOutOfPageSlot = g.sizeMapping = function () { return chain; };
  g.enableServices = g.display = g.destroySlots = function () {};
  g.cmd = { push: function (f) { try { f(); } catch (e) {} return 1; } };
  queued.forEach(function (f) { try { f(); } catch (e) {} });
})();
