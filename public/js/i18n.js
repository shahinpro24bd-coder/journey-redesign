/* Language switcher: modern dropdown.
   English and Arabic — every language is rendered by the
   server (?lang=xx), so choosing one simply navigates to that URL. The design
   of the rest of the page is untouched. */
(function () {
  "use strict";
  /* Read the language at init time — this bundle may load before the
     bootstrap script that publishes window.__SITE_LANG__. */
  function currentLang() {
    return window.__SITE_LANG__ || "en";
  }
  function currentLangs() {
    return (window.__SITE_LANGS__ || ["en", "ar"]).slice();
  }

  var FLAGS = {
    en: '<img src="/img/flag-english.png" alt="" aria-hidden="true">',
    ar: '<img src="/img/flag-jordan.png" alt="" aria-hidden="true">'
  };

  var NAMES = { en: "English", ar: "Jordan" };

  function flag(code) {
    return FLAGS[code] || "";
  }

  function navigateTo(lang) {
    if (window.__SITE_EDIT__) {
      try {
        window.parent.postMessage({ source: "cms-editor", type: "lang-changed", lang: lang }, "*");
      } catch (e) {}
    }
    var url = new URL(window.location.href);
    if (lang === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    try {
      window.localStorage.setItem("site_lang", lang);
      document.cookie = "site_lang=" + lang + ";path=/;max-age=31536000;SameSite=Lax";
    } catch (e) {}
    window.location.assign(url.toString());
  }

  function languageUrl(lang) {
    var url = new URL(window.location.href);
    if (lang === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    return url.pathname + url.search + url.hash;
  }

  function preserveLanguageOnClick(event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.closest(".lang-dropdown")) return;
    var raw = link.getAttribute("href") || "";
    if (!raw || raw[0] === "#" || /^(?:mailto:|tel:|https?:\/\/)/i.test(raw)) return;
    try {
      var url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin) return;
      var lang = currentLang();
      if (lang === "en") url.searchParams.delete("lang");
      else url.searchParams.set("lang", lang);
      link.href = url.pathname + url.search + url.hash;
    } catch (e) {}
  }

  function closeAll(except) {
    document.querySelectorAll(".lang-dropdown.open").forEach(function (d) {
      if (d === except) return;
      d.classList.remove("open");
      var t = d.querySelector(".lang-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  function build(container) {
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "lang-dropdown";

    var LANGS = currentLangs();
    var current = currentLang();
    if (LANGS.indexOf(current) < 0) current = LANGS[0] || "en";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "lang-toggle";
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", current === "ar" ? "اختر اللغة" : "Select language");
    toggle.innerHTML =
      '<span class="lang-flag">' + flag(current) + "</span>" +
      '<span class="lang-name">' + (NAMES[current] || current) + "</span>" +
      '<span class="lang-chevron" aria-hidden="true">' +
      '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</span>";

    var menu = document.createElement("ul");
    menu.className = "lang-menu";
    LANGS.forEach(function (code) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = languageUrl(code);
      link.setAttribute("data-lang", code);
      link.setAttribute("lang", code);
      if (code === current) link.classList.add("active");
      link.innerHTML =
        '<span class="lang-flag">' + flag(code) + "</span>" +
        '<span class="lang-name">' + (NAMES[code] || code) + "</span>" +
        (code === current ? '<span class="lang-check" aria-hidden="true">✓</span>' : "");
      item.appendChild(link);
      menu.appendChild(item);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(menu);
    container.appendChild(wrap);
  }

  function init() {
    document.querySelectorAll(".navbar-languages").forEach(build);
    document.addEventListener("click", preserveLanguageOnClick, true);

    document.addEventListener("click", function (event) {
      var dropdown = event.target.closest ? event.target.closest(".lang-dropdown") : null;
      if (dropdown) {
        var toggle = event.target.closest(".lang-toggle");
        if (toggle) {
          var open = dropdown.classList.toggle("open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
          if (open) closeAll(dropdown);
          return;
        }
        var item = event.target.closest("[data-lang]");
        if (item) {
          event.preventDefault();
          closeAll();
          navigateTo(item.getAttribute("data-lang"));
          return;
        }
        return;
      }
      closeAll();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
