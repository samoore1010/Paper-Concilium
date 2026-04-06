import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Persona } from "../data/personas";
import { HandRaiseEvent } from "../data/feedbackEngine";
import { MiiAvatar } from "./MiiAvatar";
import { TTSProvider } from "../hooks/useTTS";
import { LLMModel, LLM_MODEL_LABELS, LLMMetadata } from "../data/llmApi";

export interface QueuedQuestion {
  id: string;
  personaId: string;
  question: string;
  timestamp: number;
}

export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  type: "reaction" | "feedback" | "tts" | "error";
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  personaId?: string;
  status: "success" | "error";
  message: string;
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
  // Admin model controls
  reactionModel?: LLMModel;
  feedbackModel?: LLMModel;
  onReactionModelChange?: (m: LLMModel) => void;
  onFeedbackModelChange?: (m: LLMModel) => void;
  diagnostics?: DiagnosticEntry[];
}

const ALL_MODELS: LLMModel[] = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"];

function ModelPicker({ label, value, onChange, color }: { label: string; value: LLMModel; onChange: (m: LLMModel) => void; color: string }) {
  const colorMap: Record<string, { active: string; badge: string }> = {
    amber: { active: "bg-amber-500/20 text-amber-300", badge: "text-amber-400" },
    violet: { active: "bg-violet-500/20 text-violet-300", badge: "text-violet-400" },
  };
  const colors = colorMap[color] || colorMap.amber;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-caption text-white/30 mr-1">{label}:</span>
      {ALL_MODELS.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`text-caption px-1.5 py-0.5 rounded transition-colors ${
            value === m ? colors.active : "bg-white/5 text-white/30 hover:text-white/50"
          }`}
        >
          {LLM_MODEL_LABELS[m]}
        </button>
      ))}
    </div>
  );
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
  reactionModel = "claude-haiku-4-5-20251001",
  feedbackModel = "claude-sonnet-4-6",
  onReactionModelChange,
  onFeedbackModelChange,
  diagnostics = [],
}: QuestionQueueProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const providerLabels: Record<string, string> = {
    auto: "Auto",
    elevenlabs: "ElevenLabs",
    openai: "OpenAI",
    browser: "Browser",
  };

  const recentDiags = diagnostics.slice(-20).reverse();
  const successCount = diagnostics.filter((d) => d.status === "success").length;
  const errorCount = diagnostics.filter((d) => d.status === "error").length;
  const avgLatency = diagnostics.filter((d) => d.latencyMs).length > 0
    ? Math.round(diagnostics.filter((d) => d.latencyMs).reduce((sum, d) => sum + (d.latencyMs || 0), 0) / diagnostics.filter((d) => d.latencyMs).length)
    : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* TTS + Model controls */}
      <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-caption text-white/40 uppercase tracking-wider">Voice Feedback</span>
          <button
            onClick={onToggleTTS}
            className={`text-caption px-2 py-1 rounded transition-colors ${
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
            <span className="text-caption text-white/30 mr-1">Voice:</span>
            {["auto", ...availableProviders, "browser"].map((p) => (
              <button
                key={p}
                onClick={() => onProviderChange(p as TTSProvider)}
                className={`text-caption px-1.5 py-0.5 rounded transition-colors ${
                  activeProvider === p
                    ? p === "elevenlabs" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"
                    : "bg-white/5 text-white/30 hover:text-white/50"
                }`}
              >
                {providerLabels[p] || p}
                {p === "elevenlabs" && <span className="ml-0.5 text-caption">PRO</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model selection controls */}
      {(onReactionModelChange || onFeedbackModelChange) && (
        <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-white/40 uppercase tracking-wider">LLM Models</span>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`text-caption px-2 py-0.5 rounded transition-colors ${
                showDiagnostics ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-white/30 hover:text-white/50"
              }`}
            >
              {showDiagnostics ? "Hide Log" : "Show Log"}
            </button>
          </div>

          {onReactionModelChange && (
            <ModelPicker label="Reactions" value={reactionModel} onChange={onReactionModelChange} color="amber" />
          )}
          {onFeedbackModelChange && (
            <ModelPicker label="Feedback" value={feedbackModel} onChange={onFeedbackModelChange} color="violet" />
          )}

          {/* Quick stats bar */}
          {diagnostics.length > 0 && (
            <div className="flex items-center gap-3 text-caption">
              <span className="text-emerald-400">{successCount} ok</span>
              {errorCount > 0 && <span className="text-red-400">{errorCount} err</span>}
              {avgLatency > 0 && <span className="text-white/30">avg {avgLatency}ms</span>}
              <span className="text-white/20">|</span>
              <span className="text-white/30">{diagnostics.length} calls</span>
            </div>
          )}
        </div>
      )}

      {/* Diagnostics log panel */}
      {showDiagnostics && (
        <div className="border-b border-white/5 max-h-48 overflow-y-auto">
          {recentDiags.length === 0 ? (
            <p className="text-caption text-white/20 text-center py-3 px-2">
              No API calls yet. Start presenting to see diagnostics.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {recentDiags.map((d) => (
                <div key={d.id} className="px-3 py-1.5 text-caption space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.status === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className={`font-medium truncate ${
                        d.type === "reaction" ? "text-amber-300" :
                        d.type === "feedback" ? "text-violet-300" :
                        d.type === "tts" ? "text-blue-300" :
                        "text-red-300"
                      }`}>
                        {d.type}
                      </span>
                      {d.model && (
                        <span className="text-white/20 truncate">
                          {LLM_MODEL_LABELS[d.model as LLMModel] || d.model}
                        </span>
                      )}
                      {d.personaId && (
                        <span className="text-white/15 truncate">{d.personaId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-white/25">
                      {d.latencyMs !== undefined && <span>{d.latencyMs}ms</span>}
                      {d.inputTokens !== undefined && <span>{d.inputTokens}+{d.outputTokens}tok</span>}
                    </div>
                  </div>
                  {d.status === "error" && (
                    <p className="text-red-400/70 text-caption truncate pl-3">{d.message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    <div className="text-label font-medium text-white truncate">
                      {persona.name}
                    </div>
                    <div className="text-caption text-white/30">{persona.communicationStyle}</div>
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
                <p className="text-label text-white/60 leading-relaxed mb-2 line-clamp-3">
                  "{q.question}"
                </p>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  {ttsEnabled && (
                    <button
                      onClick={() => onListen(q)}
                      disabled={isSpeaking}
                      className={`flex-1 px-2 py-1 rounded text-caption font-medium transition-colors ${
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
                    className="flex-1 px-2 py-1 rounded text-caption font-medium bg-surface-raised text-white/50 hover:bg-surface-overlay hover:text-white/70 transition-colors"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => onDismiss(q.id)}
                    className="px-2 py-1 rounded text-caption text-white/30 hover:text-white/50 hover:bg-surface-overlay transition-colors"
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
          <span className="text-caption text-white/30">{questions.length} pending</span>
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
