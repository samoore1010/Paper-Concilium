import { useState, useRef, useCallback, useEffect } from "react";

export interface RecordingData {
  blob: Blob | null;
  url: string;
  duration: number;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: (externalStream?: MediaStream) => Promise<void>;
  stopRecording: () => Promise<RecordingData>;
  getRecording: () => RecordingData;
  /** Mix a TTS audio blob into the recording stream (audience/character audio) */
  mixAudioBlob: (blob: Blob) => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef("");
  const mimeTypeRef = useRef("");

  const ownsStreamRef = useRef(true);

  // Web Audio mixing graph: combines mic + TTS into one stream for recording
  const mixContextRef = useRef<AudioContext | null>(null);
  const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startRecording = useCallback(async (externalStream?: MediaStream) => {
    try {
      let stream: MediaStream;
      if (externalStream) {
        stream = externalStream;
        ownsStreamRef.current = false;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        ownsStreamRef.current = true;
      }

      // Set up Web Audio mixing graph: mic + TTS → destination → MediaRecorder
      const mixContext = new AudioContext();
      const destination = mixContext.createMediaStreamDestination();
      const micSource = mixContext.createMediaStreamSource(stream);
      micSource.connect(destination);

      mixContextRef.current = mixContext;
      mixDestinationRef.current = destination;
      micSourceRef.current = micSource;

      // Record from the mixed destination stream (mic + any TTS mixed in)
      const recordStream = destination.stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(recordStream, { mimeType, audioBitsPerSecond: 128000 });

      chunksRef.current = [];
      blobRef.current = null;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
      mimeTypeRef.current = mimeType;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(500); // Collect data every 500ms for more granular chunks
      startTimeRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      console.log(`[Recorder] Started with audio mixing graph (${mimeType})`);
    } catch (err) {
      console.error("[Recorder] Failed to start:", err);
    }
  }, []);

  // Mix a TTS audio blob into the recording (audience/character voices).
  // Decodes the blob and plays it through the mixing graph so it gets captured
  // by the MediaRecorder alongside the user's mic audio.
  const mixAudioBlob = useCallback((blob: Blob) => {
    const ctx = mixContextRef.current;
    const dest = mixDestinationRef.current;
    if (!ctx || !dest || ctx.state === "closed") return;

    blob.arrayBuffer().then((arrayBuffer) => {
      return ctx.decodeAudioData(arrayBuffer);
    }).then((audioBuffer) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.start();
      console.log(`[Recorder] Mixed TTS audio (${(blob.size / 1024).toFixed(1)}KB, ${audioBuffer.duration.toFixed(1)}s)`);
    }).catch((err) => {
      console.warn("[Recorder] Failed to mix TTS audio:", err);
    });
  }, []);

  // Stop recording and wait for all data to be flushed
  const stopRecording = useCallback((): Promise<RecordingData> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve({ blob: null, url: "", duration: 0 });
        return;
      }

      const duration = (Date.now() - startTimeRef.current) / 1000;

      // Wait for the onstop event which fires AFTER all ondataavailable events
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);

        blobRef.current = blob;
        urlRef.current = url;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        // Tear down the mixing graph
        if (micSourceRef.current) micSourceRef.current.disconnect();
        if (mixContextRef.current && mixContextRef.current.state !== "closed") {
          mixContextRef.current.close();
        }
        micSourceRef.current = null;
        mixContextRef.current = null;
        mixDestinationRef.current = null;

        console.log(`[Recorder] Stopped: ${(blob.size / 1024).toFixed(1)}KB, ${duration.toFixed(1)}s, ${chunksRef.current.length} chunks`);
        resolve({ blob, url, duration });
      };

      // Stop the recorder; only stop stream tracks if we own the stream
      recorder.stop();
      if (ownsStreamRef.current) {
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    });
  }, []);

  const getRecording = useCallback((): RecordingData => {
    return {
      blob: blobRef.current,
      url: urlRef.current,
      duration: startTimeRef.current > 0 ? (Date.now() - startTimeRef.current) / 1000 : 0,
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        if (ownsStreamRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        }
      }
      // Clean up mixing graph
      if (micSourceRef.current) micSourceRef.current.disconnect();
      if (mixContextRef.current && mixContextRef.current.state !== "closed") {
        mixContextRef.current.close();
      }
      // Don't revoke URL here — the consumer (FeedbackView) still needs it after unmount
    };
  }, []);

  /** Return the epoch ms when recording started (for cross-hook synchronization) */
  const getStartTime = useCallback(() => startTimeRef.current, []);

  return { isRecording, startRecording, stopRecording, getRecording, mixAudioBlob, getStartTime };
}
