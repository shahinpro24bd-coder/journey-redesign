(function () {
  "use strict";

  function initComparison(slider) {
    var range = slider.querySelector(".before-after-range");
    if (!range) return;

    function update() {
      slider.style.setProperty("--reveal", range.value + "%");
    }

    range.addEventListener("input", update);
    range.addEventListener("change", update);
    update();
  }

  function init() {
    document.querySelectorAll("[data-before-after]").forEach(initComparison);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
