import { useState, useRef, useCallback, useEffect } from "react";

export interface WordTimestamp {
  word: string;
  start: number;   // seconds from session start
  end: number;     // seconds from session start
  isFiller: boolean;
}

const FILLER_WORDS = new Set([
  "um", "uh", "like", "basically", "actually", "literally",
  "honestly", "really",
]);
const FILLER_PHRASES = ["you know", "sort of", "kind of", "i mean", "you know what"];

function isFillerWord(word: string): boolean {
  const lower = word.toLowerCase().replace(/[.,!?;:]/g, "");
  return FILLER_WORDS.has(lower);
}

interface UseElevenLabsSTTReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  consumeNewText: () => string;
  supported: boolean;
  /** Word-level timestamps collected from STT */
  wordTimestamps: WordTimestamp[];
  /** Consume new word timestamps since last call */
  consumeNewTimestamps: () => WordTimestamp[];
}

export function useElevenLabsSTT(): UseElevenLabsSTTReturn {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const finalTranscriptRef = useRef("");
  const lastConsumedRef = useRef(0);
  const lastConsumedTimestampRef = useRef(0);
  const chunksSentRef = useRef(0);
  const activeRef = useRef(false);
  const sessionStartTimeRef = useRef(0);
  const wordTimestampsRef = useRef<WordTimestamp[]>([]);

  const startingRef = useRef(false);

  // Pre-buffer audio chunks before WS is open so the first message arrives immediately
  const pendingChunksRef = useRef<string[]>([]);

  const cleanup = useCallback(() => {
    if (workletRef.current) { try { workletRef.current.disconnect(); } catch {} workletRef.current = null; }
    if (contextRef.current) { contextRef.current.close().catch(() => {}); contextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    pendingChunksRef.current = [];
  }, []);

  useEffect(() => {
    fetch("/api/scribe-token")
      .then((r) => r.json())
      .then((d) => { setSupported(d.available === true); if (d.available) console.log("[EL-STT] Available"); })
      .catch(() => setSupported(false));
  }, []);

  const startListening = useCallback(async () => {
    if (activeRef.current || startingRef.current) return;
    startingRef.current = true;
    activeRef.current = true;
    pendingChunksRef.current = [];
    chunksSentRef.current = 0;
    sessionStartTimeRef.current = Date.now();

    try {

    // --- Step 1: Get microphone access ---
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;

    // --- Step 2: Set up audio pipeline BEFORE opening WebSocket ---
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    contextRef.current = ctx;

    const nativeRate = ctx.sampleRate;
    const downsampleRatio = nativeRate / 16000;
    console.log(`[EL-STT] Native rate: ${nativeRate}Hz, ratio: ${downsampleRatio.toFixed(2)}`);

    // Encoder: convert Float32 buffer → base64 PCM16 string
    function encodeChunk(floatData: Float32Array): string {
      let samples: Float32Array;
      if (downsampleRatio > 1.01) {
        const newLen = Math.floor(floatData.length / downsampleRatio);
        samples = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          samples[i] = floatData[Math.floor(i * downsampleRatio)];
        }
      } else {
        samples = floatData;
      }
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }

    // Handler called from audio pipeline with a ready-to-encode float buffer
    function onAudioChunk(floatData: Float32Array) {
      if (!activeRef.current) return;
      const audioBase64 = encodeChunk(floatData);
      const payload = JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: audioBase64,
        commit: false,
        sample_rate: 16000,
      });

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Flush any pending chunks first
        const pending = pendingChunksRef.current.splice(0);
        for (const p of pending) {
          try { ws.send(p); } catch {}
        }
        try {
          ws.send(payload);
          chunksSentRef.current++;
          if (chunksSentRef.current === 1) console.log(`[EL-STT] First chunk sent (live)`);
          if (chunksSentRef.current % 30 === 0) console.log(`[EL-STT] Chunks: ${chunksSentRef.current}`);
        } catch {}
      } else {
        // WS not open yet — buffer up to 30 chunks (~3s) so we don't lose the start
        if (pendingChunksRef.current.length < 30) {
          pendingChunksRef.current.push(payload);
        }
      }
    }

    // Try AudioWorklet first, fall back to ScriptProcessorNode
    let pipelineReady = false;
    try {
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Float32Array(0);
            this.bufferSize = 2400; // ~50ms at 48kHz (halved for lower latency)
          }
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0 && input[0].length > 0) {
              const chunk = input[0];
              const newBuf = new Float32Array(this.buffer.length + chunk.length);
              newBuf.set(this.buffer);
              newBuf.set(chunk, this.buffer.length);
              this.buffer = newBuf;
              if (this.buffer.length >= this.bufferSize) {
                this.port.postMessage(this.buffer.slice());
                this.buffer = new Float32Array(0);
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent) => {
        onAudioChunk(e.data as Float32Array);
      };

      source.connect(workletNode);
      workletNode.connect(ctx.destination);
      pipelineReady = true;
      console.log("[EL-STT] AudioWorklet pipeline running ✓");
    } catch (workletErr) {
      console.log("[EL-STT] AudioWorklet failed, trying ScriptProcessor...", workletErr);
    }

    if (!pipelineReady) {
      try {
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(ctx.destination);

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputData = e.inputBuffer.getChannelData(0);
          onAudioChunk(new Float32Array(inputData));
        };
        pipelineReady = true;
        console.log("[EL-STT] ScriptProcessor pipeline running ✓");
      } catch (spErr) {
        console.error("[EL-STT] ScriptProcessor also failed:", spErr);
        cleanup();
        activeRef.current = false;
        startingRef.current = false;
        return;
      }
    }

    // --- Step 3: Audio pipeline is running and buffering — NOW open WebSocket ---
    console.log("[EL-STT] Pipeline ready, opening WebSocket...");
    const tokenRes = await fetch("/api/scribe-token");
    if (!tokenRes.ok) throw new Error(`Failed to fetch scribe token (${tokenRes.status})`);
    const tokenData = await tokenRes.json();
    if (!tokenData?.token) throw new Error("Missing scribe token");

    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_code=en&token=${encodeURIComponent(tokenData.token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[EL-STT] ElevenLabs WS open — flushing ${pendingChunksRef.current.length} buffered chunks`);
      setIsListening(true);
      startingRef.current = false;

      // Flush all pre-buffered audio immediately
      const pending = pendingChunksRef.current.splice(0);
      for (const p of pending) {
        try {
          ws.send(p);
          chunksSentRef.current++;
        } catch {}
      }
      if (chunksSentRef.current > 0) {
        console.log(`[EL-STT] Flushed ${chunksSentRef.current} buffered chunks`);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
        const msgType = msg.message_type || msg.type;

        if (msgType === "transcript_partial" || msgType === "partial_transcript") {
          setInterimTranscript(msg.text || "");
        } else if (msgType === "transcript_committed" || msgType === "committed_transcript") {
          const text = msg.text || "";
          if (text.trim()) {
            finalTranscriptRef.current += text + " ";
            setTranscript(finalTranscriptRef.current);
            setInterimTranscript("");
            console.log(`[EL-STT] ✓ "${text.trim().substring(0, 60)}"`);

            // Extract word-level timestamps if available
            // ElevenLabs Scribe returns words array with start/end times
            const words: any[] = msg.words || [];
            if (words.length > 0) {
              const sessionStart = sessionStartTimeRef.current;
              const newTimestamps: WordTimestamp[] = words.map((w: any) => ({
                word: w.text || w.word || "",
                start: typeof w.start === "number" ? w.start : 0,
                end: typeof w.end === "number" ? w.end : 0,
                isFiller: isFillerWord(w.text || w.word || ""),
              }));
              wordTimestampsRef.current = [...wordTimestampsRef.current, ...newTimestamps];
              setWordTimestamps([...wordTimestampsRef.current]);
            } else {
              // Fallback: generate approximate timestamps from text + current time
              // This gives us word-level data even without native STT word timestamps
              const sessionElapsed = (Date.now() - sessionStartTimeRef.current) / 1000;
              const wordList = text.trim().split(/\s+/);
              if (wordList.length > 0) {
                // Estimate ~0.3s per word, spread backward from current time
                const wordDuration = 0.3;
                const phraseStart = Math.max(0, sessionElapsed - wordList.length * wordDuration);
                const newTimestamps: WordTimestamp[] = wordList.map((w, i) => ({
                  word: w,
                  start: phraseStart + i * wordDuration,
                  end: phraseStart + (i + 1) * wordDuration,
                  isFiller: isFillerWord(w),
                }));
                wordTimestampsRef.current = [...wordTimestampsRef.current, ...newTimestamps];
                setWordTimestamps([...wordTimestampsRef.current]);
              }
            }

            // Check for filler phrases in the committed text
            const lowerText = text.toLowerCase();
            for (const phrase of FILLER_PHRASES) {
              let searchIdx = 0;
              while (true) {
                const idx = lowerText.indexOf(phrase, searchIdx);
                if (idx === -1) break;
                // Mark the first word of the phrase as a filler in the timestamps
                const wordsBefore = lowerText.substring(0, idx).split(/\s+/).filter(Boolean).length;
                const timestampIdx = wordTimestampsRef.current.length - text.trim().split(/\s+/).length + wordsBefore;
                if (timestampIdx >= 0 && timestampIdx < wordTimestampsRef.current.length) {
                  wordTimestampsRef.current[timestampIdx].isFiller = true;
                }
                searchIdx = idx + phrase.length;
              }
            }
          }
        } else if (msgType === "session_started") {
          console.log("[EL-STT] Session active");
        } else if (msgType === "error" || msgType === "invalid_request") {
          console.error("[EL-STT] Server:", JSON.stringify(msg));
        } else if (msgType === "session_ended") {
          console.log("[EL-STT] Session ended", msg);
        } else {
          console.log(`[EL-STT] ${msgType || "unknown"}`, msg);
        }
      } catch {}
    };

    ws.onerror = () => console.error("[EL-STT] WebSocket error");
    ws.onclose = (event) => {
      console.log(`[EL-STT] Closed: code=${event.code} chunks=${chunksSentRef.current}`);
      setIsListening(false);
      activeRef.current = false;
      startingRef.current = false;
      cleanup();
    };
    } catch (err) {
      console.error("[EL-STT] startListening failed", err);
      activeRef.current = false;
      startingRef.current = false;
      cleanup();
      throw err;
    }
  }, [cleanup]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    startingRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    cleanup();
    setIsListening(false);
  }, [cleanup]);

  const consumeNewText = useCallback((): string => {
    const full = finalTranscriptRef.current;
    const newText = full.substring(lastConsumedRef.current).trim();
    lastConsumedRef.current = full.length;
    return newText;
  }, []);

  const consumeNewTimestamps = useCallback((): WordTimestamp[] => {
    const all = wordTimestampsRef.current;
    const newItems = all.slice(lastConsumedTimestampRef.current);
    lastConsumedTimestampRef.current = all.length;
    return newItems;
  }, []);

  useEffect(() => {
    return () => { activeRef.current = false; startingRef.current = false; if (wsRef.current) wsRef.current.close(); cleanup(); };
  }, [cleanup]);

  return { transcript, interimTranscript, isListening, startListening, stopListening, consumeNewText, supported, wordTimestamps, consumeNewTimestamps };
}
