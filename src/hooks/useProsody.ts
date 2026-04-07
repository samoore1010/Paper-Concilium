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

      // Volume (RMS of time-domain data)
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (timeData[i] - 128) / 128;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const volume = Math.min(100, Math.round(rms * 300));

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

// Simple autocorrelation-based pitch estimation
function estimatePitch(buffer: Uint8Array, sampleRate: number): number {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;

  const correlations = new Float32Array(MAX_SAMPLES);

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs((buffer[i] - 128) / 128 - (buffer[i + offset] - 128) / 128);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation) {
      // Found a peak, now declining
      break;
    }
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    return sampleRate / bestOffset;
  }
  return 0;
}
