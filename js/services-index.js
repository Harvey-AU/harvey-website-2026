/**
 * Services index
 *
 * An accordion of service rows. Each row opens to a lede, a list of
 * sub-services and a showcase of case-study work. Pointing at (or focusing)
 * a sub-service crossfades the showcase to the project that best shows it;
 * on touch the first tap selects and the second follows the link. One row is
 * open at a time and the first starts open.
 *
 * The layout and the scroll reveals live in Webflow (IX3). Style every panel
 * open, as it should read without JavaScript; this script collapses them and
 * adds the hover, open and crossfade transitions. With reduced motion the
 * state still changes but nothing animates.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/services-index.js" defer></script>
 *
 * Markup (Webflow classes, hooked by the data attributes noted):
 *   ul.services_index [data-services-index]   The list of rows.
 *     li.services_row [data-lead="key"]       One service. data-lead is the
 *                                             project shown when nothing is
 *                                             selected.
 *       a.services_trigger                    Toggles the row. Link to
 *                                             #<panel id> with role="button",
 *                                             aria-controls and aria-expanded.
 *         .services_name                      Service name.
 *         .services_tag-now / -act            Rolling tag label; -act is set
 *                                             to "Show more" or "Close".
 *       .services_panel                       Collapsible panel.
 *         .services_lede                      Intro line.
 *         .services_svc                       Sub-service list.
 *           .services_svc-item
 *               [data-project="key"]          Project shown for this item.
 *             a.services_svc-link
 *               .services_svc-name / -go
 *         a.services_show-link                Showcase link, retargeted to
 *                                             the active caption's data-url.
 *           .services_frame
 *             .services_slide [data-key]      One per project.
 *               .services_slide-img / -hover
 *           .services_cap [data-key]          Caption per project.
 *               [data-url]                    Its case study URL.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const EASE = "cubic-bezier(.2,.7,.1,1)";
  const FINE = "(hover: hover) and (pointer: fine)";
  const CSS = `
.services_name{transition:transform .7s ${EASE},color .5s ${EASE}}
.services_tag{transition:background-color .3s ${EASE}}
.services_tag .label_icon{transition:border-color .3s ${EASE}}
.services_tag-now,.services_tag-act{transition:transform .5s ${EASE}}
.services_trigger:focus-visible{outline:2px solid #1e1e1e;outline-offset:4px;border-radius:2px}
@media ${FINE}{
.services_index.is-hovering .services_row:not(.is-open) .services_name{color:#bfbfbf}
.services_index.is-hovering .services_row:not(.is-open) .services_trigger:hover .services_name{color:#1e1e1e;transform:translateX(.9rem)}
.services_trigger:hover .services_tag{background-color:#ffb200}
.services_trigger:hover .services_tag .label_icon{border-color:#1e1e1e}
.services_trigger:hover .services_tag-now{transform:translateY(-110%)}
.services_trigger:hover .services_tag-act{transform:translateY(0)}
.services_show-link:hover .services_slide.is-active .services_slide-hover{opacity:1;transform:scale(1)}
}
.is-services-armed .services_panel{grid-template-rows:0fr}
.is-services-ready .services_panel{transition:grid-template-rows .8s ${EASE}}
.is-services-armed .services_row.is-open .services_panel{grid-template-rows:1fr}
.services_svc-item:last-child{border-bottom:0}
.services_svc-name{transition:color .4s ${EASE},transform .6s ${EASE}}
.services_svc-go{transition:opacity .4s ${EASE},transform .5s ${EASE}}
.services_svc.has-active .services_svc-name{color:#bfbfbf}
.services_svc .is-active .services_svc-name{color:#1e1e1e;transform:translateX(.5rem)}
.services_svc .is-active .services_svc-go{opacity:1;transform:none}
@media (hover: none){.services_svc-go{opacity:.35;transform:none}}
.services_svc-link:focus-visible{outline:2px solid #1e1e1e;outline-offset:2px;border-radius:2px}
.services_show-link:focus-visible{outline:2px solid #1e1e1e;outline-offset:4px;border-radius:.25rem}
.is-services-armed .services_frame{clip-path:inset(100% 0 0 0 round .25rem)}
.is-services-ready .services_frame{transition:clip-path 1s ${EASE} .1s}
.is-services-armed .services_row.is-open .services_frame{clip-path:inset(0 0 0 0 round .25rem)}
.services_slide{transition:opacity .6s ${EASE}}
.services_slide-img{transform:scale(1.04);transition:transform .9s ${EASE}}
.services_slide.is-active .services_slide-img{transform:scale(1)}
.services_slide-hover{transition:opacity .6s,transform .9s}
.services_cap{transition:opacity .45s ${EASE},transform .6s ${EASE}}
.services_cap.is-active{transition-delay:.08s}
.services_cap-arrow svg{transition:transform .4s ${EASE}}
.services_show-link:hover .services_cap-arrow svg{transform:translateX(3px)}
.is-services-armed .services_lede,.is-services-armed .services_svc-item{opacity:0;transform:translateY(14px)}
.is-services-ready .services_lede,.is-services-ready .services_svc-item{transition:opacity .6s ${EASE},transform .8s ${EASE}}
.is-services-armed .services_row.is-open .services_lede,.is-services-armed .services_row.is-open .services_svc-item{opacity:1;transform:none}
.is-services-armed .services_row.is-open .services_lede{transition-delay:.12s}
.is-services-armed .services_row.is-open .services_svc-item:nth-child(1){transition-delay:.2s}
.is-services-armed .services_row.is-open .services_svc-item:nth-child(2){transition-delay:.25s}
.is-services-armed .services_row.is-open .services_svc-item:nth-child(3){transition-delay:.3s}
.is-services-armed .services_row.is-open .services_svc-item:nth-child(4){transition-delay:.35s}
@media (max-width: 767px){.services_svc .is-active .services_svc-name{transform:none}}
@media (prefers-reduced-motion: reduce){
[data-services-index] *{transition-duration:.01ms!important;transition-delay:0s!important}
.services_index.is-hovering .services_row:not(.is-open) .services_trigger:hover .services_name,.services_svc .is-active .services_svc-name{transform:none}
}`;

  function injectStyles() {
    if (document.getElementById("services-index-styles")) return;
    const style = document.createElement("style");
    style.id = "services-index-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createIndex(index) {
    const rows = [...index.querySelectorAll(".services_row")];
    if (!rows.length) {
      debug("services-index", "init", "No .services_row inside", "warn");
      return;
    }
    const fine = window.matchMedia(FINE).matches;

    function show(row, key, item) {
      row.querySelectorAll(".services_slide,.services_cap").forEach((el) => {
        el.classList.toggle("is-active", el.getAttribute("data-key") === key);
      });
      const link = row.querySelector(".services_show-link");
      const cap = row.querySelector(`.services_cap[data-key="${window.CSS.escape(key)}"]`);
      if (link) {
        link.dataset.servicesHref ??= link.getAttribute("href") || "";
        link.setAttribute("href", cap?.getAttribute("data-url") || link.dataset.servicesHref);
      }
      const list = row.querySelector(".services_svc");
      if (!list) return;
      list.querySelectorAll(".services_svc-item").forEach((el) => el.classList.toggle("is-active", el === item));
      list.classList.toggle("has-active", Boolean(item));
    }

    const reset = (row) => show(row, row.getAttribute("data-lead"), null);

    function setOpen(row, open) {
      row.classList.toggle("is-open", open);
      row.querySelector(".services_trigger")?.setAttribute("aria-expanded", String(open));
      const panel = row.querySelector(".services_panel");
      if (panel) panel.inert = !open;
      const act = row.querySelector(".services_tag-act");
      if (act) act.textContent = open ? "Close" : "Show more";
      if (open) reset(row);
    }

    function toggle(row) {
      const open = !row.classList.contains("is-open");
      rows.forEach((other) => other !== row && setOpen(other, false));
      setOpen(row, open);
    }

    rows.forEach((row, i) => {
      setOpen(row, i === 0);
      reset(row);

      const trigger = row.querySelector(".services_trigger");
      if (trigger) {
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          toggle(row);
        });
        trigger.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          toggle(row);
        });
        if (fine) {
          trigger.addEventListener("mouseenter", () => index.classList.add("is-hovering"));
          trigger.addEventListener("mouseleave", () => index.classList.remove("is-hovering"));
        }
      }

      row.querySelectorAll(".services_svc-item").forEach((item) => {
        const link = item.querySelector(".services_svc-link");
        if (!link) return;
        const select = () => show(row, item.getAttribute("data-project"), item);
        if (fine) link.addEventListener("mouseenter", select);
        link.addEventListener("focus", select);
        // A tap focuses the link before it clicks, and focus selects the
        // item, so read whether it was already selected when the tap began.
        // Keyboard clicks have no pointerdown and follow the link.
        let wasActive = null;
        link.addEventListener("pointerdown", () => {
          wasActive = item.classList.contains("is-active");
        });
        link.addEventListener("click", (event) => {
          const followed = wasActive ?? true;
          wasActive = null;
          if (fine || followed) return;
          event.preventDefault();
          select();
        });
      });

      const list = row.querySelector(".services_svc");
      if (fine && list) list.addEventListener("mouseleave", () => reset(row));
    });

    // Collapse at once, then turn the open/close transitions on a frame later
    // so the closed rows do not animate shut on load.
    index.classList.add("is-services-armed");
    requestAnimationFrame(() => requestAnimationFrame(() => index.classList.add("is-services-ready")));
  }

  function init() {
    try {
      const indexes = document.querySelectorAll("[data-services-index]");
      if (!indexes.length) return;
      injectStyles();
      indexes.forEach((index) => {
        try {
          createIndex(index);
        } catch (error) {
          console.error("Services index failed to start:", error);
        }
      });
      debug("services-index", "init", `Ready with ${indexes.length} indexes`, "info");
    } catch (error) {
      console.error("Services index failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
