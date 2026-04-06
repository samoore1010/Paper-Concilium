import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Persona, ReactionType } from "../data/personas";
import { generateLiveReaction, generateSessionFeedback, FeedbackItem, shouldRaiseHand } from "../data/feedbackEngine";
import { checkLLMAvailability, getLLMReactionsBatch, LLMModel } from "../data/llmApi";
import { DiagnosticEntry } from "./QuestionQueue";
import { getTheme } from "../data/themes";
import { getSessionBehavior } from "../data/sessionBehavior";
import { getVoiceConfig } from "../data/voiceConfig";
import { AudienceTile } from "./AudienceTile";
import { ThemedBackground } from "./ThemedBackground";
import { ThemedLayout } from "./ThemedLayout";
import { Teleprompter } from "./Teleprompter";
import { QuestionQueue, QueuedQuestion, handRaiseToQueuedQuestion } from "./QuestionQueue";
import { ScriptConfig } from "./ScriptSetup";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";
import { useCamera } from "../hooks/useCamera";
import { useSpeechMetrics } from "../hooks/useSpeechMetrics";
import { useProsody } from "../hooks/useProsody";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useVAD } from "../hooks/useVAD";
import { useTTS } from "../hooks/useTTS";
import { useVisualAnalysis } from "../hooks/useVisualAnalysis";
import { addSession, SessionRecord } from "../data/sessionHistory";

export interface SessionRecordingData {
  audioUrl: string;
  duration: number;
  timeline: import("../hooks/useProsody").ProsodyFrame[];
  chatMessages: { from: string; text: string; time: number }[];
}

interface MeetingRoomProps {
  personas: Persona[];
  sessionType: string;
  scriptConfig?: ScriptConfig;
  onEndSession: (feedback: FeedbackItem[], transcript: string, recording?: SessionRecordingData) => void;
  onBack: () => void;
}

interface PersonaState {
  reaction: ReactionType;
  emoji?: string;
  lastHandRaiseAt?: number;
  /** Reaction intensity 0.3-1.0, drives animation amplitude */
  intensity?: number;
}

type SideTab = "chat" | "coach" | "questions";

export function MeetingRoom({ personas, sessionType, scriptConfig, onEndSession, onBack }: MeetingRoomProps) {
  const [inputText, setInputText] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [elapsed, setElapsed] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; time: number }[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [questionQueue, setQuestionQueue] = useState<QueuedQuestion[]>([]);
  const [speakingPersonaId, setSpeakingPersonaId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sideTab, setSideTab] = useState<SideTab>("chat");
  const [mobilePanel, setMobilePanel] = useState<SideTab | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [isEnding, setIsEnding] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Admin model selection
  const [reactionModel, setReactionModel] = useState<LLMModel>("claude-haiku-4-5-20251001");
  const [feedbackModel, setFeedbackModel] = useState<LLMModel>("claude-sonnet-4-6");
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);

  const addDiagnostic = useCallback((entry: Omit<DiagnosticEntry, "id" | "timestamp">) => {
    setDiagnostics((prev) => [...prev.slice(-99), { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() }]);
  }, []);

  const [showTeleprompter, setShowTeleprompter] = useState(!!scriptConfig?.text);
  const [continuousActive, setContinuousActive] = useState(false);
  const wordCountRef = useRef(0);
  const interruptQueueRef = useRef<Array<{ personaId: string; text: string }>>([]);
  const isProcessingInterruptRef = useRef(false);
  const waitingForResponseRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const lastInterruptPersonaRef = useRef<string | null>(null);
  const consecutiveCountRef = useRef(0);          // How many times current persona has spoken in a row
  const MAX_CONSECUTIVE = 2;
  const processInterruptRef = useRef<() => void>(() => {});
  const interruptTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined); // single interrupt timer
  const llmInFlightRef = useRef(false);           // debounce: is an LLM reaction call in progress?
  const lastAudienceSpokeRef = useRef(0);         // cooldown: when did audience last finish speaking?
  const AUDIENCE_COOLDOWN_MS = 2000;              // min gap between audience speakers                       // Max questions before forced rotation

  const sharedStreamRef = useRef<MediaStream | null>(null);
  const processUserInputRef = useRef<(text: string) => void>(() => {});

  const theme = getTheme(sessionType);
  const behavior = getSessionBehavior(sessionType);

  const { isActive: isCameraActive, startCamera, stopCamera, attachVideo } = useCamera();
  const visualAnalysis = useVisualAnalysis();
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const attachVideoWithAnalysis = useCallback((el: HTMLVideoElement | null) => {
    attachVideo(el);
    if (el) videoElRef.current = el;
  }, [attachVideo]);
  // Speech recognition — try ElevenLabs STT first, fall back to Web Speech API
  const webSpeech = useSpeechRecognition();
  const elSTT = useElevenLabsSTT();
  const [sttProvider, setSttProvider] = useState<"web" | "elevenlabs">("web");

  // Auto-detect: if ElevenLabs STT is available, prefer it
  useEffect(() => {
    if (elSTT.supported) setSttProvider("elevenlabs");
  }, [elSTT.supported]);

  // Track mobile breakpoint for conditional rendering
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const useElSTT = sttProvider === "elevenlabs" && elSTT.supported;
  const speechTranscript = useElSTT ? elSTT.transcript : webSpeech.transcript;
  const interimTranscript = useElSTT ? elSTT.interimTranscript : webSpeech.interimTranscript;
  const isListening = useElSTT ? elSTT.isListening : webSpeech.isListening;

  // Wrapped startListening with fallback
  const startListening = useCallback(async () => {
    if (useElSTT) {
      try {
        await elSTT.startListening();
        console.log("[STT] Using ElevenLabs real-time");
      } catch (err) {
        console.log("[STT] ElevenLabs failed, falling back to Web Speech API:", err);
        setSttProvider("web");
        webSpeech.startListening();
      }
    } else {
      webSpeech.startListening();
      console.log("[STT] Using Web Speech API");
    }
  }, [useElSTT, elSTT, webSpeech]);

  const stopListening = useElSTT ? elSTT.stopListening : webSpeech.stopListening;
  const consumeNewText = useElSTT ? elSTT.consumeNewText : webSpeech.consumeNewText;
  const { metrics: speechMetrics, updateMetrics } = useSpeechMetrics();
  const { metrics: prosodyMetrics, isAnalyzing: isProsodyActive, startAnalysis: startProsody, stopAnalysis: stopProsody, getTimeline } = useProsody();
  const { startRecording, stopRecording, getRecording, mixAudioBlob } = useAudioRecorder();
  const { speak, stop: stopTTS, isSpeaking, availableProviders, activeProvider, setProvider, debugLog } = useTTS({ onAudioBlob: mixAudioBlob });
  const { start: startVAD, stop: stopVAD, onSilenceThreshold } = useVAD(behavior.silenceThresholdMs);

  // Check if LLM backend is available on mount
  useEffect(() => {
    checkLLMAvailability().then(setLlmAvailable);
  }, []);

  // Refs for interval access (avoids stale closures in setInterval)
  const interimRef = useRef("");
  const speechTranscriptRef = useRef("");
  interimRef.current = interimTranscript;
  speechTranscriptRef.current = speechTranscript;

  // ── Single-publisher auto-send for Go Live mode ──
  // One interval, one publish path, no competing triggers.
  //
  // Strategy:
  //  - Collect committed chunks into a buffer (coalescing window: 1000ms)
  //  - After 1000ms of no new commits, flush buffer as ONE chat message
  //  - Fallback: if only interim text and stable for 1.5s, send that instead
  //  - Dedupe: skip if normalized text matches or substantially overlaps last sent
  const lastPublishedRef = useRef("");       // dedup: last text sent to chat
  const coalesceBufferRef = useRef("");      // accumulates committed chunks
  const lastCommitTimeRef = useRef(0);       // when last committed chunk arrived
  const lastInterimSnapshotRef = useRef(""); // tracks interim changes
  const interimStableSinceRef = useRef(0);   // when interim stopped changing
  const charsFlushedRef = useRef(0);         // total chars flushed to chat (sync counter)
  const flushedInterimRef = useRef("");      // last interim text that was flushed (hides from bottom bar)

  const flushToChat = useCallback((text: string, source: string) => {
    const trimmed = text.trim();
    if (!trimmed || sessionEndedRef.current) return;

    // Dedupe: skip if identical OR substantial overlap with last published message
    const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
    const prev = lastPublishedRef.current;
    if (prev && (normalized === prev || prev.includes(normalized) || normalized.includes(prev))) {
      // If the new text is longer (superset of prev), allow it — it's a more complete version
      if (normalized.length <= prev.length) {
        console.log(`[AutoSend] Dedup skip (${source}): "${trimmed.substring(0, 40)}"`);
        return;
      }
    }
    lastPublishedRef.current = normalized;

    console.log(`[AutoSend] ${source} → chat: "${trimmed.substring(0, 60)}"`);
    if (waitingForResponseRef.current) waitingForResponseRef.current = false;
    processUserInputRef.current(trimmed);
  }, []);

  useEffect(() => {
    if (!continuousActive) return;

    // Reset state on start
    coalesceBufferRef.current = "";
    lastCommitTimeRef.current = 0;
    lastInterimSnapshotRef.current = "";
    interimStableSinceRef.current = Date.now();
    charsFlushedRef.current = 0;
    lastPublishedRef.current = "";

    const interval = setInterval(() => {
      if (sessionEndedRef.current) return;

      const now = Date.now();

      // ── Tier 1: Committed text with coalescing window ──
      const committed = consumeNewText();
      if (committed.length > 0) {
        coalesceBufferRef.current += (coalesceBufferRef.current ? " " : "") + committed;
        lastCommitTimeRef.current = now;
        return; // Wait for coalescing window before sending
      }

      // If we have buffered committed text and 500ms passed since last commit → flush
      if (coalesceBufferRef.current.length > 0 && (now - lastCommitTimeRef.current) >= 500) {
        const buf = coalesceBufferRef.current;
        coalesceBufferRef.current = "";
        flushToChat(buf, "committed");
        charsFlushedRef.current += buf.length;
        flushedInterimRef.current = ""; // committed text supersedes — re-show interim
        // Reset interim tracking since committed text supersedes it
        lastInterimSnapshotRef.current = interimRef.current;
        interimStableSinceRef.current = now;
        return;
      }

      // ── Tier 2: Stable interim fallback (no commits, user paused) ──
      // Only fires if there's no pending committed text in the buffer
      if (coalesceBufferRef.current.length > 0) return;

      const interim = interimRef.current;
      if (interim !== lastInterimSnapshotRef.current) {
        // Interim is still changing — user is speaking
        lastInterimSnapshotRef.current = interim;
        interimStableSinceRef.current = now;
        return;
      }

      // Interim stable for 1.5s and has meaningful unsent content → send
      // Use charsFlushedRef (sync counter) instead of speechTranscriptRef
      // (async React state) to avoid race where stale state under-counts
      // what was already flushed, causing the full transcript to re-send.
      const stableMs = now - interimStableSinceRef.current;
      if (interim.length > 0 && stableMs >= 1500) {
        // Only send the interim itself, not the full transcript — committed
        // text is handled exclusively by Tier 1. This prevents any overlap.
        const trimmedInterim = interim.trim();
        if (trimmedInterim.length > 0) {
          flushToChat(trimmedInterim, `stable-interim(${stableMs}ms)`);
          charsFlushedRef.current += trimmedInterim.length;
          flushedInterimRef.current = interim; // hide from bottom bar until new speech
          consumeNewText(); // keep STT hook pointer in sync
          // Reset interim tracking
          lastInterimSnapshotRef.current = "";
          interimStableSinceRef.current = now;
        }
      }
    }, 100); // Poll at 100ms for responsive coalescing

    return () => clearInterval(interval);
  }, [continuousActive, consumeNewText, flushToChat]);

  const startContinuousMode = useCallback(async () => {
    setContinuousActive(true);
    // IMPORTANT: Start ElevenLabs STT FIRST — it opens its own mic stream and
    // AudioWorklet pipeline. Opening other mic streams before it can interfere.
    await startListening();

    // Now open a shared stream for the secondary hooks (VAD, prosody, recorder).
    // ElevenLabs already has its own mic stream running at this point.
    let sharedStream: MediaStream | null = null;
    try {
      sharedStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      sharedStreamRef.current = sharedStream;
    } catch (e) {
      console.log("[Continuous] Shared stream unavailable, hooks will open their own");
    }

    try { await startVAD(sharedStream || undefined); } catch (e) { console.log("[Continuous] VAD unavailable"); }
    try { await startProsody(sharedStream || undefined); } catch (e) { console.log("[Continuous] Prosody unavailable"); }
    try { await startRecording(sharedStream || undefined); } catch (e) { console.log("[Continuous] Recording unavailable"); }
    // Start visual analysis if camera is active
    if (videoElRef.current) {
      try { await visualAnalysis.start(videoElRef.current); } catch (e) { console.log("[Continuous] Visual analysis unavailable"); }
    }
    console.log("[Continuous] Started");
  }, [startListening, startProsody, startVAD, startRecording, visualAnalysis]);

  const stopContinuousMode = useCallback(() => {
    // Flush any remaining text: coalesce buffer + committed + interim
    const buffered = coalesceBufferRef.current;
    const committed = consumeNewText();
    const interim = interimRef.current;
    const remaining = (buffered + (committed ? " " + committed : "") + (interim ? " " + interim : "")).trim();
    if (remaining.length > 0 && !sessionEndedRef.current) {
      flushToChat(remaining, "flush-on-stop");
    }
    coalesceBufferRef.current = "";

    setContinuousActive(false);
    stopListening();
    stopProsody();
    stopVAD();
    visualAnalysis.stop();

    // Stop shared mic stream
    if (sharedStreamRef.current) {
      sharedStreamRef.current.getTracks().forEach(t => t.stop());
      sharedStreamRef.current = null;
    }
    console.log("[Continuous] Stopped");
  }, [stopListening, stopProsody, stopVAD, visualAnalysis, consumeNewText, flushToChat]);

  // ── Strict audience turn lock ──
  // One speaker at a time. Single timer for next interrupt (no concurrent timers).
  // Cooldown between audience speakers. User gets a chance to respond.

  // Schedule the next interrupt with a SINGLE timer (cancels any existing one)
  const scheduleNextInterrupt = useCallback((delayMs: number) => {
    clearTimeout(interruptTimerRef.current);
    interruptTimerRef.current = setTimeout(() => {
      if (!sessionEndedRef.current) processInterruptRef.current();
    }, delayMs);
  }, []);

  const processNextInterrupt = useCallback(() => {
    if (sessionEndedRef.current) return;
    if (isProcessingInterruptRef.current) return;
    if (waitingForResponseRef.current) return;

    // Enforce cooldown: don't let another persona speak too soon after the last
    const sinceLast = Date.now() - lastAudienceSpokeRef.current;
    if (sinceLast < AUDIENCE_COOLDOWN_MS) {
      scheduleNextInterrupt(AUDIENCE_COOLDOWN_MS - sinceLast);
      return;
    }

    const queue = interruptQueueRef.current;
    if (queue.length === 0) return;

    // Round-robin: if same persona hit MAX_CONSECUTIVE, try a different one
    let nextIdx = 0;
    if (lastInterruptPersonaRef.current && consecutiveCountRef.current >= MAX_CONSECUTIVE) {
      const otherIdx = queue.findIndex((q) => q.personaId !== lastInterruptPersonaRef.current);
      if (otherIdx !== -1) nextIdx = otherIdx;
    }

    const next = queue.splice(nextIdx, 1)[0];
    if (!next) return;

    if (next.personaId === lastInterruptPersonaRef.current) {
      consecutiveCountRef.current += 1;
    } else {
      consecutiveCountRef.current = 1;
    }

    isProcessingInterruptRef.current = true;
    lastInterruptPersonaRef.current = next.personaId;

    const persona = personas.find((p) => p.id === next.personaId);
    if (persona) {
      setChatMessages((prev) => [...prev, { from: persona.name, text: next.text, time: elapsed }]);
      setSpeakingPersonaId(next.personaId);
      setPersonaStates((prev) => ({
        ...prev,
        [next.personaId]: { ...prev[next.personaId], reaction: "speaking" },
      }));
      console.log(`[Interrupt] Playing: ${persona.name}: "${next.text.substring(0, 40)}..."`);
      speak(next.text, next.personaId, getVoiceConfig(next.personaId));
    } else {
      isProcessingInterruptRef.current = false;
    }
  }, [personas, elapsed, speak, scheduleNextInterrupt]);

  // Keep ref in sync so timers always call latest version
  processInterruptRef.current = processNextInterrupt;

  // When TTS finishes: mark cooldown, lock for user response, schedule next
  useEffect(() => {
    if (!isSpeaking && speakingPersonaId) {
      const timer = setTimeout(() => {
        setPersonaStates((prev) => ({
          ...prev,
          [speakingPersonaId]: { ...prev[speakingPersonaId], reaction: "neutral" },
        }));
        setSpeakingPersonaId(null);
        isProcessingInterruptRef.current = false;
        lastAudienceSpokeRef.current = Date.now(); // start cooldown

        // Wait for user to respond before allowing next audience member
        if (behavior.allowInterruptions && interruptQueueRef.current.length > 0) {
          waitingForResponseRef.current = true;
          // Safety timeout: if user doesn't respond within 10s, allow next
          scheduleNextInterrupt(10000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, speakingPersonaId, behavior.allowInterruptions, scheduleNextInterrupt]);

  // ── Mobile: auto-pause mic during TTS playback ──
  // On mobile, speaker output bleeds into the mic causing feedback loops and
  // garbled transcription. Pause STT while a persona is speaking, resume after.
  // IMPORTANT: We stop/restart the FULL ElevenLabs pipeline each time, which
  // mints a new single-use token per resume. To avoid exhausting tokens or
  // hitting rate limits, we only do this on mobile where feedback is a real issue.
  const micPausedForTTSRef = useRef(false);
  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (!isMobile || !continuousActive) return;

    if (isSpeaking && isListening) {
      // Persona started speaking — pause mic
      stopListening();
      stopProsody();
      micPausedForTTSRef.current = true;
      console.log("[Mobile] Mic paused during TTS playback");
    } else if (!isSpeaking && micPausedForTTSRef.current) {
      // Persona finished speaking — resume mic with shared stream for prosody
      micPausedForTTSRef.current = false;
      startListening().catch(() => {});
      const stream = sharedStreamRef.current;
      startProsody(stream || undefined);
      console.log("[Mobile] Mic resumed after TTS playback");
    }
  }, [isSpeaking, isListening, continuousActive, stopListening, stopProsody, startListening, startProsody]);

  // In manual mode, show interim transcript in input (clears when finalized)
  useEffect(() => {
    if (continuousActive) return;
    if (interimTranscript) {
      setInputText(interimTranscript);
    }
  }, [interimTranscript, continuousActive]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      const rp = personas[Math.floor(Math.random() * personas.length)];
      if (Math.random() > 0.6 && speakingPersonaId !== rp.id) {
        const type = (["think", "neutral", "nod"] as ReactionType[])[Math.floor(Math.random() * 3)];
        setPersonaStates((prev) => ({ ...prev, [rp.id]: { ...prev[rp.id], reaction: type } }));
        setTimeout(() => {
          setPersonaStates((prev) => ({ ...prev, [rp.id]: { ...prev[rp.id], reaction: "neutral" } }));
        }, 2000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [personas, speakingPersonaId]);

  // Shared input processing (used by both send button and continuous mode)
  const processUserInput = useCallback((text: string) => {
    if (!text.trim() || sessionEndedRef.current) return;
    wordCountRef.current += text.trim().split(/\s+/).length;
    setTranscript((prev) => [...prev, text.trim()]);
    setChatMessages((prev) => [...prev, { from: "You", text: text.trim(), time: elapsed }]);
    updateMetrics(text.trim());

    // User responded — unlock interrupt queue and schedule next with cooldown
    if (waitingForResponseRef.current) {
      waitingForResponseRef.current = false;
      scheduleNextInterrupt(AUDIENCE_COOLDOWN_MS);
    }
    const newMC = messageCount + 1;
    setMessageCount(newMC);

    if (llmAvailable) {
      // === LLM-POWERED REACTIONS ===
      // Debounce: skip if a previous LLM call is still in flight
      if (llmInFlightRef.current) {
        console.log("[LLM] Skipping reaction call — previous still in flight");
        return;
      }
      llmInFlightRef.current = true;

      // Build conversational context from recent chat (so LLM knows what was just asked)
      const recentChat = chatMessages.slice(-8).map((m) => `${m.from}: ${m.text}`);

      getLLMReactionsBatch(
        personas.map((p) => p.id),
        text,
        sessionType,
        [...recentChat, `You: ${text}`],
        scriptConfig?.sourceContext || undefined,
        reactionModel
      ).then((reactions) => {
        llmInFlightRef.current = false;

        // Log diagnostics from metadata
        reactions.forEach((r) => {
          if (r._meta) {
            addDiagnostic({
              type: "reaction",
              model: r._meta.model,
              latencyMs: r._meta.latencyMs,
              inputTokens: r._meta.inputTokens,
              outputTokens: r._meta.outputTokens,
              personaId: r.personaId,
              status: "success",
              message: `${r.reaction} — ${(r.question || r.comment || "no text").substring(0, 60)}`,
            });
          }
        });
        if (sessionEndedRef.current) return;

        // Separate interrupters from non-interrupters
        const interrupters: typeof reactions = [];
        const nonInterrupters: typeof reactions = [];

        reactions.forEach((r) => {
          const responseText = r.question || r.comment;
          // shouldInterrupt can come as boolean or string from LLM
          const wantsInterrupt = r.shouldInterrupt === true || (r as any).shouldInterrupt === "true";
          const canInterrupt = behavior.allowInterruptions
            && wantsInterrupt
            && responseText
            && wordCountRef.current >= behavior.interruptMinWords;

          console.log(`[Interrupt] ${r.personaId}: shouldInterrupt=${r.shouldInterrupt}, canInterrupt=${canInterrupt}, waiting=${waitingForResponseRef.current}, words=${wordCountRef.current}, text=${responseText?.substring(0, 30)}`);

          if (canInterrupt && !waitingForResponseRef.current) {
            interrupters.push(r);
          } else if (responseText) {
            nonInterrupters.push(r);
          }
        });

        // Pick ONE interrupter — prefer different personas and higher urgency
        let chosenInterrupter: typeof reactions[0] | null = null;
        console.log(`[Interrupt] ${interrupters.length} interrupters, ${nonInterrupters.length} non-interrupters`);

        if (interrupters.length > 0) {
          const scored = interrupters.map((r) => {
            let score = 0;
            // Strongly prefer someone different from last speaker
            if (r.personaId !== lastInterruptPersonaRef.current) score += 100;
            // Prefer if last speaker hit consecutive limit
            if (consecutiveCountRef.current >= MAX_CONSECUTIVE && r.personaId !== lastInterruptPersonaRef.current) score += 50;
            // Use urgency as tiebreaker
            if (r.urgency === "high") score += 30;
            else if (r.urgency === "medium") score += 15;
            // Add randomness to avoid predictable ordering
            score += Math.random() * 20;
            return { reaction: r, score };
          });
          scored.sort((a, b) => b.score - a.score);
          chosenInterrupter = scored[0].reaction;
        }

        // Process all reactions
        reactions.forEach((r) => {
          if (sessionEndedRef.current) return;
          const persona = personas.find((p) => p.id === r.personaId);
          if (!persona) return;

          setPersonaStates((prev) => ({
            ...prev,
            [r.personaId]: { reaction: r.reaction, intensity: r.intensity, lastHandRaiseAt: prev[r.personaId]?.lastHandRaiseAt },
          }));

          const responseText = r.question || r.comment;
          if (responseText) {
            if (r === chosenInterrupter) {
              // This persona gets to interrupt
              interruptQueueRef.current.push({ personaId: r.personaId, text: responseText });
              setPersonaStates((prev) => ({
                ...prev,
                [r.personaId]: { ...prev[r.personaId], reaction: "raised-hand" },
              }));
              console.log(`[Interrupt] Queued ${chosenInterrupter.personaId}, processing=${isProcessingInterruptRef.current}, waiting=${waitingForResponseRef.current}`);
              if (!isProcessingInterruptRef.current && !waitingForResponseRef.current) {
                scheduleNextInterrupt(500 + Math.random() * 1000);
              }
            } else {
              // QUEUE: show as clickable bubble above head
              const queued: QueuedQuestion = {
                id: `${r.personaId}-${Date.now()}-${Math.random()}`,
                personaId: r.personaId,
                question: responseText,
                timestamp: Date.now(),
              };
              setQuestionQueue((prev) => [...prev, queued]);
              setTimeout(() => {
                setPersonaStates((prev) => ({
                  ...prev,
                  [r.personaId]: { ...prev[r.personaId], reaction: "raised-hand" },
                }));
              }, 800);
            }
          }

          // Reset reaction after a delay (but not for the chosen interrupter — they stay "raised-hand" or "speaking")
          if (r !== chosenInterrupter) {
            setTimeout(() => {
              setPersonaStates((prev) => ({
                ...prev,
                [r.personaId]: { ...prev[r.personaId], reaction: "neutral" },
              }));
            }, 3000);
          }
        });
      }).catch((err) => {
        llmInFlightRef.current = false;
        console.error("LLM reaction failed, falling back to keywords:", err);
        addDiagnostic({
          type: "error",
          model: reactionModel,
          status: "error",
          message: err.message || "LLM reaction call failed",
        });
        fallbackKeywordReactions(text, newMC);
      });
    } else {
      // === KEYWORD FALLBACK ===
      fallbackKeywordReactions(text, newMC);
    }
  }, [personas, elapsed, messageCount, personaStates, updateMetrics, llmAvailable, sessionType, transcript, chatMessages, processNextInterrupt, scheduleNextInterrupt, reactionModel, addDiagnostic]);

  // Keep processUserInput ref in sync so callbacks always use the latest version
  processUserInputRef.current = processUserInput;

  // Send button handler (for manual/text mode)
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim()) return;
    processUserInput(inputText.trim());
    setInputText("");
  }, [inputText, processUserInput]);

  // Keyword-based fallback (original system)
  const fallbackKeywordReactions = useCallback((text: string, newMC: number) => {
    personas.forEach((persona) => {
      const delay = 500 + Math.random() * 2000;
      setTimeout(() => {
        const re = generateLiveReaction(persona, text);
        if (re) {
          setPersonaStates((prev) => ({
            ...prev,
            [persona.id]: { reaction: re.type, emoji: re.emoji, lastHandRaiseAt: prev[persona.id]?.lastHandRaiseAt },
          }));
          // Queue comment as clickable bubble (not directly to chat)
          if (Math.random() > 0.7) {
            const comment = getReactiveComment(persona, re.type);
            if (comment) {
              setTimeout(() => {
                setQuestionQueue((prev) => [...prev, {
                  id: `${persona.id}-${Date.now()}-${Math.random()}`,
                  personaId: persona.id,
                  question: comment,
                  timestamp: Date.now(),
                }]);
                setPersonaStates((prev) => ({
                  ...prev, [persona.id]: { ...prev[persona.id], reaction: "raised-hand" },
                }));
              }, 1000 + Math.random() * 1500);
            }
          }
          setTimeout(() => {
            setPersonaStates((prev) => ({
              ...prev,
              [persona.id]: { reaction: "neutral", emoji: undefined, lastHandRaiseAt: prev[persona.id]?.lastHandRaiseAt },
            }));
          }, 2500);
        }
        const now = Date.now();
        const lr = personaStates[persona.id]?.lastHandRaiseAt || 0;
        if (now - lr > 5000) {
          const raiseEvent = shouldRaiseHand(persona, text, newMC);
          if (raiseEvent) {
            setQuestionQueue((prev) => [...prev, handRaiseToQueuedQuestion(raiseEvent)]);
            setPersonaStates((prev) => ({
              ...prev, [persona.id]: { ...prev[persona.id], reaction: "raised-hand", lastHandRaiseAt: now },
            }));
            setTimeout(() => setPersonaStates((prev) => ({ ...prev, [persona.id]: { ...prev[persona.id], reaction: "neutral" } })), 3000);
          }
        }
      }, delay);
    });
  }, [personas, elapsed, personaStates]);

  const handleQuestionClick = (q: QueuedQuestion) => ttsEnabled ? handleListenToQuestion(q) : handleReadQuestion(q);

  const handleListenToQuestion = (q: QueuedQuestion) => {
    const persona = personas.find((p) => p.id === q.personaId);
    setSpeakingPersonaId(q.personaId);
    setPersonaStates((prev) => ({ ...prev, [q.personaId]: { ...prev[q.personaId], reaction: "speaking" } }));
    if (persona) setChatMessages((prev) => [...prev, { from: persona.name, text: q.question, time: elapsed }]);
    speak(q.question, q.personaId, getVoiceConfig(q.personaId));
    setQuestionQueue((prev) => prev.filter((x) => x.id !== q.id));
  };

  const handleReadQuestion = (q: QueuedQuestion) => {
    const persona = personas.find((p) => p.id === q.personaId);
    if (persona) setChatMessages((prev) => [...prev, { from: persona.name, text: q.question, time: elapsed }]);
    setQuestionQueue((prev) => prev.filter((x) => x.id !== q.id));
  };

  // ── Mobile: auto-trigger queued audience questions ──
  // On mobile, the question queue is hidden behind a bottom sheet. Auto-play the
  // first queued question when the user isn't speaking and no persona is already
  // speaking, so questions don't get silently missed.
  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (!isMobile || !continuousActive) return;
    if (isSpeaking || speakingPersonaId || questionQueue.length === 0) return;

    const timer = setTimeout(() => {
      if (questionQueue.length > 0 && !sessionEndedRef.current) {
        const q = questionQueue[0];
        console.log("[Mobile] Auto-triggering queued question");
        if (ttsEnabled) {
          handleListenToQuestion(q);
        } else {
          handleReadQuestion(q);
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking, speakingPersonaId, questionQueue, continuousActive, ttsEnabled]);

  const handleEndSession = async () => {
    // Guard against double-clicks
    if (isEnding) return;
    setIsEnding(true);
    sessionEndedRef.current = true;

    // Flush any remaining text: coalesce buffer + committed + interim
    const buffered = coalesceBufferRef.current;
    const endCommitted = consumeNewText();
    const endInterim = interimRef.current;
    const remaining = (buffered + (endCommitted ? " " + endCommitted : "") + (endInterim ? " " + endInterim : "")).trim();
    if (remaining.length > 0) {
      flushToChat(remaining, "flush-on-end");
    }
    coalesceBufferRef.current = "";

    // Hard stop everything
    clearInterval(timerRef.current);
    interruptQueueRef.current = [];
    isProcessingInterruptRef.current = false;
    waitingForResponseRef.current = false;
    stopCamera(); stopListening(); stopTTS(); stopProsody(); stopVAD(); visualAnalysis.stop();
    // Await recording stop to ensure all audio data is flushed
    const recordingResult = await stopRecording();
    setContinuousActive(false);

    // Stop shared mic stream after all hooks are done
    if (sharedStreamRef.current) {
      sharedStreamRef.current.getTracks().forEach(t => t.stop());
      sharedStreamRef.current = null;
    }

    const ft = transcript.join(" ");

    let feedback: FeedbackItem[];

    if (llmAvailable && ft.length > 20) {
      // Call feedback for each persona sequentially with progress tracking
      feedback = [];
      for (const persona of personas) {
        try {
          const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: persona.id,
              transcript: ft,
              sessionType,
              model: feedbackModel,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            feedback.push({
              personaId: data.personaId,
              personaName: persona.name,
              overallScore: Math.max(1, Math.min(10, data.overallScore || 5)),
              summary: data.summary || "",
              strengths: data.strengths || [],
              weaknesses: data.weaknesses || [],
              suggestion: data.suggestion || "",
              emotionalResponse: data.emotionalResponse || "",
            });
            if (data._meta) {
              addDiagnostic({
                type: "feedback",
                model: data._meta.model,
                latencyMs: data._meta.latencyMs,
                inputTokens: data._meta.inputTokens,
                outputTokens: data._meta.outputTokens,
                personaId: persona.id,
                status: "success",
                message: `Score: ${data.overallScore} — ${(data.summary || "").substring(0, 60)}`,
              });
            }
          } else {
            addDiagnostic({ type: "error", model: feedbackModel, personaId: persona.id, status: "error", message: `Feedback HTTP ${res.status}` });
            feedback.push(generateSessionFeedback(persona, ft));
          }
        } catch (err: any) {
          addDiagnostic({ type: "error", model: feedbackModel, personaId: persona.id, status: "error", message: err.message || "Feedback call failed" });
          feedback.push(generateSessionFeedback(persona, ft));
        }
        setGeneratingCount(feedback.length);
      }
    } else {
      feedback = personas.map((p) => generateSessionFeedback(p, ft));
    }

    const avg = feedback.length > 0
      ? feedback.reduce((s, f) => s + f.overallScore, 0) / feedback.length
      : 0;
    const pps: Record<string, number> = {};
    feedback.forEach((f) => { pps[f.personaId] = f.overallScore; });
    addSession({
      id: Date.now().toString(), date: Date.now(), sessionType,
      personaIds: personas.map((p) => p.id), overallScore: avg, perPersonaScores: pps,
      wordCount: ft.split(/\s+/).filter(Boolean).length, duration: elapsed,
      speechMetrics: { wordsPerMinute: speechMetrics.wordsPerMinute, fillerWordCount: speechMetrics.fillerWordCount, longestPause: speechMetrics.longestPause, vocabularyScore: speechMetrics.vocabularyScore },
      prosodyMetrics: { averageVolume: prosodyMetrics.averageVolume, volumeVariation: prosodyMetrics.volumeVariation, pitchVariation: prosodyMetrics.pitchVariation, energyLevel: prosodyMetrics.energyLevel, silenceRatio: prosodyMetrics.silenceRatio },
      visualMetrics: visualAnalysis.getSnapshot(),
      feedback,
      transcript: ft,
    });
    // Collect recording data (use awaited result, not getRecording)
    const timeline = getTimeline();
    const sessionDuration = recordingResult.duration || elapsed;
    const recordingData: SessionRecordingData | undefined = recordingResult.url ? {
      audioUrl: recordingResult.url,
      duration: sessionDuration,
      timeline,
      chatMessages: [...chatMessages],
    } : undefined;

    onEndSession(feedback, ft, recordingData);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Hide interim text from UI once it's been flushed to chat (Tier 2).
  // When new speech arrives, interimTranscript changes and no longer matches → shows again.
  const visibleInterim = interimTranscript && interimTranscript !== flushedInterimRef.current
    ? interimTranscript : "";

  const audienceTiles = personas.map((persona) => {
    const state = personaStates[persona.id] || { reaction: "neutral" as ReactionType };
    return (
      <AudienceTile
        key={persona.id} persona={persona} reaction={state.reaction} reactionEmoji={state.emoji}
        reactionIntensity={state.intensity}
        isSpeaking={speakingPersonaId === persona.id}
        pendingQuestion={questionQueue.find((q) => q.personaId === persona.id)}
        onQuestionClick={handleQuestionClick}
        themeAccentColor={theme.accentColor}
        characterContext={theme.characterContext}
        showEntrance={elapsed < 3}
        hideQuestionBubble={isMobile}
      />
    );
  });

  // === SELF-VIEW COMPONENT (reused in desktop sidebar + mobile) ===
  const selfView = (className: string) => (
    <div className={`rounded-lg bg-black/60 border border-white/20 overflow-hidden relative ${className}`}>
      {isCameraActive ? (
        <video ref={attachVideoWithAnalysis} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-caption text-white/30">Camera Off</span>
        </div>
      )}
      {/* Eye contact HUD overlay */}
      {isCameraActive && continuousActive && visualAnalysis.available && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-caption flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${visualAnalysis.metrics.eyeContactPercent > 60 ? "bg-green-400" : visualAnalysis.metrics.eyeContactPercent > 30 ? "bg-yellow-400" : "bg-red-400"}`} />
          <span className="text-white/80">{visualAnalysis.metrics.eyeContactPercent}%</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
        <span className="text-caption text-white/80 font-medium">You</span>
        {isCameraActive && <span className="text-caption px-1 rounded bg-green-500/30 text-green-300">Live</span>}
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col text-white relative overflow-hidden session-view">
      <ThemedBackground theme={theme} />

      {/* Generating feedback overlay */}
      <AnimatePresence>
        {isEnding && (
          <motion.div
            key="generating-overlay"
            className="absolute inset-0 z-50 bg-surface-base/90 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-5">
              <motion.div
                className="w-14 h-14 rounded-full border-2"
                style={{ borderColor: `${theme.accentColor}30`, borderTopColor: theme.accentColor }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
              <h2 className="text-xl font-semibold">Generating Feedback...</h2>
              <p className="text-sm text-white/40">
                {llmAvailable
                  ? `Analyzing your presentation with ${personas.length} AI personas`
                  : "Processing session data"}
              </p>
              {llmAvailable && generatingCount > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: theme.accentColor }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${(generatingCount / personas.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-white/30">{generatingCount} of {personas.length} personas</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col h-full">
        {/* === TOP BAR === */}
        <div className={`flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-b ${theme.topBarAccent} border-b border-white/5 flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
            <span className="text-xs font-medium truncate max-w-[120px] md:max-w-none hidden md:inline">{theme.label}</span>
            <span className="text-caption text-white/40 font-mono cursor-pointer" onClick={() => setShowDebug(!showDebug)}>{fmt(elapsed)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-white/40 hidden sm:inline">{personas.length} audience</span>
            <button onClick={onBack} className="text-caption text-white/40 hover:text-white/70 px-1.5 py-1 hidden sm:block">Back</button>
            <div className="hidden md:block w-px h-4 bg-white/10" />
            <button onClick={handleEndSession} disabled={isEnding} className="px-3 md:px-4 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg md:rounded text-sm font-medium">
              {isEnding ? "Ending..." : "End"}
            </button>
          </div>
        </div>

        {/* Debug panel — tap timer 3x to toggle */}
        {showDebug && (
          <div className="bg-black/90 text-caption text-green-400 font-mono px-2 py-1 max-h-[120px] overflow-y-auto flex-shrink-0">
            {debugLog.slice(-10).map((l, i) => <div key={i}>{l}</div>)}
            <button onClick={() => setShowDebug(false)} className="text-red-400 mt-1">Close Debug</button>
          </div>
        )}

        {/* === MAIN AREA === */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* AUDIENCE AREA with teleprompter overlay */}
          <div className="flex-1 p-2 md:p-4 min-h-0 overflow-hidden relative">
            {/* Mobile self-view — top right corner */}
            <div className="md:hidden absolute top-2 right-2 z-20">
              {selfView(`w-20 h-[60px] rounded-lg ${isCameraActive ? "ring-2 ring-green-400/60 shadow-lg shadow-green-500/20" : ""}`)}
            </div>

            <ThemedLayout theme={theme}>
              {audienceTiles}
            </ThemedLayout>

            {/* Mobile floating question card — shows most recent question only */}
            {isMobile && questionQueue.length > 0 && !speakingPersonaId && (
              <motion.button
                key={questionQueue[0].id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={() => handleQuestionClick(questionQueue[0])}
                className="absolute bottom-2 left-2 right-2 z-20 md:hidden"
              >
                <div className="bg-white/95 text-gray-900 rounded-xl px-4 py-3 shadow-xl shadow-black/40 border border-white/60">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🙋</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-0.5">
                        {personas.find((p) => p.id === questionQueue[0].personaId)?.name ?? "Someone"}
                      </p>
                      <p className="text-sm leading-snug line-clamp-2">"{questionQueue[0].question}"</p>
                    </div>
                  </div>
                  <div className="text-xs text-blue-600 mt-1.5 font-semibold flex items-center gap-1 justify-end">
                    <span>🔊</span> Tap to hear
                  </div>
                </div>
              </motion.button>
            )}

            {/* Teleprompter overlays at bottom of audience area */}
            {scriptConfig?.text && (
              <Teleprompter
                script={scriptConfig.text}
                isActive={showTeleprompter}
                isLive={continuousActive}
                onToggle={() => setShowTeleprompter(!showTeleprompter)}
              />
            )}
          </div>

          {/* === DESKTOP SIDEBAR === */}
          <div className="hidden md:flex w-72 border-l border-white/5 flex-col bg-black/20 flex-shrink-0">
            {/* Self-view at top of sidebar */}
            <div className="p-2 border-b border-white/5">
              {selfView("w-full aspect-video")}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/5 flex-shrink-0">
              {(["chat", "coach", "questions"] as SideTab[]).map((tab) => (
                <button
                  key={tab} onClick={() => setSideTab(tab)}
                  className={`flex-1 px-2 py-2 text-xs font-medium transition-colors relative ${sideTab === tab ? "text-white bg-surface-overlay" : "text-white/50 hover:text-white/70"}`}
                >
                  {tab === "questions" ? "Q&A" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "questions" && questionQueue.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-caption flex items-center justify-center font-bold">{questionQueue.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <TabContent
              sideTab={sideTab} questionQueue={questionQueue} personas={personas}
              speakingPersonaId={speakingPersonaId} ttsEnabled={ttsEnabled}
              speechMetrics={speechMetrics} prosodyMetrics={prosodyMetrics} visualMetrics={visualAnalysis.available ? visualAnalysis.metrics : undefined} chatMessages={chatMessages} chatEndRef={chatEndRef}
              onListen={handleListenToQuestion} onRead={handleReadQuestion}
              availableProviders={availableProviders} activeProvider={activeProvider} onProviderChange={setProvider}
              onDismiss={(id) => setQuestionQueue((prev) => prev.filter((q) => q.id !== id))}
              onToggleTTS={() => setTtsEnabled(!ttsEnabled)}
              continuousActive={continuousActive} interimTranscript={visibleInterim}
              reactionModel={reactionModel} feedbackModel={feedbackModel}
              onReactionModelChange={setReactionModel} onFeedbackModelChange={setFeedbackModel}
              diagnostics={diagnostics}
            />
          </div>
        </div>

        {/* === MOBILE BOTTOM SHEET === */}
        <AnimatePresence>
          {mobilePanel && (
            <>
              <motion.div
                key="backdrop" className="md:hidden fixed inset-0 z-30 bg-black/40"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobilePanel(null)}
              />
              <motion.div
                key="sheet"
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-base/95 backdrop-blur-md border-t border-white/5 rounded-t-2xl flex flex-col"
                style={{ maxHeight: "60dvh" }}
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 300) {
                    setMobilePanel(null);
                  }
                }}
              >
                <div className="flex items-center justify-center py-2.5 cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-white/30" />
                </div>
                <div className="flex border-b border-white/5 flex-shrink-0">
                  {(["chat", "coach", "questions"] as SideTab[]).map((tab) => (
                    <button
                      key={tab} onClick={() => setMobilePanel(tab)}
                      className={`flex-1 px-2 min-h-[44px] text-sm font-medium relative ${mobilePanel === tab ? "text-white bg-surface-overlay" : "text-white/50"}`}
                    >
                      {tab === "questions" ? "Q&A" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === "questions" && questionQueue.length > 0 && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 text-caption flex items-center justify-center font-bold">{questionQueue.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <TabContent
                    sideTab={mobilePanel} questionQueue={questionQueue} personas={personas}
                    speakingPersonaId={speakingPersonaId} ttsEnabled={ttsEnabled}
                    speechMetrics={speechMetrics} prosodyMetrics={prosodyMetrics} visualMetrics={visualAnalysis.available ? visualAnalysis.metrics : undefined} chatMessages={chatMessages} chatEndRef={chatEndRef}
                    onListen={handleListenToQuestion} onRead={handleReadQuestion}
                    onDismiss={(id) => setQuestionQueue((prev) => prev.filter((q) => q.id !== id))}
                    onToggleTTS={() => setTtsEnabled(!ttsEnabled)}
                    continuousActive={continuousActive} interimTranscript={visibleInterim}
                    reactionModel={reactionModel} feedbackModel={feedbackModel}
                    onReactionModelChange={setReactionModel} onFeedbackModelChange={setFeedbackModel}
                    diagnostics={diagnostics}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* === BOTTOM BAR === */}
        <div className="border-t border-white/5 bg-black/50 backdrop-blur-sm flex-shrink-0 safe-bottom">
          {/* Mobile live mode — simplified: just listening bar + stop */}
          <div className="md:hidden">
            {continuousActive ? (
              <div className="px-3 py-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-sm text-white/40 truncate flex-1">
                  {visibleInterim ? (
                    <span className="text-white/60 italic">{visibleInterim}</span>
                  ) : "Listening..."}
                </span>
                <button
                  onClick={stopContinuousMode}
                  className="px-4 min-h-[44px] bg-red-500/20 text-red-300 rounded-lg text-sm font-medium flex-shrink-0"
                >
                  Stop
                </button>
              </div>
            ) : (
              <div className="px-3 py-2">
                <div className="flex gap-2 items-center">
                  {/* Icon cluster: mic + camera + chat */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    <ToolbarBtn icon="mic" active={isListening} color={theme.accentColor} onClick={() => {
                      if (isListening) { stopListening(); stopProsody(); }
                      else { startListening().catch(() => {}); startProsody(); }
                    }} />
                    <ToolbarBtn icon="video" active={isCameraActive} color={theme.accentColor} onClick={() => {
                      if (isCameraActive) {
                        stopCamera();
                        visualAnalysis.stop();
                      } else {
                        startCamera().then(() => {
                          if (continuousActive && videoElRef.current) {
                            visualAnalysis.start(videoElRef.current).catch(() => {});
                          }
                        });
                      }
                    }} />
                    <button
                      onClick={() => setMobilePanel(mobilePanel ? null : "chat")}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-raised text-white/50 relative flex-shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2.5 2A1.5 1.5 0 001 3.5v8A1.5 1.5 0 002.5 13H4l4 3v-3h4.5a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0012.5 2h-10z" />
                      </svg>
                      {questionQueue.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />}
                    </button>
                  </div>

                  {/* Go Live — prominent CTA takes remaining width */}
                  <button
                    onClick={() => startContinuousMode()}
                    className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    Go Live
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop toolbar — unchanged layout */}
          <div className="hidden md:block">
            {/* Live indicator (separate row when active, visible above toolbar) */}
            {continuousActive && (
              <div className="px-3 py-1 border-b border-white/5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-label text-white/40 truncate flex-1">
                  {visibleInterim ? (
                    <span className="text-white/60 italic">{visibleInterim}</span>
                  ) : "Listening..."}
                </span>
                <button
                  onClick={stopContinuousMode}
                  className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-caption font-medium flex-shrink-0"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Desktop toolbar row */}
            <div className="px-4 py-2">
              <div className="max-w-3xl mx-auto flex gap-2 items-center">
                <ToolbarBtn icon="mic" active={isListening} color={theme.accentColor} onClick={() => {
                  if (isListening) { stopListening(); stopProsody(); }
                  else { startListening().catch(() => {}); startProsody(); }
                }} />
                <ToolbarBtn icon="video" active={isCameraActive} color={theme.accentColor} onClick={() => {
                  if (isCameraActive) {
                    stopCamera();
                    visualAnalysis.stop();
                  } else {
                    startCamera().then(() => {
                      if (continuousActive && videoElRef.current) {
                        visualAnalysis.start(videoElRef.current).catch(() => {});
                      }
                    });
                  }
                }} />

                {/* Text input (hidden when continuous mode is on) */}
                {!continuousActive && (
                  <>
                    <input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Type here..."
                      className="flex-1 min-w-0 bg-surface-raised border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-blue-400/50"
                    />
                    <button
                      onClick={handleSendMessage} disabled={!inputText.trim()}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 rounded-lg text-xs font-medium flex-shrink-0"
                    >
                      Send
                    </button>
                  </>
                )}

                {/* Go Live button (when not already live) */}
                {!continuousActive && (
                  <button
                    onClick={() => startContinuousMode()}
                    className="px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 bg-purple-500 hover:bg-purple-600 text-white whitespace-nowrap"
                  >
                    Go Live
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === TAB CONTENT (shared by desktop sidebar + mobile bottom sheet) ===
function TabContent({ sideTab, questionQueue, personas, speakingPersonaId, ttsEnabled, speechMetrics, prosodyMetrics, visualMetrics, chatMessages, chatEndRef, availableProviders, activeProvider, onProviderChange, onListen, onRead, onDismiss, onToggleTTS, continuousActive, interimTranscript, reactionModel, feedbackModel, onReactionModelChange, onFeedbackModelChange, diagnostics }: {
  sideTab: SideTab;
  questionQueue: QueuedQuestion[]; personas: Persona[]; speakingPersonaId: string | null;
  ttsEnabled: boolean;
  speechMetrics: { wordsPerMinute: number; fillerWordCount: number; vocabularyScore: number; longestPause: number };
  prosodyMetrics: { currentVolume: number; averageVolume: number; volumeVariation: number; pitchVariation: number; energyLevel: number; silenceRatio: number };
  visualMetrics?: { eyeContactPercent: number; expressiveness: number; gestureCount: number; handsVisible: boolean; framing: string };
  chatMessages: { from: string; text: string; time: number }[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  availableProviders?: string[]; activeProvider?: string; onProviderChange?: (p: any) => void;
  onListen: (q: QueuedQuestion) => void; onRead: (q: QueuedQuestion) => void;
  onDismiss: (id: string) => void; onToggleTTS: () => void;
  continuousActive: boolean; interimTranscript: string;
  reactionModel?: LLMModel; feedbackModel?: LLMModel;
  onReactionModelChange?: (m: LLMModel) => void; onFeedbackModelChange?: (m: LLMModel) => void;
  diagnostics?: DiagnosticEntry[];
}) {
  if (sideTab === "coach") {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-xs">
        <div className="text-caption text-white/30 uppercase tracking-wider mb-1">Content</div>
        <Stat label="WPM" value={speechMetrics.wordsPerMinute} color="blue" pct={Math.min(100, (speechMetrics.wordsPerMinute / 150) * 100)} />
        <Stat label="Filler Words" value={speechMetrics.fillerWordCount} color="orange" sub={speechMetrics.fillerWordCount > 5 ? "Try to reduce" : "Good"} />
        <Stat label="Vocabulary" value={speechMetrics.vocabularyScore} color="emerald" pct={speechMetrics.vocabularyScore} />
        <Stat label="Longest Pause" value={`${speechMetrics.longestPause.toFixed(1)}s`} color="yellow" sub={speechMetrics.longestPause > 3 ? "Take more pauses" : "Steady pace"} />

        <div className="border-t border-white/5 pt-2 mt-2">
          <div className="text-caption text-white/30 uppercase tracking-wider mb-1">Delivery</div>
          <Stat label="Volume" value={prosodyMetrics.averageVolume} color="cyan" pct={prosodyMetrics.averageVolume} sub={prosodyMetrics.averageVolume < 20 ? "Speak louder" : prosodyMetrics.averageVolume > 80 ? "Very loud" : "Good projection"} />
          <Stat label="Volume Dynamics" value={prosodyMetrics.volumeVariation} color="cyan" pct={prosodyMetrics.volumeVariation} sub={prosodyMetrics.volumeVariation < 15 ? "Too monotone" : "Good variation"} />
          <Stat label="Pitch Variety" value={prosodyMetrics.pitchVariation} color="purple" pct={prosodyMetrics.pitchVariation} sub={prosodyMetrics.pitchVariation < 10 ? "Monotone" : "Expressive"} />
          <Stat label="Energy" value={prosodyMetrics.energyLevel} color="rose" pct={prosodyMetrics.energyLevel} sub={prosodyMetrics.energyLevel < 20 ? "Low energy" : prosodyMetrics.energyLevel > 70 ? "High energy" : "Moderate"} />
          <Stat label="Silence" value={`${prosodyMetrics.silenceRatio}%`} color="gray" sub={prosodyMetrics.silenceRatio > 60 ? "Too many pauses" : "Good pace"} />
        </div>

        {visualMetrics && (
          <div className="border-t border-white/5 pt-2 mt-2">
            <div className="text-caption text-white/30 uppercase tracking-wider mb-1">Visual</div>
            <Stat label="Eye Contact" value={`${visualMetrics.eyeContactPercent}%`} color="emerald" pct={visualMetrics.eyeContactPercent} sub={visualMetrics.eyeContactPercent < 40 ? "Look at camera more" : visualMetrics.eyeContactPercent > 70 ? "Great eye contact" : "Good"} />
            <Stat label="Expressiveness" value={visualMetrics.expressiveness} color="purple" pct={visualMetrics.expressiveness} sub={visualMetrics.expressiveness < 20 ? "Try smiling more" : visualMetrics.expressiveness > 60 ? "Very expressive" : "Good"} />
            <Stat label="Gestures" value={visualMetrics.gestureCount} color="blue" sub={visualMetrics.handsVisible ? "Hands visible" : "Hands hidden"} />
            <Stat label="Framing" value={visualMetrics.framing === "good" ? "Good" : visualMetrics.framing === "too-close" ? "Too close" : visualMetrics.framing === "too-far" ? "Too far" : visualMetrics.framing === "off-center" ? "Off center" : "No face"} color={visualMetrics.framing === "good" ? "emerald" : "orange"} sub={visualMetrics.framing === "good" ? "Well framed" : "Adjust position"} />
          </div>
        )}
      </div>
    );
  }
  if (sideTab === "questions") {
    return (
      <QuestionQueue
        questions={questionQueue} personas={personas} speakingPersonaId={speakingPersonaId}
        ttsEnabled={ttsEnabled} availableProviders={availableProviders} activeProvider={activeProvider as any} onProviderChange={onProviderChange}
        onListen={onListen} onRead={onRead} onDismiss={onDismiss} onToggleTTS={onToggleTTS}
        reactionModel={reactionModel} feedbackModel={feedbackModel}
        onReactionModelChange={onReactionModelChange} onFeedbackModelChange={onFeedbackModelChange}
        diagnostics={diagnostics}
      />
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {chatMessages.length === 0 && <p className="text-xs text-white/20 text-center mt-6">Start speaking to see reactions...</p>}
      {chatMessages.map((msg, i) => (
        <div key={i} className={`text-xs ${msg.from === "You" ? "text-blue-300" : "text-white/70"}`}>
          <span className="font-medium">{msg.from}:</span> <span className="text-white/50">{msg.text}</span>
        </div>
      ))}
      {continuousActive && interimTranscript && (
        <div className="text-xs text-blue-300/50 italic">
          <span className="font-medium">You:</span> <span className="text-white/25">{interimTranscript}▋</span>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

function Stat({ label, value, color, pct, sub }: { label: string; value: number | string; color: string; pct?: number; sub?: string }) {
  const colorMap: Record<string, string> = { blue: "text-blue-400", orange: "text-orange-400", emerald: "text-emerald-400", yellow: "text-yellow-400", cyan: "text-cyan-400", purple: "text-purple-400", rose: "text-rose-400", gray: "text-gray-400" };
  const bgMap: Record<string, string> = { blue: "bg-blue-400", orange: "bg-orange-400", emerald: "bg-emerald-400", yellow: "bg-yellow-400", cyan: "bg-cyan-400", purple: "bg-purple-400", rose: "bg-rose-400", gray: "bg-gray-400" };
  return (
    <div>
      <div className="text-white/50 mb-0.5 text-label">{label}</div>
      <div className={`text-base font-bold ${colorMap[color]}`}>{value}</div>
      {pct !== undefined && (
        <div className="w-full h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
          <div className={`h-full ${bgMap[color]}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {sub && <div className="text-white/30 text-caption mt-0.5">{sub}</div>}
    </div>
  );
}

function ToolbarBtn({ icon, active, color, onClick }: { icon: string; active?: boolean; color: string; onClick: () => void }) {
  const paths: Record<string, string> = {
    mic: "M8 1a2.5 2.5 0 00-2.5 2.5v4a2.5 2.5 0 005 0v-4A2.5 2.5 0 008 1zM4 8.5a.5.5 0 011 0A3 3 0 008 11.5a3 3 0 003-3 .5.5 0 011 0 4 4 0 01-3.5 3.97V14h2a.5.5 0 010 1h-5a.5.5 0 010-1h2v-1.53A4 4 0 014 8.5z",
    video: "M2.5 3A1.5 1.5 0 001 4.5v7A1.5 1.5 0 002.5 13h7A1.5 1.5 0 0011 11.5v-2l3.5 2V4.5L11 6.5v-2A1.5 1.5 0 009.5 3h-7z",
  };
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${active ? "text-white" : "bg-surface-raised hover:bg-surface-overlay text-white/50"}`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d={paths[icon]} /></svg>
    </button>
  );
}

// Non-question reactive comments (questions go through the question queue only)
function getReactiveComment(persona: Persona, reaction: ReactionType): string | null {
  const positive: Record<string, string[]> = {
    analytical: ["Interesting data point.", "That tracks.", "Solid logic there."],
    emotional: ["I love that!", "That resonates.", "Really compelling."],
    skeptical: ["Hmm, we'll see.", "Bold claim.", "I've heard similar before."],
    supportive: ["Great point!", "Keep going.", "I like the direction."],
    blunt: ["Fair enough.", "Noted.", "OK, continue."],
  };
  const negative: Record<string, string[]> = {
    analytical: ["I'm not seeing the evidence.", "That's speculative.", "Unsubstantiated."],
    emotional: ["That feels off.", "I'm not convinced.", "Missing the human element."],
    skeptical: ["I don't buy it.", "Too optimistic.", "Prove it."],
    supportive: ["Hmm, maybe rethink that part.", "I see your intent, but...", "Almost there."],
    blunt: ["Weak argument.", "Not compelling.", "Try harder."],
  };
  const pool = (reaction === "nod" || reaction === "smile") ? positive : negative;
  const comments = pool[persona.communicationStyle] || pool.analytical;
  return comments[Math.floor(Math.random() * comments.length)];
}
