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

/** Spring physics configuration for reaction animations */
export interface ReactionSpringConfig {
  /** Spring stiffness for primary reaction motion (50-300) */
  stiffness: number;
  /** Spring damping for primary reaction (5-30) */
  damping: number;
  /** Mass factor affecting momentum (0.5-2.0) */
  mass: number;
  /** Delay in ms before secondary motion (shoulders) follows primary (head) */
  secondaryDelay: number;
  /** Delay in ms before accessories follow head motion */
  accessoryDelay: number;
  /** Settling duration in seconds — how long damped return to neutral takes */
  settlingDuration: number;
  /** Overshoot factor (0-1) — how much the spring overshoots target. Higher = bouncier */
  overshoot: number;
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
  /** Spring physics config for reaction animations */
  reactionSpring: ReactionSpringConfig;
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

  // Spring physics — personality-driven reaction motion character
  let reactionSpring: ReactionSpringConfig;

  switch (communicationStyle) {
    case "confrontational":
      // Aggressive: fast breathing, restless — snappy, high-energy springs
      breatheDuration = 2.8;
      breatheAmplitude = 1.3;
      eyeRestlessness = 1.6;
      fidgetIntervalMin = 3;
      fidgetIntervalMax = 7;
      reactionSpring = { stiffness: 280, damping: 12, mass: 0.8, secondaryDelay: 60, accessoryDelay: 100, settlingDuration: 0.5, overshoot: 0.7 };
      break;
    case "blunt":
      // Direct: medium-fast breathing, moderate restlessness — firm, precise springs
      breatheDuration = 3.2;
      breatheAmplitude = 1.2;
      eyeRestlessness = 1.3;
      fidgetIntervalMin = 4;
      fidgetIntervalMax = 8;
      reactionSpring = { stiffness: 240, damping: 16, mass: 1.0, secondaryDelay: 80, accessoryDelay: 120, settlingDuration: 0.6, overshoot: 0.5 };
      break;
    case "analytical":
      // Measured: slow breathing, calm — stiff, precise nods with minimal overshoot
      breatheDuration = 4.5;
      breatheAmplitude = 0.9;
      eyeRestlessness = 0.8;
      fidgetIntervalMin = 6;
      fidgetIntervalMax = 12;
      reactionSpring = { stiffness: 200, damping: 22, mass: 1.2, secondaryDelay: 120, accessoryDelay: 180, settlingDuration: 0.9, overshoot: 0.2 };
      break;
    case "skeptical":
      // Watchful: medium breathing, alert eyes — moderate tension, guarded springs
      breatheDuration = 3.8;
      breatheAmplitude = 1.0;
      eyeRestlessness = 1.4;
      fidgetIntervalMin = 5;
      fidgetIntervalMax = 10;
      reactionSpring = { stiffness: 220, damping: 18, mass: 1.1, secondaryDelay: 100, accessoryDelay: 150, settlingDuration: 0.7, overshoot: 0.35 };
      break;
    case "socratic":
      // Thoughtful: slow deep breathing, occasional movement — deliberate, measured motion
      breatheDuration = 5.0;
      breatheAmplitude = 1.1;
      eyeRestlessness = 0.9;
      fidgetIntervalMin = 7;
      fidgetIntervalMax = 12;
      reactionSpring = { stiffness: 150, damping: 24, mass: 1.4, secondaryDelay: 150, accessoryDelay: 200, settlingDuration: 1.0, overshoot: 0.15 };
      break;
    case "emotional":
      // Expressive: variable breathing, animated — bouncy, high-energy springs
      breatheDuration = 3.5;
      breatheAmplitude = 1.2;
      eyeRestlessness = 1.2;
      fidgetIntervalMin = 4;
      fidgetIntervalMax = 9;
      reactionSpring = { stiffness: 260, damping: 10, mass: 0.7, secondaryDelay: 50, accessoryDelay: 80, settlingDuration: 0.5, overshoot: 0.8 };
      break;
    case "supportive":
    default:
      // Calm: steady breathing, gentle movement — soft, gentle springs
      breatheDuration = 4.2;
      breatheAmplitude = 1.0;
      eyeRestlessness = 0.7;
      fidgetIntervalMin = 6;
      fidgetIntervalMax = 11;
      reactionSpring = { stiffness: 160, damping: 20, mass: 1.0, secondaryDelay: 130, accessoryDelay: 170, settlingDuration: 0.8, overshoot: 0.3 };
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

  // Toughness adjusts spring character: tough characters react more sharply
  if (stats.toughness >= 8) {
    reactionSpring.stiffness = Math.min(300, reactionSpring.stiffness * 1.15);
    reactionSpring.damping *= 0.85;
    reactionSpring.settlingDuration *= 0.8;
  } else if (stats.toughness <= 3) {
    reactionSpring.stiffness *= 0.85;
    reactionSpring.damping *= 1.15;
    reactionSpring.settlingDuration *= 1.2;
  }

  return {
    breatheDuration,
    breatheAmplitude,
    fidgets,
    fidgetIntervalMin,
    fidgetIntervalMax,
    eyeRestlessness,
    reactionSpring,
  };
}
