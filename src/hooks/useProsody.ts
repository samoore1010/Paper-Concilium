import { useState, useRef, useCallback, useEffect } from "react";
import { yinPitchDetect, hasVoiceEnergy } from "../audio/yinPitch";

export interface ProsodyFrame {
  time: number;         // seconds since start
  volume: number;       // 0-100 (calibrated)
  pitch: number;        // Hz (YIN algorithm)
  energy: number;       // 0-100
  isSilent: boolean;
}

export interface ProsodyMetrics {
  currentVolume: number;
  averageVolume: number;
  volumeVariation: number;
  currentPitch: number;
  pitchVariation: number;
  energyLevel: number;
  silenceRatio: number;
}

export interface CalibrationState {
  status: "idle" | "calibrating" | "done";
  baselineRms: number;     // user's normal speaking level (raw RMS)
  progress: number;        // 0-1
}

const INITIAL_METRICS: ProsodyMetrics = {
  currentVolume: 0,
  averageVolume: 0,
  volumeVariation: 0,
  currentPitch: 0,
  pitchVariation: 0,
  energyLevel: 0,
  silenceRatio: 0,
};

export function useProsody() {
  const [metrics, setMetrics] = useState<ProsodyMetrics>(INITIAL_METRICS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationState>({
    status: "idle",
    baselineRms: 0.03, // sensible default — will be overridden by calibration
    progress: 0,
  });
  const timelineRef = useRef<ProsodyFrame[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  // Rolling history for averages
  const volumeHistoryRef = useRef<number[]>([]);
  const pitchHistoryRef = useRef<number[]>([]);
  const silentFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const analysisStartRef = useRef(0);
  const lastFrameLogRef = useRef(0);

  const SILENCE_THRESHOLD = 10; // Volume below this = silence
  const ownsStreamRef = useRef(true);

  // Calibration data
  const calibrationRef = useRef({
    baselineRms: 0.03,
    rmsAccumulator: [] as number[],
    isCalibrating: false,
    calibrationStartTime: 0,
  });

  // Float32 buffer for YIN (reused to avoid GC pressure)
  const floatBufferRef = useRef<Float32Array | null>(null);

  /**
   * Convert raw RMS to calibrated 0-100 volume.
   * Maps the user's baseline speaking level to ~55 (comfortable middle),
   * with headroom for loud projection up to 100.
   */
  const rmsToVolume = useCallback((rms: number): number => {
    const baseline = calibrationRef.current.baselineRms;
    if (baseline <= 0) return 0;
    // Normalize so baseline = 55, with log scaling for natural perception
    // This follows the Weber-Fechner law: perceived loudness ∝ log(intensity)
    const ratio = rms / baseline;
    if (ratio < 0.01) return 0;
    // log2(1) = 0 → 55, log2(2) = 1 → 80, log2(0.5) = -1 → 30
    const logScale = Math.log2(ratio);
    const volume = 55 + logScale * 25;
    return Math.max(0, Math.min(100, Math.round(volume)));
  }, []);

  /**
   * Start calibration: records 3 seconds of speech to establish baseline.
   * Call this before or at the start of the session.
   */
  const startCalibration = useCallback((externalStream?: MediaStream) => {
    calibrationRef.current.isCalibrating = true;
    calibrationRef.current.rmsAccumulator = [];
    calibrationRef.current.calibrationStartTime = Date.now();
    setCalibration({ status: "calibrating", baselineRms: 0, progress: 0 });

    // If we already have an analyser running, calibration happens in the main tick loop.
    // If not, we need to set up a temporary one.
    if (!analyserRef.current && externalStream) {
      // Will be handled when startAnalysis is called
    }
  }, []);

  /**
   * Skip calibration and use a sensible default.
   */
  const skipCalibration = useCallback(() => {
    calibrationRef.current.isCalibrating = false;
    calibrationRef.current.baselineRms = 0.03;
    setCalibration({ status: "done", baselineRms: 0.03, progress: 1 });
  }, []);

  const startAnalysis = useCallback(async (externalStream?: MediaStream) => {
    try {
      let stream: MediaStream;
      if (externalStream) {
        stream = externalStream;
        ownsStreamRef.current = false;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ownsStreamRef.current = true;
      }
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      // Use 4096 FFT for better low-frequency resolution (important for male voices ~85-180Hz)
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3; // Less smoothing = more responsive pitch tracking

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      // Pre-allocate float buffer for YIN
      floatBufferRef.current = new Float32Array(analyser.fftSize);

      volumeHistoryRef.current = [];
      pitchHistoryRef.current = [];
      silentFramesRef.current = 0;
      totalFramesRef.current = 0;

      setIsAnalyzing(true);
      analysisStartRef.current = Date.now();
      lastFrameLogRef.current = Date.now();
      timelineRef.current = [];

      // Auto-start calibration if not already done
      if (calibration.status === "idle") {
        calibrationRef.current.isCalibrating = true;
        calibrationRef.current.rmsAccumulator = [];
        calibrationRef.current.calibrationStartTime = Date.now();
        setCalibration({ status: "calibrating", baselineRms: 0, progress: 0 });
      }

      analyze();
    } catch (err) {
      console.error("Failed to start prosody analysis:", err);
    }
  }, [calibration.status]);

  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    cancelAnimationFrame(rafRef.current);

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      if (ownsStreamRef.current) {
        const stream = sourceRef.current.mediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    analyserRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
  }, []);

  const analyze = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;

    const tick = () => {
      if (!analyserRef.current || !floatBufferRef.current) return;
      const floatData = floatBufferRef.current;
      const sampleRate = audioContextRef.current?.sampleRate || 44100;

      // Get float time-domain data (32-bit precision for YIN)
      analyserRef.current.getFloatTimeDomainData(floatData);

      // Volume: RMS of float samples (already -1 to 1)
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        sumSquares += floatData[i] * floatData[i];
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      // Handle calibration
      if (calibrationRef.current.isCalibrating) {
        const elapsed = Date.now() - calibrationRef.current.calibrationStartTime;
        const CALIBRATION_DURATION = 3000; // 3 seconds
        const progress = Math.min(1, elapsed / CALIBRATION_DURATION);

        // Only accumulate non-silent frames for baseline
        if (rms > 0.005) {
          calibrationRef.current.rmsAccumulator.push(rms);
        }

        if (elapsed >= CALIBRATION_DURATION) {
          calibrationRef.current.isCalibrating = false;
          const samples = calibrationRef.current.rmsAccumulator;
          if (samples.length > 10) {
            // Use median for robustness against outliers (coughs, mic bumps)
            const sorted = [...samples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            calibrationRef.current.baselineRms = median;
            setCalibration({ status: "done", baselineRms: median, progress: 1 });
            console.log(`[Prosody] Calibration complete: baseline RMS = ${median.toFixed(4)} (${samples.length} samples)`);
          } else {
            // Not enough voiced samples — use default
            calibrationRef.current.baselineRms = 0.03;
            setCalibration({ status: "done", baselineRms: 0.03, progress: 1 });
            console.log("[Prosody] Calibration: not enough speech, using default baseline");
          }
        } else {
          setCalibration((prev) => ({ ...prev, progress }));
        }
      }

      // Convert RMS to calibrated volume
      const volume = rmsToVolume(rms);

      // Pitch: YIN algorithm on float data (only if there's voice energy)
      let pitch = 0;
      if (hasVoiceEnergy(floatData, 0.008)) {
        pitch = yinPitchDetect(floatData, sampleRate, 0.15);
        // Sanity check: human speech is 50-500 Hz
        if (pitch < 50 || pitch > 500) pitch = 0;
      }

      // Track history
      volumeHistoryRef.current.push(volume);
      if (pitch > 0) pitchHistoryRef.current.push(pitch);
      totalFramesRef.current++;
      if (volume < SILENCE_THRESHOLD) silentFramesRef.current++;

      // Keep history bounded
      if (volumeHistoryRef.current.length > 500) volumeHistoryRef.current = volumeHistoryRef.current.slice(-500);
      if (pitchHistoryRef.current.length > 500) pitchHistoryRef.current = pitchHistoryRef.current.slice(-500);

      // Compute derived metrics
      const vols = volumeHistoryRef.current;
      const avgVol = vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
      const volStd = vols.length > 1 ? Math.sqrt(vols.reduce((s, v) => s + (v - avgVol) ** 2, 0) / vols.length) : 0;
      const volumeVariation = Math.min(100, Math.round(volStd * 3));

      const pitches = pitchHistoryRef.current;
      const avgPitch = pitches.length > 0 ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
      const pitchStd = pitches.length > 1 ? Math.sqrt(pitches.reduce((s, p) => s + (p - avgPitch) ** 2, 0) / pitches.length) : 0;
      const pitchVariation = Math.min(100, Math.round(pitchStd * 2));

      const silenceRatio = totalFramesRef.current > 0
        ? Math.round((silentFramesRef.current / totalFramesRef.current) * 100)
        : 0;

      const energyLevel = Math.min(100, Math.round((avgVol * 0.6 + volumeVariation * 0.2 + pitchVariation * 0.2)));

      setMetrics({
        currentVolume: volume,
        averageVolume: Math.round(avgVol),
        volumeVariation,
        currentPitch: Math.round(pitch),
        pitchVariation,
        energyLevel,
        silenceRatio,
      });

      // Log timeline frame every 100ms (not every rAF which is ~16ms)
      const frameNow = Date.now();
      if (frameNow - lastFrameLogRef.current >= 100) {
        lastFrameLogRef.current = frameNow;
        const timeSec = (frameNow - analysisStartRef.current) / 1000;
        timelineRef.current.push({
          time: Math.round(timeSec * 10) / 10,
          volume,
          pitch: Math.round(pitch),
          energy: energyLevel,
          isSilent: volume < SILENCE_THRESHOLD,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [rmsToVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        if (ownsStreamRef.current) {
          sourceRef.current.mediaStream.getTracks().forEach((t) => t.stop());
        }
      }
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const getTimeline = useCallback(() => [...timelineRef.current], []);

  return {
    metrics,
    isAnalyzing,
    calibration,
    startAnalysis,
    stopAnalysis,
    startCalibration,
    skipCalibration,
    getTimeline,
  };
}
