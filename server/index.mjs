// @ts-check
/**
 * Production server: serves the built app from dist/ and mints Decart client
 * tokens at POST /api/realtime-token. Zero dependencies beyond the SDK.
 *
 *   npm run build && npm start
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenConfig, tokenMiddleware } from "./token.mjs";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const config = tokenConfig(process.env);

if (!config.apiKey) console.warn("[server] DECART_API_KEY is missing. Token requests will fail.");
if (config.allowedOrigins.length === 0) {
  console.warn("[server] ALLOWED_ORIGINS is empty. Set it to your public URL before deploying.");
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self)",
};

const tokens = tokenMiddleware(config);

createServer((req, res) => {
  tokens(req, res, async () => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
    let file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      file = join(root, "index.html"); // single-page fallback
    }
    try {
      const data = await readFile(file);
      const type = types[/** @type {keyof typeof types} */ (extname(file))] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, ...securityHeaders }).end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}).listen(port, () => console.log(`[server] http://localhost:${port}`));
