/* Editor overlay. Loaded only when the page is opened from the admin panel.
   It never rewrites the page structure: it highlights what is editable and
   edits text nodes / image sources in place, so the design stays identical. */
(function () {
  "use strict";
  if (!window.__SITE_EDIT__) return;

  var style = document.createElement("style");
  style.textContent =
    ".cms-inline-text{display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone;border:1px dashed rgba(37,99,235,.55);border-radius:3px;padding:1px 3px;margin:-2px 0;cursor:text;transition:background-color .15s,border-color .15s,box-shadow .15s}" +
    ".cms-inline-text:hover{background:rgba(219,234,254,.72);border-color:#2563eb}" +
    ".cms-inline-text:focus{outline:0;background:#fff!important;color:#0f172a!important;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.2)}" +
    "[data-ck-attr]:hover{outline:2px dashed #2563eb!important;outline-offset:2px;cursor:text}" +
    "[data-ik]:hover,[data-ik-bg]:hover{outline:3px solid #16a34a!important;outline-offset:2px;cursor:pointer}" +
    ".cms-inline-text:empty:before{content:'Metin';color:#64748b}";
  document.head.appendChild(style);

  function send(message) {
    window.parent.postMessage(Object.assign({ source: "cms-editor" }, message), "*");
  }

  function makeTextEditable(el) {
    var keys = (el.getAttribute("data-ck") || "").split("|").filter(Boolean);
    var nodes = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) nodes.push(n);
    }
    keys.forEach(function (key, i) {
      if (!nodes[i]) return;
      var node = nodes[i];
      var raw = node.nodeValue || "";
      var leading = (raw.match(/^\s*/) || [""])[0];
      var trailing = (raw.match(/\s*$/) || [""])[0];
      var span = document.createElement("span");
      span.className = "cms-inline-text";
      span.setAttribute("contenteditable", "plaintext-only");
      span.setAttribute("role", "textbox");
      span.setAttribute("aria-label", "Metni düzenle");
      span.setAttribute("data-cms-key", key);
      span.spellcheck = true;
      span.textContent = raw.trim();
      var fragment = document.createDocumentFragment();
      if (leading) fragment.appendChild(document.createTextNode(leading));
      fragment.appendChild(span);
      if (trailing) fragment.appendChild(document.createTextNode(trailing));
      node.parentNode.replaceChild(fragment, node);
      span.addEventListener("input", function () {
        send({ type: "text", key: key, value: span.textContent || "" });
      });
      span.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          span.blur();
        }
      });
    });
  }

  document.querySelectorAll("[data-ck]").forEach(makeTextEditable);

  var picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.style.display = "none";
  document.body.appendChild(picker);
  var pendingSlot = null;

  picker.addEventListener("change", function () {
    var file = picker.files && picker.files[0];
    picker.value = "";
    if (!file || !pendingSlot) return;
    send({ type: "image", slot: pendingSlot, file: file });
  });

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "cms-admin") return;
    if (data.type === "image-saved") {
      document
        .querySelectorAll('[data-ik="' + data.slot + '"]')
        .forEach(function (img) {
          img.setAttribute("src", data.url);
        });
      document.querySelectorAll("[data-ik-bg]").forEach(function (el) {
        var slots = (el.getAttribute("data-ik-bg") || "").split("|");
        if (slots.indexOf(data.slot) < 0) return;
        var i = slots.indexOf(data.slot);
        var seen = -1;
        el.setAttribute(
          "style",
          (el.getAttribute("style") || "").replace(
            /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
            function (full, quote, url) {
              seen++;
              return seen === i ? "url(" + quote + data.url + quote + ")" : full;
            },
          ),
        );
      });
    }
  });

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var image = target.closest("[data-ik],[data-ik-bg]");
      var text = target.closest(".cms-inline-text");

      if (image && (image.hasAttribute("data-ik") || !text || image.contains(text))) {
        event.preventDefault();
        event.stopPropagation();
        pendingSlot = image.hasAttribute("data-ik")
          ? image.getAttribute("data-ik")
          : (image.getAttribute("data-ik-bg") || "").split("|")[0];
        picker.click();
        return;
      }
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        text.focus();
      }
    },
    true,
  );

  /* Links and buttons must not navigate away while editing. */
  document.addEventListener(
    "submit",
    function (e) {
      e.preventDefault();
    },
    true,
  );

  function collectImages() {
    var seen = {};
    var list = [];
    document.querySelectorAll("[data-ik]").forEach(function (img) {
      var slot = img.getAttribute("data-ik");
      if (!slot || seen[slot]) return;
      seen[slot] = 1;
      list.push({ slot: slot, url: img.currentSrc || img.getAttribute("src") || "" });
    });
    document.querySelectorAll("[data-ik-bg]").forEach(function (el) {
      var slots = (el.getAttribute("data-ik-bg") || "").split("|");
      var urls = [];
      (el.getAttribute("style") || "").replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, function (f, q, u) {
        urls.push(u);
        return f;
      });
      slots.forEach(function (slot, i) {
        if (!slot || seen[slot]) return;
        seen[slot] = 1;
        list.push({ slot: slot, url: urls[i] || "" });
      });
    });
    return list;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "cms-admin") return;
    if (data.type === "image-saved") send({ type: "images", images: collectImages() });
    if (data.type === "scroll-to") {
      var el = document.querySelector('[data-ik="' + data.slot + '"]');
      if (!el) {
        document.querySelectorAll("[data-ik-bg]").forEach(function (b) {
          if (!el && (b.getAttribute("data-ik-bg") || "").split("|").indexOf(data.slot) >= 0) el = b;
        });
      }
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  send({ type: "ready" });
  send({ type: "images", images: collectImages() });
})();
