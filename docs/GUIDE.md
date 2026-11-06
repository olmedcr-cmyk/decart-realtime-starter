# Implementation guide

How to put Decart's realtime video models into a web app or a physical installation, and how to get the best image out of them. Everything here is checked against `@decartai/sdk` 0.2.14 and the [Decart docs](https://docs.platform.decart.ai) as of November 2026. The field notes come from running [Obsidian Reflections](../README.md#case-study-obsidian-reflections) for six days at Milan Design Week.

**Contents**
[01 How realtime works](#01-how-realtime-works) ·
[02 Pick a model](#02-pick-a-model) ·
[03 Keep your key on the server](#03-keep-your-key-on-the-server) ·
[04 Capture](#04-capture) ·
[05 Connect](#05-connect) ·
[06 Prompting](#06-prompting) ·
[07 Reference images](#07-reference-images) ·
[08 Image quality checklist](#08-image-quality-checklist) ·
[09 Latency](#09-latency) ·
[10 Cost control](#10-cost-control) ·
[11 Installations and kiosks](#11-installations-and-kiosks) ·
[12 Going further](#12-going-further) ·
[13 Troubleshooting](#13-troubleshooting)

---

## 01 How realtime works

Your page captures the camera and opens a WebRTC session with Decart (the SDK uses LiveKit under the hood). Every frame travels to the model, gets transformed and streams back. You can change the prompt or the reference image at any moment and the next frames follow. No reconnect.

Billing is per second of active generation. Connecting, waiting in a queue and idling cost nothing.

```js
import { createDecartClient, models } from "@decartai/sdk";

const model = models.realtime("lucy-latest");
const camera = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user", frameRate: model.fps, width: model.width, height: model.height },
});

const client = createDecartClient({ apiKeyProvider: getToken }); // see 03
const session = await client.realtime.connect(camera, {
  model,
  onRemoteStream: (stream) => (video.srcObject = stream),
  initialState: { prompt: { text: "Substitute the person with a humanoid jaguar.", enhance: true } },
});

await session.setPrompt("Set the background to a bioluminescent jungle at night.");
session.disconnect();
```

## 02 Pick a model

| Model id | Use it for | Reference image | Price (720p) | Fast mode |
|---|---|---|---|---|
| `lucy-latest` (Lucy 2.6) | General live editing. Swap a character, add or remove objects, change background or style | Optional | $0.02/s | Yes, $0.04/s |
| `lucy-2.5` | Same scope as 2.6, for integrations pinned to it | Optional | $0.02/s | Yes |
| `lucy-2.1` | Character transformation from a face or character image. Previous generation, used in Obsidian Reflections | Character | $0.02/s | No |
| `lucy-vton-latest` (VTON 3.6) | Virtual try-on. Dress people from a garment photo | Garment | $0.02/s | Yes |
| `lucy-restyle-latest` (Restyle Live) | Restyle the whole scene. Not object editing | Style artwork | $0.01/s | No |

Prices from [docs.platform.decart.ai/getting-started/pricing](https://docs.platform.decart.ai/getting-started/pricing). `$1 = 100 credits`. Check that page before you budget, prices change.

Start with `lucy-latest`. Pin a version (`lucy-2.6`) once your prompts are tuned, so a model upgrade does not change your piece overnight.

## 03 Keep your key on the server

Never ship your permanent API key to the browser. Anything in a frontend bundle is public, and environment variables with a `VITE_` (or `NEXT_PUBLIC_`) prefix are inlined into it. We learned this the hard way.

Mint a short-lived client token on your server, right before each connect:

```js
// server
const client = createDecartClient({ apiKey: process.env.DECART_API_KEY });
const { apiKey } = await client.tokens.create({
  expiresIn: 60,                                   // seconds, 1 to 3600
  allowedModels: ["lucy-latest"],                  // this token opens nothing else
  allowedOrigins: ["https://mirror.example.com"],  // matched against the WebSocket Origin
  constraints: { realtime: { maxSessionDuration: 120 } },
});
```

```js
// browser
const client = createDecartClient({
  apiKeyProvider: async () => {
    const res = await fetch("/api/realtime-token", { method: "POST", body: JSON.stringify({ model }) });
    return (await res.json()).apiKey;
  },
});
```

`apiKeyProvider` runs before every connect and reconnect, so a token is never reused after it expires. A token minted on page load is usually dead by the time the user has granted the camera and pressed Start. Active sessions keep running after the token expires.

The starter's [`server/token.mjs`](../server/token.mjs) adds an origin allow-list and a per-IP rate limit on top.

Be honest about what that buys you. The `Origin` header protects you from other websites, not from scripts, which can send any header they like. A public token endpoint is fine for a demo, because every token is capped in time and scope. For a product, put the endpoint behind your own sign-in or a queue you control, and watch your usage.

## 04 Capture

- **Ask for exactly what the model expects.** Pass `model.fps`, `model.width` and `model.height` as constraints. If the camera delivers another size, the browser rescales every frame, which adds latency and softens the result.
- **Portrait.** On a desktop webcam, swap width and height. Phones map it for you.
- **Front camera.** Use `facingMode: "user"` and `mirror: "auto"` in `connect()`, so the input is pre-flipped like a mirror. Desktop webcams often do not report a facing mode, use `mirror: true` there.
- **Audio is opt-in.** If your stream carries a mic track, Decart sends synced audio back and you should play the remote audio, not the local mic. A video-only stream avoids the microphone prompt on iOS.

## 05 Connect

- **Send the first state with the connect.** Put the prompt and image in `initialState`. Otherwise the first frames are your raw camera.
- **Connect once, then update.** A WebRTC handshake takes a few hundred milliseconds. Reconnect only to switch model, camera or fast mode.
- **`set()` replaces the whole state.** `session.set({ image })` clears the prompt. Send both: `set({ prompt, enhance, image })`. Use `setPrompt()` for prompt-only changes.
- **Retries.** `connect()` retries up to 5 times with backoff, and waits through capacity refusals with `onCapacityWait`. If you run your own queue, pass `retries: 0` so retries do not jump the line.
- **Watch the ending.** `sessionEnded` gives the reason: `session_limit`, `insufficient_credits`, `moderation_violation`, `policy_violation`.

## 06 Prompting

From Decart's prompting guides, plus what worked for us.

- **Lead with a verb.** Substitute, Add, Swap, Replace, Remove, Change, Set the background, Restyle.
  - `Substitute the person with a humanoid jaguar, golden fur with black rosettes, amber eyes.`
  - `Add a silver crown floating above the person's head.`
  - `Set the background to a Maya city of carved stone at night, lit by torches.`
- **Be concrete.** "Make it royal" is weak. "Add a silver crown floating above the person's head" works.
- **Name the target by what the camera sees.** "the person wearing the red shirt".
- **One edit per prompt is safest.** Lucy 2.6 accepts two or three deliberate edits.
- **No negatives.** "don't add a hat" tends to add a hat.
- **No timed behaviour.** The model edits frames, it does not react to events.
- **Length.** About 750 characters of English fit. Longer prompts are rejected with a message saying how much fits.
- **`enhance`.** On by default, Decart rewrites your instruction to fit the scene and the reference. Turn it off when you need the exact wording, for example in an art piece where the prompt is the score.
- **Debounce live typing** (about 300 ms) so half-written prompts do not reach the model.

**Variation without chaos.** In Milan each visitor got the same animal but a different finish. We appended one random colour tint to the base prompt (18 options) and, when no prompt was set, composed it from five short lists (material, colour, aura, particles, ground). That is 211,680 combinations from a few dozen phrases, and the material never repeated twice in a row.

## 07 Reference images

- JPEG, PNG or WebP. At least 512 × 512. Under 2048 px on the long side and under 5 MB. The starter resizes to 1536 px JPEG at 0.92 in the browser ([`src/image.js`](../src/image.js)), which uploads fast and loses nothing visible.
- **Character (Lucy 2.1).** Clear, evenly lit, front-facing portrait. Head and shoulders, one face, neutral expression. No sunglasses, no extreme angles.
- **Lucy 2.5/2.6.** Match the framing to the swap. Full body for a full-body swap. Clean product shot on a neutral background for objects.
- **Try-on.** Front-facing garment on a plain, ideally white, background.
- **Restyle.** Artworks and illustrations work best. Avoid photos of real scenes, text and very dark images.
- Reusing an image across many sessions? Upload it once with `client.files.upload()` and pass the `file_...` id.

## 08 Image quality checklist

1. **Light the face, not the room.** Soft, even light from the front. Backlight from a window is the most common cause of a muddy result.
2. **Steady framing.** Moderate movement, consistent focus. Lock exposure if the camera hunts.
3. **Camera at the model's size and frame rate.** See 04.
4. **Ask for 1080p where it exists.** `connect(stream, { resolution: "1080p" })` requests a 1080p remote stream from supported models. The docs do not yet list which ones, so check the output size the starter shows in its HUD.
5. **Pick the codec for the device.** `preferredVideoCodec: "h264"` usually gets hardware decode on phones and tablets. Desktop Safari always uses VP8.
6. **Keep the edit target visible and distinguishable** when the prompt arrives.
7. **Self-anchoring** (on by default in 2.5/2.6) keeps the result stable. If your scene changes a lot, connect with `queryParams: { self_anchor: "false" }`.
8. **A good reference beats a long prompt.** See 07.
9. **Contrast the output, not the input.** Do not run beauty filters or heavy compression on the camera feed before it goes to Decart.
10. **Show it big.** Fill the screen with the output (`object-fit: contain`) and keep the raw camera small or hidden.

## 09 Latency

- **Preflight.** `client.realtime.checkConnectivity()` checks the network in a second, with no session and no cost. `{ deep: true, model }` opens a short real session and measures glass-to-glass latency.
- **In session.** `onConnectionQuality` reports `good | fair | poor | critical` and the limiting factor: `bandwidth`, `latency`, `loss`, `stall` or `cpu`. The `stats` event updates every second with fps, frame size and the camera-to-screen latency (`getConnectionQuality().metrics.g2gMs`).
- **Fast mode.** `speed: "fast"` on Lucy 2.5/2.6 and VTON runs on a faster tier. Lower latency, same quality, twice the price, US region only.
- **Network.** Realtime needs outbound TCP 443 and UDP (3478, 7882). Corporate and venue Wi-Fi often blocks UDP, which looks like "it connects, but the video freezes". Test on site, and bring a 5G router.

## 10 Cost control

- You pay per generated second. `generationTick` tells you how many.
- Cap every session twice. On the token (`maxSessionDuration`) and in the app (the starter stops at "max seconds").
- Disconnect when the tab is hidden or the page closes. The starter does both.
- An installation with a queue is a burn-rate problem. In Milan we cut each transformation to six seconds, then let the mirror rest. 2,600 transformations cost far less than one long open stream per pedestal.
- `insufficient_credits` ends a session, and an empty account is refused while connecting, before any frame. Watch your balance (`GET /v1/credits` with an `x-api-key` header) before an event. The starter's token server checks it and tells the user.

## 11 Installations and kiosks

What six days of public use taught us.

- **Keep the screen awake** with the Wake Lock API, and go full screen on the first tap.
- **Short, complete moments.** Onboarding tap, a few seconds connecting, six seconds transformed, a two-second closing transition, ready for the next person. People queue happily for something short and finished.
- **Change prompts without redeploying.** Store the prompt and reference image per station on your server and fetch them at connect time. We tuned the animals between visitors from a small admin page.
- **Iterate nightly.** Each evening we reviewed where people stopped, what moved them and where silence appeared, then rewrote prompts and code for the next morning.
- **Say what happens to the image.** A short line on the start screen about what is and is not stored builds trust in a public space.
- **Plan for the network** (see 09) and for concurrency. One API key has a concurrent-session limit, and `session_limit` tells you when you hit it.

## 12 Going further

- **Viewers.** A live session exposes `subscribeToken`. Pass it to `client.realtime.subscribe()` on another device to show the transformed stream on a big screen, with no camera.
- **Batch video.** `client.queue.submitAndPoll({ model: models.video("lucy-latest"), prompt, data })` processes recorded clips.
- **React Native and Expo.** Supported through LiveKit's React Native packages. See the SDK README.

## 13 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `TOKEN_EXPIRED` on connect | Token minted too early | Use `apiKeyProvider`, mint right before connect |
| `Stale connect attempt` right after connecting | The server closed the session during the handshake, most often `Insufficient credits` (visible in the console) | Add credits. The starter's token server checks `GET /v1/credits` first and says so |
| Connects, then video freezes | UDP blocked on the network | Try another network, check ports in 09 |
| First frames show the raw camera | No `initialState` | Send prompt and image with `connect()` |
| Prompt change drops the image | `set()` replaces the state | Send prompt and image together, or use `setPrompt()` |
| Soft, blurry output | Camera size mismatch, poor light | Match model size, light the face, try `resolution: "1080p"` |
| `session_limit` or `Concurrent session limit reached.` | Too many sessions on your key | Queue on your side with `retries: 0` |
| Black video on a viewer | Viewer on an older SDK | Upgrade viewers before publishers |
