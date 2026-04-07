import { useState, useRef, useCallback, useEffect } from "react";

export interface ProsodyFrame {
  time: number;         // seconds since start
  volume: number;       // 0-100
  pitch: number;        // Hz
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

  // Adaptive volume calibration — learn the user's mic range over
  // the first few seconds of speech, then map their dynamic range to 0-100.
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationDoneRef = useRef(false);
  const rmsFloorRef = useRef(0);       // quiet baseline (10th percentile)
  const rmsCeilingRef = useRef(0.25);  // loud baseline (90th percentile, default ~-12 dB)

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
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      volumeHistoryRef.current = [];
      pitchHistoryRef.current = [];
      silentFramesRef.current = 0;
      totalFramesRef.current = 0;
      calibrationSamplesRef.current = [];
      calibrationDoneRef.current = false;
      rmsFloorRef.current = 0;
      rmsCeilingRef.current = 0.25;

      setIsAnalyzing(true);
      analysisStartRef.current = Date.now();
      lastFrameLogRef.current = Date.now();
      timelineRef.current = [];
      analyze();
    } catch (err) {
      console.error("Failed to start prosody analysis:", err);
    }
  }, []);

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

    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const tick = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(timeData);
      analyserRef.current.getByteFrequencyData(freqData);

      // Volume (RMS of time-domain data → adaptive 0-100 scale)
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (timeData[i] - 128) / 128;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      // --- Adaptive calibration ---
      // Collect RMS samples for the first ~3 s of non-silent speech,
      // then derive floor / ceiling from percentiles.
      const RAW_SILENCE = 0.01; // RMS below this is silence, pre-calibration
      if (!calibrationDoneRef.current) {
        if (rms > RAW_SILENCE) {
          calibrationSamplesRef.current.push(rms);
        }
        // After 30 speech samples (~3 s at 100 ms logging rate) finalise
        if (calibrationSamplesRef.current.length >= 30) {
          const sorted = [...calibrationSamplesRef.current].sort((a, b) => a - b);
          rmsFloorRef.current = sorted[Math.floor(sorted.length * 0.10)];
          rmsCeilingRef.current = Math.max(
            sorted[Math.floor(sorted.length * 0.90)],
            rmsFloorRef.current + 0.005 // ensure non-zero range
          );
          calibrationDoneRef.current = true;
        }
      }

      // Map raw RMS to 0-100 using calibrated range.
      // Floor → ~10, Ceiling → ~90, with headroom above/below.
      const floor = rmsFloorRef.current;
      const ceiling = rmsCeilingRef.current;
      const range = ceiling - floor;
      let volume: number;
      if (rms <= RAW_SILENCE) {
        volume = 0;
      } else if (range > 0) {
        // Linear map: floor→10, ceiling→90
        volume = Math.round(10 + ((rms - floor) / range) * 80);
        volume = Math.max(0, Math.min(100, volume));
      } else {
        // Fallback before calibration completes — generous scaling
        volume = Math.min(100, Math.round(rms * 500));
      }

      // Pitch estimation (autocorrelation on time-domain data)
      const pitch = estimatePitch(timeData, audioContextRef.current?.sampleRate || 44100);

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

      // Log timeline frame every 100ms (not every rAF which is 16ms)
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
  }, []);

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
    startAnalysis,
    stopAnalysis,
    getTimeline,
  };
}

/**
 * YIN pitch estimation (de Cheveigné & Kawahara, 2002).
 *
 * Operates on the byte-domain time buffer from AnalyserNode.  The algorithm:
 *   1. Compute the difference function d(τ).
 *   2. Compute the cumulative mean normalised difference d'(τ).
 *   3. Pick the first τ where d'(τ) < threshold (0.15 — generous enough for
 *      noisy real-world speech while still rejecting unvoiced frames).
 *   4. Parabolic interpolation around the chosen τ for sub-sample accuracy.
 *
 * Accepts pitches in the 50-500 Hz human-speech range only.
 */
function estimatePitch(buffer: Uint8Array, sampleRate: number): number {
  const SIZE = buffer.length;
  const halfSize = Math.floor(SIZE / 2);

  // Convert Uint8Array (0-255, centre 128) to float (-1..1)
  const float = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    float[i] = (buffer[i] - 128) / 128;
  }

  // --- Step 1: Difference function d(τ) ---
  const d = new Float32Array(halfSize);
  for (let tau = 0; tau < halfSize; tau++) {
    let sum = 0;
    for (let i = 0; i < halfSize; i++) {
      const delta = float[i] - float[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // --- Step 2: Cumulative mean normalised difference d'(τ) ---
  const dPrime = new Float32Array(halfSize);
  dPrime[0] = 1; // defined as 1 for τ=0
  let runningSum = 0;
  for (let tau = 1; tau < halfSize; tau++) {
    runningSum += d[tau];
    dPrime[tau] = d[tau] / (runningSum / tau);
  }

  // --- Step 3: Absolute threshold ---
  // Find the first tau in the valid pitch range where d'(τ) < threshold,
  // then pick the minimum in that dip.
  const YIN_THRESHOLD = 0.15;
  const minPeriod = Math.floor(sampleRate / 500); // 500 Hz upper bound
  const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz lower bound

  let bestTau = -1;
  for (let tau = minPeriod; tau < Math.min(maxPeriod, halfSize); tau++) {
    if (dPrime[tau] < YIN_THRESHOLD) {
      // Walk forward to find the local minimum in this dip
      while (tau + 1 < halfSize && dPrime[tau + 1] < dPrime[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau < 1) return 0;

  // --- Step 4: Parabolic interpolation for sub-sample accuracy ---
  let betterTau = bestTau;
  if (bestTau > 0 && bestTau < halfSize - 1) {
    const s0 = dPrime[bestTau - 1];
    const s1 = dPrime[bestTau];
    const s2 = dPrime[bestTau + 1];
    const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
    if (isFinite(shift)) {
      betterTau = bestTau + shift;
    }
  }

  const pitch = sampleRate / betterTau;

  // Final sanity check — human speech range
  if (pitch < 50 || pitch > 500) return 0;
  return pitch;
}
