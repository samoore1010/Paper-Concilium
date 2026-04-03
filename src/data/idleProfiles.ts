import { Persona } from "./personas";

/**
 * Fidget types that can play as micro-animations on idle characters.
 * Each fidget targets a specific SVG layer/group.
 */
export type FidgetType =
  // Head fidgets
  | "head-tilt-left"
  | "head-tilt-right"
  | "chin-raise"
  | "look-around"
  // Hand fidgets
  | "finger-drum"
  | "pen-tap"
  | "glasses-adjust"
  | "phone-check"
  | "note-writing"
  | "arm-cross"
  | "arm-uncross"
  // Body fidgets
  | "weight-shift"
  | "lean-forward"
  | "lean-back"
  | "shoulder-roll"
  | "posture-straighten"
  // Accessory fidgets
  | "glasses-push"
  | "hat-adjust"
  | "bowtie-touch";

export interface FidgetAnimation {
  type: FidgetType;
  /** Duration in seconds (0.3 - 1.5s) */
  duration: number;
  /** Which SVG layer group this fidget targets */
  target: "head" | "hands" | "body" | "accessory";
}

export interface IdleProfile {
  /** Breathing speed in seconds (full cycle) */
  breatheDuration: number;
  /** Breathing amplitude multiplier (1.0 = normal 1.5% scale) */
  breatheAmplitude: number;
  /** Available fidgets for this character */
  fidgets: FidgetAnimation[];
  /** Min seconds between fidgets */
  fidgetIntervalMin: number;
  /** Max seconds between fidgets */
  fidgetIntervalMax: number;
  /** Eye movement speed multiplier (1.0 = normal) */
  eyeRestlessness: number;
}

const FIDGET_LIBRARY: Record<FidgetType, FidgetAnimation> = {
  "head-tilt-left": { type: "head-tilt-left", duration: 0.8, target: "head" },
  "head-tilt-right": { type: "head-tilt-right", duration: 0.8, target: "head" },
  "chin-raise": { type: "chin-raise", duration: 1.0, target: "head" },
  "look-around": { type: "look-around", duration: 1.2, target: "head" },
  "finger-drum": { type: "finger-drum", duration: 1.0, target: "hands" },
  "pen-tap": { type: "pen-tap", duration: 0.8, target: "hands" },
  "glasses-adjust": { type: "glasses-adjust", duration: 0.6, target: "hands" },
  "phone-check": { type: "phone-check", duration: 1.5, target: "hands" },
  "note-writing": { type: "note-writing", duration: 1.2, target: "hands" },
  "arm-cross": { type: "arm-cross", duration: 0.8, target: "hands" },
  "arm-uncross": { type: "arm-uncross", duration: 0.8, target: "hands" },
  "weight-shift": { type: "weight-shift", duration: 1.0, target: "body" },
  "lean-forward": { type: "lean-forward", duration: 1.2, target: "body" },
  "lean-back": { type: "lean-back", duration: 1.2, target: "body" },
  "shoulder-roll": { type: "shoulder-roll", duration: 0.8, target: "body" },
  "posture-straighten": { type: "posture-straighten", duration: 0.6, target: "body" },
  "glasses-push": { type: "glasses-push", duration: 0.5, target: "accessory" },
  "hat-adjust": { type: "hat-adjust", duration: 0.6, target: "accessory" },
  "bowtie-touch": { type: "bowtie-touch", duration: 0.5, target: "accessory" },
};

function getFidget(type: FidgetType): FidgetAnimation {
  return FIDGET_LIBRARY[type];
}

/**
 * Maps a persona's traits to an idle animation profile.
 * Uses communicationStyle, stats (toughness, patience), and accessory.
 */
export function getIdleProfile(persona: Persona): IdleProfile {
  const { communicationStyle, stats, accessory } = persona;

  // Base breathing parameters by communication style archetype
  let breatheDuration: number;
  let breatheAmplitude: number;
  let eyeRestlessness: number;
  let fidgetIntervalMin: number;
  let fidgetIntervalMax: number;

  switch (communicationStyle) {
    case "confrontational":
      // Aggressive: fast breathing, restless
      breatheDuration = 2.8;
      breatheAmplitude = 1.3;
      eyeRestlessness = 1.6;
      fidgetIntervalMin = 3;
      fidgetIntervalMax = 7;
      break;
    case "blunt":
      // Direct: medium-fast breathing, moderate restlessness
      breatheDuration = 3.2;
      breatheAmplitude = 1.2;
      eyeRestlessness = 1.3;
      fidgetIntervalMin = 4;
      fidgetIntervalMax = 8;
      break;
    case "analytical":
      // Measured: slow breathing, calm
      breatheDuration = 4.5;
      breatheAmplitude = 0.9;
      eyeRestlessness = 0.8;
      fidgetIntervalMin = 6;
      fidgetIntervalMax = 12;
      break;
    case "skeptical":
      // Watchful: medium breathing, alert eyes
      breatheDuration = 3.8;
      breatheAmplitude = 1.0;
      eyeRestlessness = 1.4;
      fidgetIntervalMin = 5;
      fidgetIntervalMax = 10;
      break;
    case "socratic":
      // Thoughtful: slow deep breathing, occasional movement
      breatheDuration = 5.0;
      breatheAmplitude = 1.1;
      eyeRestlessness = 0.9;
      fidgetIntervalMin = 7;
      fidgetIntervalMax = 12;
      break;
    case "emotional":
      // Expressive: variable breathing, animated
      breatheDuration = 3.5;
      breatheAmplitude = 1.2;
      eyeRestlessness = 1.2;
      fidgetIntervalMin = 4;
      fidgetIntervalMax = 9;
      break;
    case "supportive":
    default:
      // Calm: steady breathing, gentle movement
      breatheDuration = 4.2;
      breatheAmplitude = 1.0;
      eyeRestlessness = 0.7;
      fidgetIntervalMin = 6;
      fidgetIntervalMax = 11;
      break;
  }

  // Adjust by toughness: higher toughness = slightly faster, more intense
  if (stats.toughness >= 8) {
    breatheDuration *= 0.9;
    fidgetIntervalMin = Math.max(3, fidgetIntervalMin - 1);
  } else if (stats.toughness <= 3) {
    breatheDuration *= 1.1;
    fidgetIntervalMax = Math.min(14, fidgetIntervalMax + 1);
  }

  // Adjust by patience: more patient = less fidgeting
  if (stats.patience >= 8) {
    fidgetIntervalMin += 2;
    fidgetIntervalMax += 2;
    eyeRestlessness *= 0.8;
  } else if (stats.patience <= 3) {
    fidgetIntervalMin = Math.max(3, fidgetIntervalMin - 1);
    fidgetIntervalMax = Math.max(6, fidgetIntervalMax - 2);
    eyeRestlessness *= 1.2;
  }

  // Build fidget list based on personality
  const fidgets: FidgetAnimation[] = [];

  // Universal fidgets (everyone does some of these)
  fidgets.push(getFidget("weight-shift"));
  fidgets.push(getFidget("posture-straighten"));

  // Communication style-specific fidgets
  switch (communicationStyle) {
    case "confrontational":
      fidgets.push(getFidget("lean-forward"));
      fidgets.push(getFidget("chin-raise"));
      fidgets.push(getFidget("arm-cross"));
      fidgets.push(getFidget("head-tilt-left"));
      break;
    case "blunt":
      fidgets.push(getFidget("arm-cross"));
      fidgets.push(getFidget("head-tilt-right"));
      fidgets.push(getFidget("lean-forward"));
      fidgets.push(getFidget("shoulder-roll"));
      break;
    case "analytical":
      fidgets.push(getFidget("chin-raise"));
      fidgets.push(getFidget("lean-back"));
      fidgets.push(getFidget("note-writing"));
      fidgets.push(getFidget("head-tilt-left"));
      break;
    case "skeptical":
      fidgets.push(getFidget("look-around"));
      fidgets.push(getFidget("lean-back"));
      fidgets.push(getFidget("arm-cross"));
      fidgets.push(getFidget("head-tilt-right"));
      break;
    case "socratic":
      fidgets.push(getFidget("chin-raise"));
      fidgets.push(getFidget("lean-back"));
      fidgets.push(getFidget("head-tilt-left"));
      fidgets.push(getFidget("look-around"));
      break;
    case "emotional":
      fidgets.push(getFidget("lean-forward"));
      fidgets.push(getFidget("head-tilt-left"));
      fidgets.push(getFidget("head-tilt-right"));
      fidgets.push(getFidget("shoulder-roll"));
      break;
    case "supportive":
    default:
      fidgets.push(getFidget("head-tilt-left"));
      fidgets.push(getFidget("lean-forward"));
      fidgets.push(getFidget("look-around"));
      break;
  }

  // Accessory-specific fidgets
  if (accessory === "glasses") {
    fidgets.push(getFidget("glasses-push"));
    fidgets.push(getFidget("glasses-adjust"));
  } else if (accessory === "hat") {
    fidgets.push(getFidget("hat-adjust"));
  } else if (accessory === "bowtie") {
    fidgets.push(getFidget("bowtie-touch"));
  }

  // High toughness personas get phone-check and pen-tap (impatient gestures)
  if (stats.patience <= 4) {
    fidgets.push(getFidget("pen-tap"));
    fidgets.push(getFidget("finger-drum"));
  }

  return {
    breatheDuration,
    breatheAmplitude,
    fidgets,
    fidgetIntervalMin,
    fidgetIntervalMax,
    eyeRestlessness,
  };
}
