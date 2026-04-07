import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowUpCircle, RotateCcw, BarChart3 } from "lucide-react";
import { FeedbackItem } from "../data/feedbackEngine";
import { PERSONA_LIBRARY, Persona } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import ScrollFadeContainer from "./ScrollFadeContainer";
import { getSessionHistory, SessionRecord } from "../data/sessionHistory";
import { SessionPlayback, generateSessionEvents } from "./SessionPlayback";
import { SessionRecordingData } from "./MeetingRoom";

interface FeedbackViewProps {
  feedback: FeedbackItem[];
  transcript: string;
  recordingData?: SessionRecordingData;
  personas?: Persona[];  // optional override for custom names
  onNewSession: () => void;
  onViewSession?: (session: SessionRecord) => void;
  onViewProgress?: () => void;
}

// --- Radial Progress Ring ---
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const strokeColor = score >= 7 ? "#34d399" : score >= 5 ? "#facc15" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl md:text-4xl font-bold" style={{ color: strokeColor }}>{score}</span>
        <span className="text-caption text-white/30">/ 10</span>
      </div>
    </div>
  );
}

// --- Delivery Stat with per-metric threshold config ---
interface DeliveryStatProps {
  label: string;
  value: number;
  unit: string;
  advice: string;
  invertColor?: boolean; // true = high value is bad (e.g., Silence Ratio)
  lowIsBad?: boolean;    // true = low value is bad (e.g., Volume Dynamics)
}

function DeliveryStat({ label, value, unit, advice, invertColor, lowIsBad }: DeliveryStatProps) {
  let color: string;
  let barColor: string;

  if (invertColor) {
    // High = bad (Silence Ratio): high values are red, low values are green
    color = value > 60 ? "text-red-400" : value > 30 ? "text-yellow-400" : "text-emerald-400";
    barColor = value > 60 ? "bg-red-400" : value > 30 ? "bg-yellow-400" : "bg-emerald-400";
  } else if (lowIsBad) {
    // Low = bad (Volume Dynamics): low values are red, high values are green
    color = value < 15 ? "text-red-400" : value < 30 ? "text-yellow-400" : "text-emerald-400";
    barColor = value < 15 ? "bg-red-400" : value < 30 ? "bg-yellow-400" : "bg-emerald-400";
  } else {
    // Default: low = bad, high = good
    color = value < 20 ? "text-red-400" : value > 70 ? "text-emerald-400" : "text-yellow-400";
    barColor = value < 20 ? "bg-red-400" : value > 70 ? "bg-emerald-400" : "bg-yellow-400";
  }

  return (
    <div className="bg-surface-raised rounded-lg p-3">
      <div className="text-caption text-white/50 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}{unit}</div>
      <div className="w-full h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <div className="text-caption text-white/30 mt-1">{advice}</div>
    </div>
  );
}

export function FeedbackView({ feedback, transcript, recordingData, personas: sessionPersonas, onNewSession, onViewSession, onViewProgress }: FeedbackViewProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState<"feedback" | "recording" | "history">("feedback");
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);

  const avgScore = feedback.length > 0
    ? Math.round((feedback.reduce((sum, f) => sum + f.overallScore, 0) / feedback.length) * 10) / 10
    : 0;

  useEffect(() => { setSessionHistory(getSessionHistory()); }, []);

  const latestSession = sessionHistory.length > 0 ? sessionHistory[sessionHistory.length - 1] : null;
  const prosody = latestSession?.prosodyMetrics;
  const visual = latestSession?.visualMetrics;

  const selected = feedback[selectedIdx];
  const persona = sessionPersonas?.find((p) => p.id === selected?.personaId) ?? PERSONA_LIBRARY.find((p) => p.id === selected?.personaId);

  const scoreColor = (s: number) => s >= 7 ? "text-emerald-400" : s >= 5 ? "text-yellow-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 7 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 5 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";
  const scoreBar = (s: number) => s >= 7 ? "bg-emerald-400" : s >= 5 ? "bg-yellow-400" : "bg-red-400";

  const tabs = [
    { key: "feedback" as const, label: "Feedback", color: "border-blue-400" },
    ...(recordingData ? [{ key: "recording" as const, label: "Recording", color: "border-purple-400" }] : []),
    { key: "history" as const, label: "History", color: "border-blue-400" },
  ];

  return (
    <div className="px-4 md:px-6 py-4 md:py-8">
        {/* Animated Tabs */}
        <div className="relative flex gap-4 mb-section-sm md:mb-section border-b border-white/5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium ${tab === t.key ? "text-white" : "text-white/50"}`}
            >
              {t.label}
              {tab === t.key && (
                <motion.div
                  layoutId="feedback-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {tab === "feedback" && (
          <>
            {/* Hero Score — centered radial ring with inline stats */}
            <div className="flex flex-col items-center text-center mb-section-sm md:mb-section">
              <ScoreRing score={avgScore} size={140} />
              <div className="flex items-center gap-4 mt-3 text-xs md:text-sm text-white/50">
                <span>{feedback.length} persona{feedback.length !== 1 ? "s" : ""}</span>
                <span className="w-px h-3 bg-white/10" />
                <span>{transcript.split(/\s+/).filter(Boolean).length} words spoken</span>
              </div>
            </div>

            {/* Section Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-section-sm md:mb-section" />

            {/* Delivery Analysis (Prosody) */}
            {prosody && (
              <div className="rounded-lg border border-white/5 bg-surface-raised p-4 md:p-5 mb-section-sm md:mb-section">
                <h3 className="text-xs md:text-sm font-medium text-white/70 mb-3">Delivery Analysis</h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  <DeliveryStat label="Volume" value={prosody.averageVolume} unit="%" advice={prosody.averageVolume < 20 ? "Speak louder" : prosody.averageVolume > 80 ? "Too loud" : "Good"} />
                  <DeliveryStat label="Volume Dynamics" value={prosody.volumeVariation} unit="%" advice={prosody.volumeVariation < 15 ? "Too monotone" : "Good variety"} lowIsBad />
                  <DeliveryStat label="Pitch Variety" value={prosody.pitchVariation} unit="%" advice={prosody.pitchVariation < 10 ? "Monotone" : "Expressive"} />
                  <DeliveryStat label="Energy" value={prosody.energyLevel} unit="%" advice={prosody.energyLevel < 20 ? "Low" : prosody.energyLevel > 70 ? "High" : "Moderate"} />
                  <DeliveryStat label="Silence" value={prosody.silenceRatio} unit="%" advice={prosody.silenceRatio > 60 ? "Too many pauses" : "Good pace"} invertColor />
                </div>
              </div>
            )}

            {/* Visual Delivery Analysis */}
            {visual && (
              <div className="rounded-lg border border-white/5 bg-surface-raised p-4 md:p-5 mb-section-sm md:mb-section">
                <h3 className="text-xs md:text-sm font-medium text-white/70 mb-3">Visual Delivery</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DeliveryStat label="Eye Contact" value={visual.eyeContactPercent} unit="%" advice={visual.eyeContactPercent < 40 ? "Look at camera more" : visual.eyeContactPercent > 70 ? "Excellent" : "Good"} />
                  <DeliveryStat label="Expressiveness" value={visual.expressiveness} unit="%" advice={visual.expressiveness < 20 ? "Try more facial expression" : visual.expressiveness > 60 ? "Very expressive" : "Good"} />
                  <DeliveryStat label="Gestures" value={visual.gestureCount} unit="" advice={visual.gestureCount < 3 ? "Use more hand gestures" : visual.gestureCount > 20 ? "Very animated" : "Good movement"} />
                  <DeliveryStat label="Framing" value={visual.framing === "good" ? 100 : visual.framing === "no-face" ? 0 : 50} unit="%" advice={visual.framing === "good" ? "Well positioned" : visual.framing === "too-close" ? "Move back" : visual.framing === "too-far" ? "Move closer" : visual.framing === "off-center" ? "Center yourself" : "Face not detected"} />
                </div>
              </div>
            )}

            {/* Section Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-section-sm md:mb-section" />

            {/* Persona feedback detail */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Persona list — horizontal scroll on mobile, vertical on desktop */}
              <div className="md:w-56 flex-shrink-0">
                <ScrollFadeContainer
                  className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0 md:space-y-2"
                  fadeColor="#0f0f23"
                >
                  {feedback.map((fb, i) => {
                    const p = sessionPersonas?.find((pp) => pp.id === fb.personaId) ?? PERSONA_LIBRARY.find((pp) => pp.id === fb.personaId);
                    if (!p) return null;
                    return (
                      <button
                        key={fb.personaId}
                        onClick={() => setSelectedIdx(i)}
                        className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border text-left transition-all flex-shrink-0 md:w-full ${
                          i === selectedIdx
                            ? "border-blue-400 bg-blue-500/10"
                            : "border-white/5 bg-surface-raised hover:bg-surface-overlay"
                        }`}
                      >
                        <MiiAvatar persona={p} size={36} />
                        <div className="min-w-0">
                          <div className="text-xs md:text-sm font-medium truncate max-w-[80px] md:max-w-none">{p.name}</div>
                          <div className={`text-label font-bold ${scoreColor(fb.overallScore)}`}>{fb.overallScore}/10</div>
                        </div>
                      </button>
                    );
                  })}
                </ScrollFadeContainer>
              </div>

              {/* Detail panel */}
              {selected && persona && (
                <div className="flex-1 space-y-4 md:space-y-6">
                  {/* Compact Persona header — 48px avatar, name+score on one row, tags inline */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <MiiAvatar persona={persona} size={48} reaction={selected.overallScore >= 6 ? "smile" : selected.overallScore >= 4 ? "think" : "frown"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="text-sm md:text-base font-semibold truncate">{persona.name}</h2>
                        <span className={`text-sm font-bold ${scoreColor(selected.overallScore)}`}>{selected.overallScore}/10</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-caption px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{persona.profession}</span>
                        <span className="text-caption px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{persona.politicalLeaning}</span>
                        <span className="text-caption px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300">{persona.communicationStyle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className={`rounded-lg border p-4 md:p-5 ${scoreBg(selected.overallScore)}`}>
                    <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
                      <div className={`text-3xl md:text-4xl font-bold ${scoreColor(selected.overallScore)}`}>{selected.overallScore}</div>
                      <div>
                        <div className="text-xs md:text-sm font-medium">Overall Impression</div>
                        <div className="text-label md:text-xs text-white/50">{selected.emotionalResponse}</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 md:h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${scoreBar(selected.overallScore)}`} style={{ width: `${selected.overallScore * 10}%` }} />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg border border-white/5 bg-surface-raised p-4 md:p-5">
                    <h3 className="text-xs md:text-sm font-medium text-white/70 mb-1.5 md:mb-2">Summary</h3>
                    <p className="text-xs md:text-sm text-white/60 leading-relaxed">{selected.summary}</p>
                  </div>

                  {/* Strengths & Weaknesses — Lucide icons with left-border accent */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 md:p-5">
                      <h3 className="text-xs md:text-sm font-medium text-emerald-400 mb-2 md:mb-3">Strengths</h3>
                      <ul className="space-y-1.5 md:space-y-2">
                        {selected.strengths.map((s, i) => (
                          <li key={i} className="text-xs md:text-sm text-white/60 flex items-start gap-2 pl-2 border-l-2 border-emerald-500/30">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 md:p-5">
                      <h3 className="text-xs md:text-sm font-medium text-red-400 mb-2 md:mb-3">Areas for Improvement</h3>
                      <ul className="space-y-1.5 md:space-y-2">
                        {selected.weaknesses.map((w, i) => (
                          <li key={i} className="text-xs md:text-sm text-white/60 flex items-start gap-2 pl-2 border-l-2 border-red-500/30">
                            <ArrowUpCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Suggestion */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 md:p-5">
                    <h3 className="text-xs md:text-sm font-medium text-blue-400 mb-1.5 md:mb-2">Suggestion</h3>
                    <p className="text-xs md:text-sm text-white/60 leading-relaxed italic">"{selected.suggestion}"</p>
                    <p className="text-caption md:text-xs text-white/30 mt-1.5 md:mt-2">— {persona.name}, {persona.profession}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Post-Feedback CTA */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-section-sm md:mt-section mb-section-sm md:mb-section" />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onNewSession}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Practice Again
              </button>
              {onViewProgress && (
                <button
                  onClick={onViewProgress}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 bg-surface-raised hover:bg-surface-overlay text-white/70 text-sm font-medium transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Progress
                </button>
              )}
            </div>
          </>
        )}

        {tab === "recording" && recordingData && (
          <div>
            <h3 className="text-sm md:text-base font-medium mb-4">Session Recording & Delivery Analysis</h3>
            <SessionPlayback
              audioUrl={recordingData.audioUrl}
              duration={recordingData.duration}
              timeline={recordingData.timeline}
              events={generateSessionEvents(recordingData.timeline, latestSession?.speechMetrics?.fillerWordCount || 0, recordingData.chatMessages)}
              transcript={transcript}
              chatMessages={recordingData.chatMessages}
              wpm={latestSession?.speechMetrics?.wordsPerMinute || 0}
              fillerCount={latestSession?.speechMetrics?.fillerWordCount || 0}
              sessionType={latestSession?.sessionType || "business-pitch"}
            />
          </div>
        )}

        {tab === "history" && (
          <div>
            {sessionHistory.length === 0 ? (
              <div className="text-center py-8 text-white/50 text-sm">
                No session history yet. Start practicing to build your history.
              </div>
            ) : (
              <div className="space-y-3">
                {sessionHistory.map((session) => {
                  const scores = Object.values(session.perPersonaScores);
                  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : session.overallScore || 0;
                  return (
                    <button
                      key={session.id}
                      onClick={() => session.feedback && onViewSession?.(session)}
                      className={`rounded-lg border border-white/5 bg-surface-raised p-3 md:p-4 w-full text-left transition-all ${session.feedback ? "hover:bg-surface-overlay cursor-pointer" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-2 md:mb-3">
                        <div>
                          <div className="text-xs md:text-sm font-medium mb-0.5">{session.sessionType.replace(/-/g, " ")}</div>
                          <div className="text-caption md:text-xs text-white/50">
                            {new Date(session.date).toLocaleDateString()} at {new Date(session.date).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className={`text-lg md:text-2xl font-bold ${scoreColor(avg)}`}>{avg.toFixed(1)}</div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 md:gap-2 text-caption md:text-xs">
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Personas</div><div className="font-medium">{session.personaIds.length}</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Words</div><div className="font-medium">{session.wordCount}</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Duration</div><div className="font-medium">{Math.floor(session.duration / 60)}m</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">WPM</div><div className="font-medium">{session.speechMetrics.wordsPerMinute}</div></div>
                      </div>
                      {session.feedback && <div className="text-caption text-blue-400 mt-2">Click to view full report</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
