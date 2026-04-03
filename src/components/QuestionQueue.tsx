import { motion, AnimatePresence } from "framer-motion";
import { Persona } from "../data/personas";
import { HandRaiseEvent } from "../data/feedbackEngine";
import { MiiAvatar } from "./MiiAvatar";
import { TTSProvider } from "../hooks/useTTS";

export interface QueuedQuestion {
  id: string;
  personaId: string;
  question: string;
  timestamp: number;
}

interface QuestionQueueProps {
  questions: QueuedQuestion[];
  personas: Persona[];
  speakingPersonaId: string | null;
  ttsEnabled: boolean;
  availableProviders?: string[];
  activeProvider?: TTSProvider;
  onProviderChange?: (p: TTSProvider) => void;
  onListen: (question: QueuedQuestion) => void;
  onRead: (question: QueuedQuestion) => void;
  onDismiss: (questionId: string) => void;
  onToggleTTS: () => void;
}

export function QuestionQueue({
  questions,
  personas,
  speakingPersonaId,
  ttsEnabled,
  availableProviders = [],
  activeProvider = "auto",
  onProviderChange,
  onListen,
  onRead,
  onDismiss,
  onToggleTTS,
}: QuestionQueueProps) {
  const providerLabels: Record<string, string> = {
    auto: "Auto",
    elevenlabs: "ElevenLabs",
    openai: "OpenAI",
    browser: "Browser",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* TTS controls */}
      <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Voice Feedback</span>
          <button
            onClick={onToggleTTS}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              ttsEnabled
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/5 text-white/40 hover:text-white/60"
            }`}
        >
          {ttsEnabled ? "ON" : "OFF"}
        </button>
        </div>

        {/* Provider selector — only shows when TTS is on and multiple providers exist */}
        {ttsEnabled && availableProviders.length > 0 && onProviderChange && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-white/30 mr-1">Voice:</span>
            {["auto", ...availableProviders, "browser"].map((p) => (
              <button
                key={p}
                onClick={() => onProviderChange(p as TTSProvider)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                  activeProvider === p
                    ? p === "elevenlabs" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"
                    : "bg-white/5 text-white/30 hover:text-white/50"
                }`}
              >
                {providerLabels[p] || p}
                {p === "elevenlabs" && <span className="ml-0.5 text-[7px]">PRO</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {questions.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-white/20 text-center mt-6 px-2"
            >
              Audience questions will appear here. Keep presenting to prompt questions.
            </motion.p>
          )}

          {questions.map((q) => {
            const persona = personas.find((p) => p.id === q.personaId);
            if (!persona) return null;
            const isSpeaking = speakingPersonaId === q.personaId;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`rounded-lg border p-2.5 transition-colors ${
                  isSpeaking
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/5 bg-surface-raised"
                }`}
              >
                {/* Persona info */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 flex-shrink-0">
                    <MiiAvatar
                      persona={persona}
                      size={28}
                      reaction={isSpeaking ? "speaking" : "raised-hand"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white truncate">
                      {persona.name}
                    </div>
                    <div className="text-[9px] text-white/30">{persona.communicationStyle}</div>
                  </div>
                  {isSpeaking && (
                    <div className="flex gap-0.5 items-end h-3">
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-sound-bar-1" style={{ height: "40%" }} />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-sound-bar-2" style={{ height: "70%" }} />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-sound-bar-3" style={{ height: "50%" }} />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-sound-bar-1" style={{ height: "80%" }} />
                    </div>
                  )}
                </div>

                {/* Question text */}
                <p className="text-[11px] text-white/60 leading-relaxed mb-2 line-clamp-3">
                  "{q.question}"
                </p>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  {ttsEnabled && (
                    <button
                      onClick={() => onListen(q)}
                      disabled={isSpeaking}
                      className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        isSpeaking
                          ? "bg-emerald-500/20 text-emerald-300 cursor-not-allowed"
                          : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                      }`}
                    >
                      {isSpeaking ? "Speaking..." : "Listen"}
                    </button>
                  )}
                  <button
                    onClick={() => onRead(q)}
                    className="flex-1 px-2 py-1 rounded text-[10px] font-medium bg-surface-raised text-white/50 hover:bg-surface-overlay hover:text-white/70 transition-colors"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => onDismiss(q.id)}
                    className="px-2 py-1 rounded text-[10px] text-white/30 hover:text-white/50 hover:bg-surface-overlay transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Queue count footer */}
      {questions.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5 text-center">
          <span className="text-[10px] text-white/30">{questions.length} pending</span>
        </div>
      )}
    </div>
  );
}

export function handRaiseToQueuedQuestion(event: HandRaiseEvent): QueuedQuestion {
  return {
    id: `${event.personaId}-${Date.now()}`,
    personaId: event.personaId,
    question: event.question,
    timestamp: Date.now(),
  };
}
