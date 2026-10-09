// Dev server: serves the live Webflow site with its jsDelivr motion scripts
// swapped for the local files in js/, and reloads the page when one changes.
//   npm run dev            http://localhost:4321, or the next free port
//   PORT=5000 SITE=https://harvey-2026.webflow.io npm run dev
//   SCRIPTS=impact-chapter,smile-field npm run dev   also loads local scripts
//                                                     the live footer lacks
import { createServer } from "node:http";
import { readFile, watch } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 4321;
const SITE = (process.env.SITE || "https://harvey-2026.webflow.io").replace(/\/$/, "");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const JS_DIR = join(ROOT, "js");
const CDN_SCRIPTS = /https:\/\/cdn\.jsdelivr\.net\/gh\/Harvey-AU\/harvey-website-2026@[^/"']+\/js\//g;
const RELOAD_SCRIPT = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;
const EXTRA_SCRIPTS = (process.env.SCRIPTS || "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const clients = new Set();

async function serveScript(path, res) {
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(JS_DIR) || extname(file) !== ".js") {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}

async function proxy(req, res) {
  const upstream = await fetch(SITE + req.url, { headers: { "user-agent": req.headers["user-agent"] || "" } });
  const type = upstream.headers.get("content-type") || "";
  if (!type.includes("text/html")) {
    res.writeHead(upstream.status, { "content-type": type });
    res.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }
  let html = (await upstream.text()).replace(CDN_SCRIPTS, "/js/");
  const extras = EXTRA_SCRIPTS.filter((name) => !html.includes(`/js/${name}.js`))
    .map((name) => `<script src="/js/${name}.js" defer></script>`)
    .join("");
  html = html.replace("</body>", `${extras}${RELOAD_SCRIPT}</body>`);
  res.writeHead(upstream.status, { "content-type": type, "cache-control": "no-store" }).end(html);
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/__reload") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
    } else if (path.startsWith("/js/")) {
      await serveScript(path, res);
    } else {
      await proxy(req, res);
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  }
});

// Take the next port up if this one is busy
let port = PORT;
server.on("error", (error) => {
  if (error.code !== "EADDRINUSE" || port >= PORT + 20) throw error;
  server.listen(++port);
});
server.on("listening", () => {
  console.log(`Serving ${SITE} with local js/ at http://localhost:${port}`);
});
server.listen(port);

for await (const event of watch(JS_DIR)) {
  if (!event.filename?.endsWith(".js")) continue;
  console.log(`Changed ${event.filename}, reloading`);
  clients.forEach((client) => client.write("data: reload\n\n"));
}
