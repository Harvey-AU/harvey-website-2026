/**
 * Impact chapter
 *
 * The impact statement and its stats, in a normal-height section. The
 * statement is simply shown. When the stats come into view they fade in
 * where they sit (no slide), then play once on the clock (about 2s): each
 * grid of small smiles lights up and its number counts up. Scrolling back
 * up or down afterwards changes nothing, and nothing is pinned.
 *
 * The layout and colours live in Webflow: style the section as it should
 * look at the end (stats in a row, grids full). The script fills each grid
 * with its smiles and plays the stats. Put data-bg-melt="#ffb200" on the
 * section (see bg-melt.js) so the page background melts to yellow as it
 * scrolls in; set text dark (#151514) in Webflow for contrast on yellow.
 *
 * Needs GSAP with ScrollTrigger, e.g. from Webflow's GSAP integration.
 * Without GSAP, or with reduced motion, grids are full and numbers final.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/impact-chapter.js" defer></script>
 *
 * Markup (attribute prefix data-impact-chapter):
 *   [data-impact-chapter]              Section component.
 *     [-stat]                          One stat, in order. Fades in.
 *       [-number]                      The stat's number. Counts up to
 *                                      -count, written with -prefix,
 *                                      -suffix and -decimals.
 *       [-grid]                        Filled with -units smiles that light
 *                                      up as the number counts. Set its
 *                                      columns in Webflow (a CSS grid).
 *                                      Any smiles already inside, shown
 *                                      without JavaScript, are replaced.
 *   [-smile]                           Anywhere: one smile icon, e.g. the
 *                                      key beside each stat. Give it a width.
 *
 * Settings on [-number]:
 *   -count="9027"                      Final value.
 *   -prefix="$"  -suffix="m"           Text either side of the value.
 *   -decimals="1"                      Decimal places (default 0). Whole
 *                                      numbers get thousands separators.
 * Settings on [-grid]:
 *   -units="150"                       Number of smiles in the grid.
 *
 * Smiles are dark (#151514); set --impact-chapter-smile on any ancestor to
 * change it. Unlit grid smiles are a faint tint of the same dark.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  // Harvey U smile, used as a mask so the colour comes from the background
  const SMILE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='521.6 196.6 27 17.2'%3E%3Cpath d='M535.094 213.401C527.874 213.401 522 207.504 522 200.255C522 198.457 523.451 197 525.242 197C527.032 197 528.483 198.457 528.483 200.255C528.483 203.915 531.449 206.892 535.094 206.892C538.74 206.892 541.706 203.915 541.706 200.255C541.706 198.457 543.157 197 544.948 197C546.739 197 548.189 198.457 548.189 200.255C548.189 207.504 542.315 213.401 535.094 213.401Z'/%3E%3C/svg%3E")`;

  const CSS = `
[data-impact-chapter-unit],[data-impact-chapter-smile]{display:block;aspect-ratio:27/17.2;background:var(--impact-chapter-smile,#151514);-webkit-mask:${SMILE_MASK} center/contain no-repeat;mask:${SMILE_MASK} center/contain no-repeat}
.is-impact-chapter-armed [data-impact-chapter-unit]{background:rgba(21,21,20,.16);transform:scale(.7);transition:background-color .35s,transform .6s cubic-bezier(.2,.7,.1,1)}
.is-impact-chapter-armed [data-impact-chapter-unit].is-on{background:var(--impact-chapter-smile,#151514);transform:none}
`;

  function injectStyles() {
    if (document.getElementById("impact-chapter-styles")) return;
    const style = document.createElement("style");
    style.id = "impact-chapter-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function fillGrids(root) {
    root.querySelectorAll("[data-impact-chapter-grid]").forEach((grid) => {
      const count = Math.max(0, Math.round(numberAttr(grid, "data-impact-chapter-grid-units", 0)));
      if (!count) return;
      grid.setAttribute("aria-hidden", "true");
      grid.replaceChildren(
        ...Array.from({ length: count }, () => {
          const unit = document.createElement("i");
          unit.setAttribute("data-impact-chapter-unit", "");
          return unit;
        })
      );
    });
  }

  function createStat(stat) {
    const number = stat.querySelector("[data-impact-chapter-number]");
    if (!number) return null;
    return {
      stat,
      number,
      units: [...stat.querySelectorAll("[data-impact-chapter-unit]")],
      lit: 0,
      shown: "",
      end: numberAttr(number, "data-impact-chapter-number-count", 0),
      decimals: Math.max(0, Math.round(numberAttr(number, "data-impact-chapter-number-decimals", 0))),
      prefix: number.getAttribute("data-impact-chapter-number-prefix") || "",
      suffix: number.getAttribute("data-impact-chapter-number-suffix") || "",
    };
  }

  // Floored so the count never shows a value it has not reached
  function format(chart, value) {
    const q = Math.pow(10, chart.decimals);
    const v = Math.floor(value * q + 1e-6) / q;
    const text = chart.decimals ? v.toFixed(chart.decimals) : v.toLocaleString("en-AU");
    return chart.prefix + text + chart.suffix;
  }

  // Light units in DOM order and count the number up to fraction f
  function fill(chart, f) {
    const want = Math.round(chart.units.length * f);
    while (chart.lit < want) chart.units[chart.lit++].classList.add("is-on");
    const text = format(chart, chart.end * f);
    if (text !== chart.shown) {
      chart.shown = text;
      chart.number.textContent = text;
    }
  }

  function createChapter(root, animate) {
    fillGrids(root);
    if (!animate) return;

    const gsap = window.gsap;
    const charts = [...root.querySelectorAll("[data-impact-chapter-stat]")].map(createStat).filter(Boolean);
    charts.forEach((chart) => {
      gsap.set(chart.stat, { opacity: 0 });
      fill(chart, 0);
    });
    root.classList.add("is-impact-chapter-armed");

    function play() {
      const tl = gsap.timeline();
      charts.forEach((chart, i) => {
        const at = i * 0.18;
        const state = { f: 0 };
        tl.to(chart.stat, { opacity: 1, duration: 0.6, ease: "power1.out" }, at);
        tl.to(state, { f: 1, duration: 1.6, ease: "power2.inOut", onUpdate: () => fill(chart, state.f) }, at + 0.25);
      });
      debug("impact-chapter", "play", "Stats playing", "info");
    }

    const firstStat = charts[0]?.stat || root;
    window.ScrollTrigger.create({
      trigger: firstStat,
      start: "top 85%",
      once: true,
      refreshPriority: -1,
      onEnter: play,
    });
  }

  function start() {
    const gsap = window.gsap;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = Boolean(gsap && window.ScrollTrigger) && !reducedMotion;
    if (!gsap || !window.ScrollTrigger) {
      debug("impact-chapter", "init", "GSAP or ScrollTrigger missing, staying static", "warn");
    }
    if (animate) gsap.registerPlugin(window.ScrollTrigger);

    document.querySelectorAll("[data-impact-chapter]").forEach((root) => {
      try {
        createChapter(root, animate);
      } catch (error) {
        console.error("Impact chapter failed to start:", error);
      }
    });

    debug("impact-chapter", "init", "Ready", "info");
  }

  function init() {
    try {
      injectStyles();
      start();
    } catch (error) {
      console.error("Impact chapter failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
