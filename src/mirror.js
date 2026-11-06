// @ts-check
/**
 * A realtime mirror session: camera in, transformed video out.
 *
 * Everything that matters for quality, latency and cost lives here, so you can
 * lift this file into your own app.
 */
import { createDecartClient, models } from "@decartai/sdk";

/** @typedef {import("@decartai/sdk").RealTimeClient} RealTimeClient */
/** @typedef {"lucy-latest" | "lucy-2.1" | "lucy-vton-latest" | "lucy-restyle-latest"} ModelId */

/**
 * @typedef {object} MirrorOptions
 * @property {ModelId} model
 * @property {string} prompt
 * @property {boolean} enhance           Let Decart rewrite the prompt for the scene. On by default.
 * @property {Blob | null} image         Reference image (already resized).
 * @property {"720p" | "1080p"} resolution
 * @property {boolean} fast              Fast mode: lower latency, 2x price, same quality.
 * @property {"auto" | "h264" | "vp8" | "vp9"} codec
 * @property {"landscape" | "portrait"} orientation
 * @property {boolean} audio             Send the mic. The remote stream then carries synced audio.
 * @property {number} maxSeconds         Stop on our side after this many generated seconds.
 */

/**
 * @typedef {object} MirrorCallbacks
 * @property {(stream: MediaStream) => void} onCamera
 * @property {(stream: MediaStream) => void} onOutput
 * @property {(state: string) => void} onState
 * @property {(info: { quality: string, limitingFactor: string }) => void} onQuality
 * @property {(m: { fps: number | null, g2gMs: number | null, ttffMs: number | null, width: number | null, height: number | null }) => void} onMetrics
 * @property {(seconds: number) => void} onTick
 * @property {(message: string) => void} onNotice
 * @property {(reason: string) => void} onEnded
 */

// One client for the whole page. It never sees your API key: before every
// connect and reconnect it asks our server for a fresh, short-lived token.
let currentModel = /** @type {ModelId} */ ("lucy-latest");
const client = createDecartClient({
  apiKeyProvider: async () => {
    const res = await fetch("/api/realtime-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: currentModel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.apiKey) throw new Error(data.error ?? `Token request failed (${res.status})`);
    return data.apiKey;
  },
});

/** Network-only reachability check. No session, no cost. */
export function preflight() {
  return client.realtime.checkConnectivity();
}

export class Mirror {
  /** @type {RealTimeClient | null} */ #session = null;
  /** @type {MediaStream | null} */ #camera = null;
  /** @type {WakeLockSentinel | null} */ #wakeLock = null;
  #seconds = 0;
  #active = false;

  /** @param {MirrorCallbacks} cb */
  constructor(cb) {
    this.cb = cb;
    // Never pay for a tab nobody is looking at.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.stop("tab hidden");
    });
    window.addEventListener("pagehide", () => this.stop("page closed"));
  }

  get live() {
    return this.#session !== null;
  }

  /** @param {MirrorOptions} opts */
  async start(opts) {
    if (this.#active) return;
    this.#active = true;
    this.#seconds = 0;
    currentModel = opts.model;
    const model = models.realtime(opts.model);

    // 1. Camera at exactly what the model expects. A mismatch makes the browser
    //    rescale every frame, which adds latency and softens the output.
    const portrait = opts.orientation === "portrait";
    this.cb.onState("camera");
    try {
      this.#camera = await navigator.mediaDevices.getUserMedia({
        audio: opts.audio,
        video: {
          facingMode: "user",
          frameRate: model.fps,
          width: { ideal: portrait ? model.height : model.width },
          height: { ideal: portrait ? model.width : model.height },
        },
      });
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      throw new Error(denied ? "Camera access was denied. Allow it in the browser and try again." : `Camera unavailable. ${e}`);
    }
    this.cb.onCamera(this.#camera);

    // 2. Connect once with the full first state, so the very first frame the
    //    viewer sees is already transformed (no flash of the raw camera).
    this.cb.onState("connecting");
    const wantsFast = opts.fast && model.supportedSpeeds?.includes("fast");
    this.#session = await client.realtime
      .connect(this.#camera, {
      model,
      mirror: "auto",
      resolution: opts.resolution,
      ...(wantsFast ? { speed: /** @type {const} */ ("fast") } : {}),
      ...(opts.codec !== "auto" ? { preferredVideoCodec: opts.codec } : {}),
      initialState: {
        prompt: { text: opts.prompt, enhance: opts.enhance },
        ...(opts.image ? { image: opts.image } : {}),
      },
      onRemoteStream: (stream) => this.cb.onOutput(stream),
      onConnectionChange: (state) => this.cb.onState(state),
      onConnectionQuality: ({ quality, limitingFactor }) => this.cb.onQuality({ quality, limitingFactor }),
      onCapacityWait: ({ retryAfterMs }) =>
        this.cb.onNotice(`Decart is busy. Retrying in ${Math.round(retryAfterMs / 1000)} s.`),
      onQueuePosition: ({ position, queueSize }) => this.cb.onNotice(`In queue: ${position} of ${queueSize}.`),
      })
      .catch((/** @type {unknown} */ e) => {
        // When the server closes the session during the handshake (no credits,
        // a policy refusal), connect() only reports a generic stale attempt.
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
        if (/stale connect/i.test(msg)) {
          throw new Error("Decart closed the session while connecting. Check your credits and model access, then try again.");
        }
        throw e;
      });

    const session = this.#session;
    session.on("generationTick", ({ seconds }) => {
      this.#seconds = seconds;
      this.cb.onTick(seconds);
      if (seconds >= opts.maxSeconds) this.stop(`limit of ${opts.maxSeconds} s reached`);
    });
    session.on("stats", (s) => {
      const q = session.getConnectionQuality()?.metrics;
      this.cb.onMetrics({
        fps: s.video?.framesPerSecond ?? null,
        width: s.video?.frameWidth ?? null,
        height: s.video?.frameHeight ?? null,
        g2gMs: q?.g2gMs ?? null,
        ttffMs: q?.ttffMs ?? null,
      });
    });
    session.on("sessionEnded", ({ reason }) => this.stop(reason));
    session.on("error", (e) => this.cb.onNotice(e.message));

    // Keep a kiosk or tablet screen awake while it is transforming someone.
    try {
      this.#wakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      /* not critical */
    }
  }

  /**
   * Update the prompt live. No reconnect, no new token.
   * @param {string} text
   * @param {boolean} enhance
   */
  async setPrompt(text, enhance) {
    await this.#session?.setPrompt(text, { enhance });
  }

  /**
   * Swap or clear the reference image live. `set()` replaces the whole state,
   * so the prompt goes with it.
   * @param {Blob | null} image
   * @param {string} prompt
   * @param {boolean} enhance
   */
  async setImage(image, prompt, enhance) {
    await this.#session?.set({ prompt, enhance, image });
  }

  /** @param {string} [reason] */
  stop(reason = "stopped") {
    if (!this.#active) return;
    this.#active = false;
    this.#session?.disconnect();
    this.#session = null;
    this.#camera?.getTracks().forEach((t) => t.stop());
    this.#camera = null;
    this.#wakeLock?.release().catch(() => {});
    this.#wakeLock = null;
    this.cb.onEnded(reason);
  }

  get seconds() {
    return this.#seconds;
  }
}
