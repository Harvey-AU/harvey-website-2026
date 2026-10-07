# Harvey website 2026

Motion scripts for the Harvey 2026 Webflow site (harvey-2026.webflow.io).
These are site-specific, so they live here rather than in [webflow-framework](https://github.com/Harvey-AU/webflow-framework), which is shared across client sites.

## Scripts

| File | What it does | Hooks |
| --- | --- | --- |
| `js/smooth-scroll.js` | Site-wide smooth scroll via Lenis 1.3.26 (loaded from jsDelivr), driven by the GSAP ticker when GSAP is present. | `data-lerp` on the script tag (default 0.08) |
| `js/parallax-columns.js` | Hero grid of looping columns with scroll parallax and mouse pan. | `[data-parallax-columns]` section |
| `js/pinned-steps.js` | Pinned numbered steps with image wipes (needs GSAP + ScrollTrigger). | `[data-pinned-steps]` section |
| `js/marquee.js` | Seamless endless row at a constant speed. | `[data-marquee]` strip |
| `js/nav-reveal.js` | Header that hides on scroll down and reveals on scroll up (not used yet). | `[data-nav-reveal]` header |

Each file's header comment documents its full markup and settings.
No build step: files are served as they are.

## Loading

Scripts load from jsDelivr, pinned to a release tag:

```html
<script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.0.0/js/smooth-scroll.js" data-lerp="0.12" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.0.0/js/parallax-columns.js" defer></script>
```

## Releasing a change

1. Commit and push to `main`.
2. Tag it: `git tag v1.0.1 && git push --tags`.
3. In Webflow, swap `@1.0.0` for `@1.0.1` in the Home page footer code, then publish.

A tag is immutable, so the live site only changes when the footer URL does.
