# CLAUDE.md

Motion scripts for harvey-2026.webflow.io, loaded from jsDelivr by the Webflow Home page footer code.
Anything visible without JavaScript (layout, content, styling, fades, gradients) is built in Webflow; each script adds motion only, to elements carrying its `data-*` attribute, documented in the file's header comment.

- Run `npm run check` (ESLint) before pushing; CI runs it on every PR.
- `npm run release-status` shows the latest tag, untagged commits on `main`, and the script versions the live footer loads.
- The live site loads a release tag, so a change is live only after the "Releasing a change" steps in `README.md`: tag, bump `@version` in the Webflow footer, publish.
