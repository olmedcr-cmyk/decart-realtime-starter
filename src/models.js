// @ts-check
/**
 * The realtime models this starter exposes, with what each one is for and the
 * published realtime price (USD per second of active generation, 720p).
 * Source: https://docs.platform.decart.ai/getting-started/pricing (November 2026).
 */

/**
 * @typedef {object} ModelEntry
 * @property {"lucy-latest" | "lucy-2.1" | "lucy-vton-latest" | "lucy-restyle-latest"} id
 * @property {string} label
 * @property {string} use
 * @property {number} pricePerSecond
 * @property {"optional" | "character" | "garment" | "style"} reference
 * @property {{ label: string, text: string }[]} prompts
 */

/** @type {ModelEntry[]} */
export const MODELS = [
  {
    id: "lucy-latest",
    label: "Lucy 2.6",
    use: "Edit anything live. Swap a character, add objects, change the background or the style.",
    pricePerSecond: 0.02,
    reference: "optional",
    prompts: [
      {
        label: "Crystal",
        text: "Substitute the person with a featureless crystalline humanoid, smooth faceted head, translucent smoky quartz body, hands and fingers made of the same crystal.",
      },
      {
        label: "Jaguar",
        text: "Substitute the person with a humanoid jaguar, golden fur with black rosettes, amber eyes, keeping the same pose and gestures.",
      },
      { label: "Crown", text: "Add a silver crown floating above the person's head." },
      {
        label: "Jungle",
        text: "Set the background to a bioluminescent jungle at night, giant monstera leaves, glowing moss, fireflies.",
      },
    ],
  },
  {
    id: "lucy-2.1",
    label: "Lucy 2.1",
    use: "Become a character from a face or character image. The model behind Obsidian Reflections.",
    pricePerSecond: 0.02,
    reference: "character",
    prompts: [
      {
        label: "Reptile",
        text: "Transform the person into a scaled reptile humanoid with iridescent green and bronze scales, keeping the same expression.",
      },
    ],
  },
  {
    id: "lucy-vton-latest",
    label: "Lucy VTON 3.6",
    use: "Virtual try-on. Dress people in a garment from a photo.",
    pricePerSecond: 0.02,
    reference: "garment",
    prompts: [
      { label: "Jacket", text: "Swap the top for a black leather biker jacket." },
      { label: "Dress", text: "Swap the outfit for a long red silk evening dress." },
    ],
  },
  {
    id: "lucy-restyle-latest",
    label: "Lucy Restyle Live",
    use: "Restyle the whole scene. Best with artworks as style references.",
    pricePerSecond: 0.01,
    reference: "style",
    prompts: [
      { label: "Oil", text: "Venetian Renaissance oil painting, single light source, deep shadows." },
      { label: "Anime", text: "Hand-drawn anime, clean line art, soft cel shading." },
      { label: "Clay", text: "Stop-motion claymation, visible fingerprints, warm studio light." },
    ],
  },
];

/** @param {string} id */
export function findModel(id) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** Reference-image hint shown under the upload field, per model. */
export const REFERENCE_HINT = {
  optional: "Optional. Full-body reference for full-body swaps, clean product shot for objects.",
  character: "Clear, front-facing, evenly lit portrait. Head and shoulders, one face.",
  garment: "Front-facing garment on a plain background, evenly lit.",
  style: "An artwork or illustration works best. Avoid text and very dark images.",
};
