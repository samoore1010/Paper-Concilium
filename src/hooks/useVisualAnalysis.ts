import { useRef, useState, useCallback } from "react";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ---------- Public types ----------

export interface VisualMetrics {
  /** Eye contact percentage (0-100) over rolling window */
  eyeContactPercent: number;
  /** Total seconds of eye contact */
  eyeContactSeconds: number;
  /** Facial expressiveness score (0-100) */
  expressiveness: number;
  /** Total hand gesture count */
  gestureCount: number;
  /** Whether hands are currently visible */
  handsVisible: boolean;
  /** Framing quality: "good" | "too-close" | "too-far" | "off-center" | "no-face" */
  framing: string;
}

export interface VisualFrame {
  time: number;
  eyeContact: boolean;
  handsVisible: boolean;
  expressiveness: number;
  framing: string;
}

export interface VisualMetricsSnapshot {
  eyeContactPercent: number;
  eyeContactSeconds: number;
  expressiveness: number;
  gestureCount: number;
  framing: string;
}

// ---------- Constants ----------

const ANALYSIS_FPS = 10;
const ANALYSIS_INTERVAL = 1000 / ANALYSIS_FPS;
const ROLLING_WINDOW_SEC = 30;
const ROLLING_WINDOW_FRAMES = ROLLING_WINDOW_SEC * ANALYSIS_FPS;

// Iris landmark indices (FaceMesh 468+ landmarks)
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

// Blendshape names for expressiveness
const EXPRESSIVE_SHAPES = [
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthOpen",
  "cheekSquintLeft",
  "cheekSquintRight",
  "jawOpen",
];

// Gaze threshold: how far off-center the iris can be (as fraction of eye width)
const GAZE_THRESHOLD = 0.28;

// ---------- Helpers ----------

function isGazingAtCamera(landmarks: { x: number; y: number; z: number }[]): boolean {
  if (landmarks.length < 478) return false; // Need iris landmarks

  const leftIris = landmarks[LEFT_IRIS_CENTER];
  const leftInner = landmarks[LEFT_EYE_INNER];
  const leftOuter = landmarks[LEFT_EYE_OUTER];
  const rightIris = landmarks[RIGHT_IRIS_CENTER];
  const rightInner = landmarks[RIGHT_EYE_INNER];
  const rightOuter = landmarks[RIGHT_EYE_OUTER];

  // Horizontal gaze: iris position relative to eye corners (0 = outer, 1 = inner)
  const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x);
  const rightEyeWidth = Math.abs(rightInner.x - rightOuter.x);
  if (leftEyeWidth < 0.001 || rightEyeWidth < 0.001) return false;

  const leftRatio = (leftIris.x - leftOuter.x) / leftEyeWidth;
  const rightRatio = (rightIris.x - rightOuter.x) / rightEyeWidth;

  // Center is ~0.5; deviation from center indicates looking away
  const leftDeviation = Math.abs(leftRatio - 0.5);
  const rightDeviation = Math.abs(rightRatio - 0.5);

  return leftDeviation < GAZE_THRESHOLD && rightDeviation < GAZE_THRESHOLD;
}

function getExpressiveness(blendshapes: { categories: { categoryName: string; score: number }[] }[]): number {
  if (!blendshapes || blendshapes.length === 0) return 0;
  const shapes = blendshapes[0].categories;
  let total = 0;
  let count = 0;
  for (const shape of shapes) {
    if (EXPRESSIVE_SHAPES.includes(shape.categoryName)) {
      total += shape.score;
      count++;
    }
  }
  if (count === 0) return 0;
  // Average activation of expressive shapes, scaled to 0-100
  return Math.min(100, Math.round((total / count) * 300));
}

function getFraming(landmarks: { x: number; y: number }[]): string {
  if (landmarks.length === 0) return "no-face";

  // Use nose tip (landmark 1) and face bounds for framing check
  const nose = landmarks[1];

  // Check centering (nose should be roughly in center third)
  if (nose.x < 0.25 || nose.x > 0.75) return "off-center";

  // Estimate face size from chin (152) to forehead (10)
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const faceHeight = Math.abs(chin.y - forehead.y);

  if (faceHeight > 0.7) return "too-close";
  if (faceHeight < 0.15) return "too-far";

  return "good";
}

// ---------- Hook ----------

export function useVisualAnalysis() {
  const [metrics, setMetrics] = useState<VisualMetrics>({
    eyeContactPercent: 0,
    eyeContactSeconds: 0,
    expressiveness: 0,
    gestureCount: 0,
    handsVisible: false,
    framing: "no-face",
  });
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);

  // Rolling window for eye contact
  const eyeContactWindowRef = useRef<boolean[]>([]);
  // Rolling window for expressiveness
  const expressWindowRef = useRef<number[]>([]);
  // Gesture tracking: transition from no-hands to hands-visible counts as a gesture
  const prevHandsVisibleRef = useRef(false);
  const gestureCountRef = useRef(0);
  // Timeline
  const timelineRef = useRef<VisualFrame[]>([]);

  const initModels = useCallback(async () => {
    if (faceLandmarkerRef.current) return true;
    setLoading(true);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const [faceLandmarker, handLandmarker] = await Promise.all([
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        }),
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        }),
      ]);

      faceLandmarkerRef.current = faceLandmarker;
      handLandmarkerRef.current = handLandmarker;
      setAvailable(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.warn("MediaPipe visual analysis unavailable:", err);
      setAvailable(false);
      setLoading(false);
      return false;
    }
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    const handLandmarker = handLandmarkerRef.current;
    if (!video || !faceLandmarker || !handLandmarker) return;
    if (video.readyState < 2) return; // Not enough data

    const timestamp = performance.now();
    const elapsed = (Date.now() - startTimeRef.current) / 1000;

    let faceResult: FaceLandmarkerResult | null = null;
    let handResult: HandLandmarkerResult | null = null;

    try {
      faceResult = faceLandmarker.detectForVideo(video, timestamp);
    } catch {
      // Skip frame on error
    }
    try {
      handResult = handLandmarker.detectForVideo(video, timestamp);
    } catch {
      // Skip frame on error
    }

    // Eye contact
    const hasEyeContact =
      faceResult &&
      faceResult.faceLandmarks.length > 0 &&
      isGazingAtCamera(faceResult.faceLandmarks[0]);
    eyeContactWindowRef.current.push(!!hasEyeContact);
    if (eyeContactWindowRef.current.length > ROLLING_WINDOW_FRAMES) {
      eyeContactWindowRef.current.shift();
    }
    const ecWindow = eyeContactWindowRef.current;
    const ecPercent = ecWindow.length > 0
      ? Math.round((ecWindow.filter(Boolean).length / ecWindow.length) * 100)
      : 0;

    // Total eye contact seconds (from all frames, not just window)
    const totalEcFrames = timelineRef.current.filter((f) => f.eyeContact).length + (hasEyeContact ? 1 : 0);
    const ecSeconds = Math.round((totalEcFrames / ANALYSIS_FPS) * 10) / 10;

    // Expressiveness
    const express =
      faceResult && faceResult.faceBlendshapes
        ? getExpressiveness(faceResult.faceBlendshapes)
        : 0;
    expressWindowRef.current.push(express);
    if (expressWindowRef.current.length > ROLLING_WINDOW_FRAMES) {
      expressWindowRef.current.shift();
    }
    const avgExpress = Math.round(
      expressWindowRef.current.reduce((a, b) => a + b, 0) / expressWindowRef.current.length
    );

    // Hands
    const handsVisible = !!(handResult && handResult.landmarks.length > 0);
    if (handsVisible && !prevHandsVisibleRef.current) {
      gestureCountRef.current++;
    }
    prevHandsVisibleRef.current = handsVisible;

    // Framing
    const framing =
      faceResult && faceResult.faceLandmarks.length > 0
        ? getFraming(faceResult.faceLandmarks[0])
        : "no-face";

    // Save frame
    timelineRef.current.push({
      time: elapsed,
      eyeContact: !!hasEyeContact,
      handsVisible,
      expressiveness: express,
      framing,
    });

    setMetrics({
      eyeContactPercent: ecPercent,
      eyeContactSeconds: ecSeconds,
      expressiveness: avgExpress,
      gestureCount: gestureCountRef.current,
      handsVisible,
      framing,
    });
  }, []);

  const start = useCallback(
    async (videoElement: HTMLVideoElement) => {
      videoRef.current = videoElement;
      const ok = await initModels();
      if (!ok) return;

      // Reset state
      eyeContactWindowRef.current = [];
      expressWindowRef.current = [];
      prevHandsVisibleRef.current = false;
      gestureCountRef.current = 0;
      timelineRef.current = [];
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(analyzeFrame, ANALYSIS_INTERVAL);
    },
    [initModels, analyzeFrame]
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const getTimeline = useCallback((): VisualFrame[] => {
    return [...timelineRef.current];
  }, []);

  const getSnapshot = useCallback((): VisualMetricsSnapshot => {
    const frames = timelineRef.current;
    const ecFrames = frames.filter((f) => f.eyeContact).length;
    const ecPercent = frames.length > 0 ? Math.round((ecFrames / frames.length) * 100) : 0;
    const ecSeconds = Math.round((ecFrames / ANALYSIS_FPS) * 10) / 10;
    const avgExpress =
      frames.length > 0
        ? Math.round(frames.reduce((s, f) => s + f.expressiveness, 0) / frames.length)
        : 0;
    // Most common framing
    const framingCounts: Record<string, number> = {};
    for (const f of frames) {
      framingCounts[f.framing] = (framingCounts[f.framing] || 0) + 1;
    }
    let bestFraming = "no-face";
    let bestCount = 0;
    for (const [k, v] of Object.entries(framingCounts)) {
      if (v > bestCount) { bestFraming = k; bestCount = v; }
    }

    return {
      eyeContactPercent: ecPercent,
      eyeContactSeconds: ecSeconds,
      expressiveness: avgExpress,
      gestureCount: gestureCountRef.current,
      framing: bestFraming,
    };
  }, []);

  return {
    metrics,
    available,
    loading,
    start,
    stop,
    getTimeline,
    getSnapshot,
  };
}
