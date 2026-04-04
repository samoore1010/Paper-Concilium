import { useState, useCallback, useRef, useEffect } from "react";
import { VoiceConfig, pickBestVoice, getElevenLabsVoiceId } from "../data/voiceConfig";

export type TTSProvider = "auto" | "elevenlabs" | "openai" | "browser";

interface UseTTSReturn {
  speak: (text: string, personaId?: string, voiceConfig?: VoiceConfig) => void;
  stop: () => void;
  isSpeaking: boolean;
  speakingText: string;
  supported: boolean;
  availableProviders: string[];
  activeProvider: TTSProvider;
  setProvider: (p: TTSProvider) => void;
  debugLog: string[];
}

interface UseTTSOptions {
  /** Called with the raw TTS audio blob so it can be mixed into the session recording */
  onAudioBlob?: (blob: Blob) => void;
}

export function useTTS(options?: UseTTSOptions): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState("");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [activeProvider, setActiveProvider] = useState<TTSProvider>("auto");
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const apiProvidersRef = useRef<string[]>([]);

  // Keep a stable ref to the callback so it doesn't trigger re-renders of speak()
  const onAudioBlobRef = useRef(options?.onAudioBlob);
  useEffect(() => { onAudioBlobRef.current = options?.onAudioBlob; }, [options?.onAudioBlob]);

  // Persistent audio element — created once, reused for all playback
  // This is the key to mobile: the element is "blessed" by user gesture
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const log = useCallback((msg: string) => {
    console.log(`[TTS] ${msg}`);
    setDebugLog((prev) => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Create the persistent audio element on mount
  useEffect(() => {
    const el = document.createElement("audio");
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    audioElRef.current = el;
    log("Audio element created");

    // Pre-warm it on first user gesture
    const warmUp = () => {
      if (audioElRef.current) {
        // Play silent audio to "bless" the element
        audioElRef.current.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqpAAAAAAD/+1DEAAAHAAGf9AAAIgAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UMQbgAADSAAAAAAAAANIAAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
        audioElRef.current.volume = 0.01;
        audioElRef.current.play().then(() => {
          log("Audio element blessed by user gesture");
        }).catch(() => {});
      }
    };
    document.addEventListener("touchstart", warmUp, { once: true });
    document.addEventListener("click", warmUp, { once: true });
    return () => {
      document.removeEventListener("touchstart", warmUp);
      document.removeEventListener("click", warmUp);
    };
  }, [log]);

  // Discover available providers
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        const providers = data.ttsProviders || [];
        apiProvidersRef.current = providers;
        setAvailableProviders(providers);
        log(`Providers: ${providers.length > 0 ? providers.join(", ") : "none (browser only)"}`);
      })
      .catch(() => log("Health check failed"));
  }, [log]);

  // Load browser voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const v = speechSynthesis.getVoices();
      if (v.length > 0) setBrowserVoices(v);
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => { speechSynthesis.removeEventListener("voiceschanged", load); speechSynthesis.cancel(); };
  }, []);

  const stopCurrent = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
      audioElRef.current.src = "";
    }
    if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingText("");
  }, []);

  const speakWithBrowser = useCallback((text: string, voiceConfig?: VoiceConfig) => {
    if (!window.speechSynthesis) { setIsSpeaking(false); setSpeakingText(""); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceConfig) {
      const v = pickBestVoice(browserVoices, voiceConfig);
      if (v) u.voice = v;
      u.pitch = voiceConfig.pitch;
      u.rate = voiceConfig.rate;
      u.volume = voiceConfig.volume;
    }
    u.onstart = () => { setIsSpeaking(true); setSpeakingText(text); };
    u.onend = () => { setIsSpeaking(false); setSpeakingText(""); };
    u.onerror = () => { setIsSpeaking(false); setSpeakingText(""); };
    speechSynthesis.speak(u);
  }, [browserVoices]);

  const speak = useCallback((text: string, personaId?: string, voiceConfig?: VoiceConfig) => {
    if (!text) return;
    stopCurrent();

    const providers = apiProvidersRef.current;
    let useApi: string | null = null;

    if (activeProvider === "browser") {
      useApi = null;
    } else if (activeProvider === "elevenlabs" && providers.includes("elevenlabs")) {
      useApi = "elevenlabs";
    } else if (activeProvider === "openai" && providers.includes("openai")) {
      useApi = "openai";
    } else if (activeProvider === "auto") {
      if (providers.includes("elevenlabs")) useApi = "elevenlabs";
      else if (providers.includes("openai")) useApi = "openai";
    }

    if (useApi) {
      setIsSpeaking(true);
      setSpeakingText(text);

      const controller = new AbortController();
      abortRef.current = controller;

      // Use streaming endpoint for ElevenLabs (lower latency)
      const endpoint = useApi === "elevenlabs" ? "/api/tts/stream" : "/api/tts";
      log(`Fetching ${useApi} audio (${endpoint === "/api/tts/stream" ? "streaming" : "buffered"}) for ${personaId || "unknown"}...`);

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          personaId,
          voiceId: personaId ? getElevenLabsVoiceId(personaId) : undefined,
          speed: voiceConfig?.speed || 1.0,
          provider: useApi,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`API returned ${res.status}`);

          const audio = audioElRef.current;
          if (!audio) throw new Error("No audio element");

          audio.volume = 1.0;

          // For ElevenLabs streaming: pipe chunks to MediaSource for low-latency playback.
          // Simultaneously accumulate all chunks so the full blob can be provided to the
          // recorder for session mixing — mixing only needs it after playback finishes.
          const canStream = useApi === "elevenlabs" &&
            res.body != null &&
            typeof MediaSource !== "undefined" &&
            MediaSource.isTypeSupported("audio/mpeg");

          if (canStream) {
            const allChunks: Uint8Array[] = [];
            const reader = res.body!.getReader();
            const ms = new MediaSource();
            const msUrl = URL.createObjectURL(ms);
            audio.src = msUrl;

            audio.onended = () => {
              setIsSpeaking(false);
              setSpeakingText("");
              log("Playback finished (streaming)");
            };
            audio.onerror = (e) => {
              log(`Playback error (streaming): ${(e as any)?.message || "unknown"}`);
              setIsSpeaking(false);
              setSpeakingText("");
            };

            await new Promise<void>((resolve, reject) => {
              ms.addEventListener("sourceopen", async () => {
                URL.revokeObjectURL(msUrl);
                let sb: SourceBuffer;
                try {
                  sb = ms.addSourceBuffer("audio/mpeg");
                } catch (e) {
                  reject(e);
                  return;
                }

                const waitForUpdate = () =>
                  new Promise<void>((r) => sb.addEventListener("updateend", () => r(), { once: true }));

                let playStarted = false;
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      if (sb.updating) await waitForUpdate();
                      ms.endOfStream();
                      // Provide full blob to recorder for session mixing
                      const totalSize = allChunks.reduce((s, c) => s + c.byteLength, 0);
                      const merged = new Uint8Array(totalSize);
                      let offset = 0;
                      for (const c of allChunks) { merged.set(c, offset); offset += c.byteLength; }
                      onAudioBlobRef.current?.(new Blob([merged], { type: "audio/mpeg" }));
                      resolve();
                      break;
                    }
                    allChunks.push(value);
                    if (sb.updating) await waitForUpdate();
                    sb.appendBuffer(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
                    await waitForUpdate();
                    if (!playStarted) {
                      playStarted = true;
                      audio.play().then(() => log("Playing (streaming — low latency)")).catch(() => {});
                    }
                  }
                } catch (err: any) {
                  if (err.name !== "AbortError") reject(err);
                  else resolve();
                }
              }, { once: true });
            });
            return;
          }

          // Fallback: buffer full response (OpenAI or MediaSource not supported)
          const blob = await res.blob();
          onAudioBlobRef.current?.(blob);

          const url = URL.createObjectURL(blob);
          log(`Got audio blob (${blob.size} bytes), playing...`);

          audio.src = url;

          audio.onended = () => {
            setIsSpeaking(false);
            setSpeakingText("");
            URL.revokeObjectURL(url);
            log("Playback finished");
          };
          audio.onerror = (e) => {
            log(`Playback error: ${(e as any)?.message || "unknown"}`);
            setIsSpeaking(false);
            setSpeakingText("");
            URL.revokeObjectURL(url);
          };

          await audio.play();
          log("Playing audio successfully");
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          log(`FAILED: ${err.message}, falling back to browser TTS`);
          speakWithBrowser(text, voiceConfig);
        });
    } else {
      log("Using browser voice");
      setIsSpeaking(true);
      setSpeakingText(text);
      speakWithBrowser(text, voiceConfig);
    }
  }, [stopCurrent, speakWithBrowser, activeProvider, log]);

  return {
    speak,
    stop: stopCurrent,
    isSpeaking,
    speakingText,
    supported: true,
    availableProviders,
    activeProvider,
    setProvider: setActiveProvider,
    debugLog,
  };
}
