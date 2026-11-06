// @ts-check
/**
 * Mints short-lived Decart client tokens.
 *
 * Your permanent DECART_API_KEY stays on the server. The browser asks this
 * endpoint for a token right before every connect (via `apiKeyProvider`), and
 * the token is locked to one model, one web origin and a maximum session length.
 */
import { createDecartClient } from "@decartai/sdk";

/** Realtime models this app is allowed to open sessions for. */
export const REALTIME_MODELS = /** @type {const} */ ([
  "lucy-latest",
  "lucy-2.6",
  "lucy-2.5",
  "lucy-2.1",
  "lucy-vton-latest",
  "lucy-restyle-latest",
]);

const TOKEN_TTL_SECONDS = 60; // minted right before connect, so a short life is enough

// In-memory, per process. Behind a reverse proxy every request shares the
// proxy's address: read the client IP from your proxy's trusted header instead.
// The Origin check stops other websites, not scripts. For anything beyond a
// demo, put this endpoint behind your own auth or queue.
const RATE_LIMIT = { requests: 10, windowMs: 60_000 };

/** @type {Map<string, number[]>} */
const hits = new Map();

/** @param {string} ip */
function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.requests;
}

/**
 * @typedef {object} TokenRequest
 * @property {string | undefined} apiKey        Your permanent Decart API key (server-side only).
 * @property {string | null | undefined} origin The request's Origin header.
 * @property {string} ip                         Caller IP, for rate limiting.
 * @property {unknown} body                      Parsed JSON body, e.g. `{ "model": "lucy-latest" }`.
 * @property {string[]} allowedOrigins           Origins allowed to request tokens. Empty = any (dev only).
 * @property {number} maxSessionSeconds          Hard cap for one realtime session.
 */

/**
 * @param {TokenRequest} req
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function createRealtimeToken(req) {
  if (!req.apiKey) {
    return {
      status: 500,
      body: { error: "DECART_API_KEY is not set. Copy .env.example to .env and add your key." },
    };
  }
  if (req.allowedOrigins.length > 0 && (!req.origin || !req.allowedOrigins.includes(req.origin))) {
    return { status: 403, body: { error: "Origin not allowed." } };
  }
  if (isRateLimited(req.ip)) {
    return { status: 429, body: { error: "Too many token requests. Try again in a minute." } };
  }

  const requested =
    req.body && typeof req.body === "object" && "model" in req.body ? String(req.body.model) : "";
  const model = REALTIME_MODELS.find((m) => m === requested) ?? "lucy-latest";

  try {
    const client = createDecartClient({ apiKey: req.apiKey });
    const token = await client.tokens.create({
      expiresIn: TOKEN_TTL_SECONDS,
      allowedModels: [model],
      // Lock the token to the page that asked for it. Decart matches the
      // WebSocket Origin header verbatim on realtime sessions.
      ...(req.origin ? { allowedOrigins: [req.origin] } : {}),
      constraints: { realtime: { maxSessionDuration: req.maxSessionSeconds } },
    });
    return { status: 200, body: { apiKey: token.apiKey, expiresAt: token.expiresAt, model } };
  } catch (error) {
    // SDK errors are plain objects shaped { code, message, data }, not Error instances.
    const message = errorMessage(error);
    console.error("[token] Decart refused to mint a token:", message);
    return { status: 502, body: { error: `Decart refused the token request. ${message}` } };
  }
}

/** @param {unknown} error */
function errorMessage(error) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

/**
 * Reads the server configuration from environment variables.
 * @param {Record<string, string | undefined>} env
 */
export function tokenConfig(env) {
  return {
    apiKey: env.DECART_API_KEY,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    maxSessionSeconds: Number(env.MAX_SESSION_SECONDS ?? 120),
  };
}

/**
 * Node `http` middleware for POST /api/realtime-token. Used by the Vite dev
 * server and by the production server, so both behave the same.
 * @param {ReturnType<typeof tokenConfig>} config
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: () => void) => void}
 */
export function tokenMiddleware(config) {
  return (req, res, next) => {
    if (req.url !== "/api/realtime-token") return next();
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4096) req.destroy();
    });
    req.on("end", async () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        /* ignore malformed JSON and fall back to the default model */
      }
      const result = await createRealtimeToken({
        ...config,
        origin: req.headers.origin ?? null,
        ip: req.socket.remoteAddress ?? "unknown",
        body,
      });
      res
        .writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
        .end(JSON.stringify(result.body));
    });
  };
}
