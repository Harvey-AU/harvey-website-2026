// Release status: the latest tag, what main has that no tag covers yet, and
// which script versions the live Home footer actually loads.
//   npm run release-status
//   SITE=https://harvey-2026.webflow.io npm run release-status
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = (process.env.SITE || "https://harvey-2026.webflow.io").replace(/\/$/, "");
const JS_DIR = fileURLToPath(new URL("../js", import.meta.url));
const FOOTER_SCRIPT = /cdn\.jsdelivr\.net\/gh\/Harvey-AU\/harvey-website-2026@([^/"']+)\/js\/([\w-]+)\.js/g;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

git("fetch", "--quiet", "--tags", "origin", "main");
const tag = git("tag", "--list", "v*", "--sort=-v:refname").split("\n")[0];
const unreleased = git("log", "--oneline", `${tag}..origin/main`);

const html = await (await fetch(SITE)).text();
const live = new Map([...html.matchAll(FOOTER_SCRIPT)].map(([, version, name]) => [name, version]));
const local = readdirSync(JS_DIR)
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.slice(0, -3));

console.log(`Latest tag: ${tag}`);
console.log(unreleased ? `On main but not tagged:\n${indent(unreleased)}` : "Main is fully tagged.");
console.log(`\nLive footer on ${SITE}:`);
for (const [name, version] of live) {
  const note = `v${version}` === tag ? "" : `  (latest is ${tag})`;
  console.log(`  ${name}@${version}${note}`);
}
const notLive = local.filter((name) => !live.has(name));
if (notLive.length) console.log(`\nIn js/ but not loaded live:\n${indent(notLive.join("\n"))}`);

function indent(text) {
  return text.replace(/^/gm, "  ");
}
