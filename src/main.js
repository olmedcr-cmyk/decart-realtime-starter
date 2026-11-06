// @ts-check
import { MODELS, REFERENCE_HINT, findModel } from "./models.js";
import { prepareReferenceImage } from "./image.js";
import { Mirror, preflight } from "./mirror.js";

const PROMPT_SOFT_LIMIT = 750; // Decart: about 750 characters of English fit

/** @template {HTMLElement} T @param {string} id @returns {T} */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

const ui = {
  model: /** @type {HTMLSelectElement} */ ($("model")),
  modelUse: $("model-use"),
  presets: $("presets"),
  prompt: /** @type {HTMLTextAreaElement} */ ($("prompt")),
  enhance: /** @type {HTMLInputElement} */ ($("enhance")),
  count: $("count"),
  image: /** @type {HTMLInputElement} */ ($("image")),
  imagePreview: $("image-preview"),
  imageClear: $("image-clear"),
  imageHint: $("image-hint"),
  resolution: /** @type {HTMLSelectElement} */ ($("resolution")),
  codec: /** @type {HTMLSelectElement} */ ($("codec")),
  orientation: /** @type {HTMLSelectElement} */ ($("orientation")),
  max: /** @type {HTMLInputElement} */ ($("max")),
  fast: /** @type {HTMLInputElement} */ ($("fast")),
  audio: /** @type {HTMLInputElement} */ ($("audio")),
  start: /** @type {HTMLButtonElement} */ ($("start")),
  stop: /** @type {HTMLButtonElement} */ ($("stop")),
  notice: $("notice"),
  output: /** @type {HTMLVideoElement} */ ($("output")),
  camera: /** @type {HTMLVideoElement} */ ($("camera")),
  overlay: $("overlay"),
  hud: {
    state: $("hud-state"),
    quality: $("hud-quality"),
    latency: $("hud-latency"),
    output: $("hud-output"),
    time: $("hud-time"),
    cost: $("hud-cost"),
  },
};

/** @type {Blob | null} */
let referenceImage = null;

// ---------------------------------------------------------------- model + prompts
for (const m of MODELS) ui.model.add(new Option(`${m.label} · $${m.pricePerSecond.toFixed(2)}/s`, m.id));

function renderModel() {
  const m = findModel(ui.model.value);
  ui.modelUse.textContent = m.use;
  ui.imageHint.textContent = REFERENCE_HINT[m.reference];
  ui.presets.replaceChildren(
    ...m.prompts.map((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = p.label;
      b.onclick = () => {
        ui.prompt.value = p.text;
        onPromptInput();
      };
      return b;
    }),
  );
  if (!ui.prompt.value || !mirror.live) ui.prompt.value = m.prompts[0].text;
  updateCount();
}

function updateCount() {
  const n = ui.prompt.value.length;
  ui.count.textContent = `${n} / ~${PROMPT_SOFT_LIMIT}`;
  ui.count.classList.toggle("warn", n > PROMPT_SOFT_LIMIT);
}

// Live prompt edits, debounced (Decart suggests ~300 ms) so typing does not
// flood the session with half-written prompts.
let debounce = 0;
function onPromptInput() {
  updateCount();
  clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    if (mirror.live && ui.prompt.value.trim()) {
      mirror.setPrompt(ui.prompt.value.trim(), ui.enhance.checked).catch(showError);
    }
  }, 300);
}
ui.prompt.addEventListener("input", onPromptInput);
ui.enhance.addEventListener("change", onPromptInput);

// ---------------------------------------------------------------- reference image
ui.image.addEventListener("change", async () => {
  const file = ui.image.files?.[0];
  if (!file) return;
  try {
    const prepared = await prepareReferenceImage(file);
    referenceImage = prepared.blob;
    const img = /** @type {HTMLImageElement} */ (ui.imagePreview.querySelector("img"));
    img.src = URL.createObjectURL(prepared.blob);
    ui.imagePreview.hidden = false;
    ui.notice.textContent = prepared.warning ?? `Reference ready · ${prepared.width}×${prepared.height}`;
    if (mirror.live) await mirror.setImage(referenceImage, ui.prompt.value.trim(), ui.enhance.checked);
  } catch (e) {
    showError(e);
  }
});
ui.imageClear.addEventListener("click", async () => {
  referenceImage = null;
  ui.image.value = "";
  ui.imagePreview.hidden = true;
  if (mirror.live) await mirror.setImage(null, ui.prompt.value.trim(), ui.enhance.checked).catch(showError);
});

// ---------------------------------------------------------------- session
const mirror = new Mirror({
  onCamera: (stream) => {
    ui.camera.srcObject = stream;
    ui.overlay.hidden = true;
  },
  onOutput: (stream) => {
    ui.output.srcObject = stream;
    // Play remote audio only when we sent our voice; it comes back in sync.
    ui.output.muted = !ui.audio.checked;
  },
  onState: (state) => {
    ui.hud.state.textContent = state;
    document.body.dataset.state = state;
  },
  onQuality: ({ quality, limitingFactor }) => {
    ui.hud.quality.textContent = limitingFactor === "none" ? quality : `${quality} · ${limitingFactor}`;
  },
  onMetrics: ({ g2gMs, fps, width, height }) => {
    if (g2gMs != null) ui.hud.latency.textContent = `${Math.round(g2gMs)} ms`;
    if (width && height) ui.hud.output.textContent = `${width}×${height}${fps ? ` · ${Math.round(fps)} fps` : ""}`;
  },
  onTick: (seconds) => {
    const m = findModel(ui.model.value);
    const rate = m.pricePerSecond * (ui.fast.checked ? 2 : 1);
    ui.hud.time.textContent = `${seconds} s`;
    ui.hud.cost.textContent = `$${(seconds * rate).toFixed(2)}`;
  },
  onNotice: (message) => (ui.notice.textContent = message),
  onEnded: (reason) => {
    ui.output.srcObject = null;
    ui.camera.srcObject = null;
    ui.overlay.hidden = false;
    ui.hud.state.textContent = "idle";
    document.body.dataset.state = "idle";
    ui.notice.textContent = `Session ended · ${reason}.`;
    setLive(false);
  },
});

/** @param {boolean} live */
function setLive(live) {
  ui.start.disabled = live;
  ui.stop.disabled = !live;
  // These need a new connection, so lock them while live.
  for (const el of [ui.model, ui.resolution, ui.codec, ui.orientation, ui.fast, ui.audio, ui.max]) el.disabled = live;
}

ui.start.addEventListener("click", async () => {
  const prompt = ui.prompt.value.trim();
  if (!prompt) {
    ui.notice.textContent = "Write a prompt first.";
    return;
  }
  setLive(true);
  ui.notice.textContent = "Checking the network…";
  try {
    const check = await preflight();
    if (check.quality === "critical") {
      ui.notice.textContent = `Network looks blocked (${check.reasons.join(", ")}). Trying anyway.`;
    } else {
      ui.notice.textContent = "";
    }
    await mirror.start({
      model: /** @type {import("./mirror.js").ModelId} */ (ui.model.value),
      prompt,
      enhance: ui.enhance.checked,
      image: referenceImage,
      resolution: /** @type {"720p" | "1080p"} */ (ui.resolution.value),
      fast: ui.fast.checked,
      codec: /** @type {"auto" | "h264" | "vp8" | "vp9"} */ (ui.codec.value),
      orientation: /** @type {"landscape" | "portrait"} */ (ui.orientation.value),
      audio: ui.audio.checked,
      maxSeconds: Number(ui.max.value) || 60,
    });
  } catch (e) {
    mirror.stop("error");
    showError(e); // after stop(), so the specific message is the one that stays
  }
});
ui.stop.addEventListener("click", () => mirror.stop("stopped"));
ui.model.addEventListener("change", renderModel);

/**
 * SDK errors are plain objects shaped { code, message, data }, so read
 * `message` directly instead of relying on `instanceof Error`.
 * @param {unknown} e
 */
function showError(e) {
  const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
  ui.notice.textContent = msg;
}

renderModel();
