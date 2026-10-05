/* Local content overrides.
   Edits made in /admin are stored in this browser (localStorage) and applied
   here on every page load, so no server, database or API key is needed. */
(function () {
  "use strict";
  var KEY = "site_local_content_v1";

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function textNodes(el) {
    var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) out.push(n);
    }
    return out;
  }

  function applyTexts(texts) {
    if (!texts) return;
    document.querySelectorAll("[data-ck]").forEach(function (el) {
      var keys = (el.getAttribute("data-ck") || "").split("|").filter(Boolean);
      var nodes = textNodes(el);
      keys.forEach(function (key, i) {
        var node = nodes[i];
        if (!node) return;
        if (typeof texts[key] !== "string") return;
        var raw = node.nodeValue || "";
        node.nodeValue = raw.match(/^\s*/)[0] + texts[key] + raw.match(/\s*$/)[0];
      });
    });
    document.querySelectorAll("[data-ck-attr]").forEach(function (el) {
      (el.getAttribute("data-ck-attr") || "")
        .split(";")
        .filter(Boolean)
        .forEach(function (pair) {
          var at = pair.indexOf(":");
          if (at < 0) return;
          var attr = pair.slice(0, at);
          var key = pair.slice(at + 1);
          if (typeof texts[key] === "string") el.setAttribute(attr, texts[key]);
        });
    });
    var titleEl = document.querySelector("title");
    if (titleEl) document.title = titleEl.textContent || document.title;
  }

  function applyImages(images) {
    if (!images) return;
    document.querySelectorAll("[data-ik]").forEach(function (el) {
      var url = images[el.getAttribute("data-ik")];
      if (url) el.setAttribute("src", url);
    });
    document.querySelectorAll("[data-ik-attr]").forEach(function (el) {
      (el.getAttribute("data-ik-attr") || "")
        .split(";")
        .filter(Boolean)
        .forEach(function (pair) {
          var at = pair.indexOf(":");
          if (at < 0) return;
          var url = images[pair.slice(at + 1)];
          if (url) el.setAttribute(pair.slice(0, at), url);
        });
    });
    document.querySelectorAll("[data-ik-bg]").forEach(function (el) {
      var slots = (el.getAttribute("data-ik-bg") || "").split("|");
      var i = -1;
      el.setAttribute(
        "style",
        (el.getAttribute("style") || "").replace(
          /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
          function (full, quote) {
            i++;
            var url = images[slots[i]];
            return url ? "url(" + quote + url + quote + ")" : full;
          },
        ),
      );
    });
  }

  function apply() {
    var data = read();
    if (!data) return;
    var lang = window.__SITE_LANG__ || "en";
    applyTexts((data.langs && data.langs[lang]) || null);
    applyImages(data.images || null);
  }

  window.__applyLocalContent__ = apply;
  apply();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  }
})();
