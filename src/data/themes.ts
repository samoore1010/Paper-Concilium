export interface BackgroundElement {
  type: "podium" | "bench" | "lectern" | "table" | "spotlight" | "curtain" | "gavel" | "screen";
  position: "bottom-center" | "top-center" | "left" | "right" | "center";
}

export interface AmbientEffect {
  type: "particles" | "spotlight-rays" | "lens-flare" | "glow-pulse";
  color: string;
  intensity: "subtle" | "medium";
}

export type CharacterPosture = "seated-formal" | "seated-relaxed" | "seated-row" | "seated-boardroom" | "standing-neutral";

export interface CharacterContext {
  /** Default character posture in this room */
  posture: CharacterPosture;
  /** Gesture animation scale multiplier (0.6 = restrained, 1.0 = normal, 1.3 = energetic) */
  gestureScale: number;
  /** Which fidget types are appropriate in this room context */
  allowedFidgetCategories: ("head" | "hands" | "body" | "accessory")[];
  /** SVG element rendered beneath each character to ground them in the space */
  seatingProp?: {
    type: "chair" | "bench-seat" | "statement-chair" | "desk-edge" | "theater-seat";
    color: string;
    accentColor?: string;
  };
}

export interface SessionTheme {
  id: string;
  label: string;
  backgroundClass: string;
  accentColor: string;
  accentGlow: string;
  tileLayout: "grid" | "panel" | "semicircle" | "theater";
  backgroundElements: BackgroundElement[];
  ambientEffects: AmbientEffect[];
  transitionLabel: string;
  transitionSubtext: string;
  tileBorderColor: string;
  topBarAccent: string;
  /** How characters should present in this room */
  characterContext: CharacterContext;
}

export const SESSION_THEMES: Record<string, SessionTheme> = {
  "business-pitch": {
    id: "business-pitch",
    label: "Shark Tank",
    backgroundClass: "meeting-bg-business-pitch",
    accentColor: "#d4a017",
    accentGlow: "rgba(212, 160, 23, 0.3)",
    tileLayout: "panel",
    backgroundElements: [
      { type: "podium", position: "bottom-center" },
      { type: "spotlight", position: "top-center" },
    ],
    ambientEffects: [
      { type: "spotlight-rays", color: "#d4a017", intensity: "medium" },
      { type: "particles", color: "#d4a017", intensity: "subtle" },
    ],
    transitionLabel: "Walking into the boardroom...",
    transitionSubtext: "The investors are waiting",
    tileBorderColor: "border-amber-500/30",
    topBarAccent: "from-amber-900/30 to-transparent",
    characterContext: {
      posture: "seated-relaxed",
      gestureScale: 1.3,
      allowedFidgetCategories: ["head", "hands", "body", "accessory"],
      seatingProp: { type: "statement-chair", color: "#2a1f0a", accentColor: "#d4a017" },
    },
  },
  "mock-trial": {
    id: "mock-trial",
    label: "Courtroom",
    backgroundClass: "meeting-bg-mock-trial",
    accentColor: "#8b4513",
    accentGlow: "rgba(139, 69, 19, 0.3)",
    tileLayout: "semicircle",
    backgroundElements: [
      { type: "bench", position: "top-center" },
      { type: "gavel", position: "top-center" },
    ],
    ambientEffects: [
      { type: "glow-pulse", color: "#8b4513", intensity: "subtle" },
    ],
    transitionLabel: "Court is now in session...",
    transitionSubtext: "All rise",
    tileBorderColor: "border-amber-800/30",
    topBarAccent: "from-amber-950/40 to-transparent",
    characterContext: {
      posture: "seated-formal",
      gestureScale: 0.6,
      allowedFidgetCategories: ["head", "accessory"],
      seatingProp: { type: "bench-seat", color: "#3d2b1f", accentColor: "#8b4513" },
    },
  },
  "public-speaking": {
    id: "public-speaking",
    label: "Lecture Hall",
    backgroundClass: "meeting-bg-public-speaking",
    accentColor: "#6366f1",
    accentGlow: "rgba(99, 102, 241, 0.3)",
    tileLayout: "theater",
    backgroundElements: [
      { type: "lectern", position: "bottom-center" },
      { type: "curtain", position: "left" },
      { type: "curtain", position: "right" },
      { type: "spotlight", position: "top-center" },
    ],
    ambientEffects: [
      { type: "spotlight-rays", color: "#6366f1", intensity: "medium" },
      { type: "lens-flare", color: "#818cf8", intensity: "subtle" },
    ],
    transitionLabel: "Stepping up to the podium...",
    transitionSubtext: "The audience awaits",
    tileBorderColor: "border-indigo-500/30",
    topBarAccent: "from-indigo-900/30 to-transparent",
    characterContext: {
      posture: "seated-row",
      gestureScale: 1.0,
      allowedFidgetCategories: ["head", "hands", "body", "accessory"],
      seatingProp: { type: "theater-seat", color: "#2a2050", accentColor: "#6366f1" },
    },
  },
  "sales-demo": {
    id: "sales-demo",
    label: "Boardroom",
    backgroundClass: "meeting-bg-sales-demo",
    accentColor: "#0ea5e9",
    accentGlow: "rgba(14, 165, 233, 0.3)",
    tileLayout: "grid",
    backgroundElements: [
      { type: "screen", position: "top-center" },
      { type: "table", position: "center" },
    ],
    ambientEffects: [
      { type: "glow-pulse", color: "#0ea5e9", intensity: "subtle" },
    ],
    transitionLabel: "Connecting to the boardroom...",
    transitionSubtext: "Your clients are ready",
    tileBorderColor: "border-sky-500/30",
    topBarAccent: "from-sky-900/30 to-transparent",
    characterContext: {
      posture: "seated-boardroom",
      gestureScale: 0.8,
      allowedFidgetCategories: ["head", "hands", "accessory"],
      seatingProp: { type: "desk-edge", color: "#1a2030", accentColor: "#0ea5e9" },
    },
  },
};

export function getTheme(sessionType: string): SessionTheme {
  return SESSION_THEMES[sessionType] || SESSION_THEMES["business-pitch"];
}
