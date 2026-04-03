import { useState, useEffect } from "react";
import { FeedbackItem } from "../data/feedbackEngine";
import { PERSONA_LIBRARY } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import { getSessionHistory, SessionRecord } from "../data/sessionHistory";
import { SessionPlayback, generateSessionEvents } from "./SessionPlayback";
import { SessionRecordingData } from "./MeetingRoom";

interface FeedbackViewProps {
  feedback: FeedbackItem[];
  transcript: string;
  recordingData?: SessionRecordingData;
  onNewSession: () => void;
  onViewSession?: (session: SessionRecord) => void;
}

export function FeedbackView({ feedback, transcript, recordingData, onNewSession, onViewSession }: FeedbackViewProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState<"feedback" | "recording" | "history">("feedback");
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);

  const avgScore = feedback.length > 0
    ? Math.round((feedback.reduce((sum, f) => sum + f.overallScore, 0) / feedback.length) * 10) / 10
    : 0;

  useEffect(() => { setSessionHistory(getSessionHistory()); }, []);

  // Get the most recent session (the one we just completed) for prosody data
  const latestSession = sessionHistory.length > 0 ? sessionHistory[sessionHistory.length - 1] : null;
  const prosody = latestSession?.prosodyMetrics;

  const selected = feedback[selectedIdx];
  const persona = PERSONA_LIBRARY.find((p) => p.id === selected?.personaId);

  const scoreColor = (s: number) => s >= 7 ? "text-emerald-400" : s >= 5 ? "text-yellow-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 7 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 5 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";
  const scoreBar = (s: number) => s >= 7 ? "bg-emerald-400" : s >= 5 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="min-h-[100dvh] bg-surface-base text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base md:text-lg font-semibold">Session Feedback</h1>
            <p className="text-[11px] md:text-xs text-white/40">Review critiques from your audience</p>
          </div>
          <button onClick={onNewSession} className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs md:text-sm font-medium">
            New Session
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 md:mb-8 border-b border-white/5">
          <button onClick={() => setTab("feedback")} className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 ${tab === "feedback" ? "border-blue-400 text-white" : "border-transparent text-white/50"}`}>
            Feedback
          </button>
          {recordingData && (
            <button onClick={() => setTab("recording")} className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 ${tab === "recording" ? "border-purple-400 text-white" : "border-transparent text-white/50"}`}>
              Recording
            </button>
          )}
          <button onClick={() => setTab("history")} className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 ${tab === "history" ? "border-blue-400 text-white" : "border-transparent text-white/50"}`}>
            History
          </button>
        </div>

        {tab === "feedback" && (
          <>
            {/* Summary — responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
              <div className={`rounded-lg border p-3 md:p-4 ${scoreBg(avgScore)}`}>
                <div className="text-[10px] md:text-xs text-white/50 mb-0.5">Score</div>
                <div className={`text-xl md:text-3xl font-bold ${scoreColor(avgScore)}`}>{avgScore}</div>
                <div className="text-[10px] text-white/30">out of 10</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-surface-raised p-3 md:p-4">
                <div className="text-[10px] md:text-xs text-white/50 mb-0.5">Audience</div>
                <div className="text-xl md:text-3xl font-bold">{feedback.length}</div>
                <div className="text-[10px] text-white/30">personas</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-surface-raised p-3 md:p-4">
                <div className="text-[10px] md:text-xs text-white/50 mb-0.5">Words</div>
                <div className="text-xl md:text-3xl font-bold">{transcript.split(/\s+/).filter(Boolean).length}</div>
                <div className="text-[10px] text-white/30">spoken</div>
              </div>
            </div>

            {/* Delivery Analysis (Prosody) */}
            {prosody && (
              <div className="rounded-lg border border-white/5 bg-surface-raised p-4 md:p-5 mb-6 md:mb-8">
                <h3 className="text-xs md:text-sm font-medium text-white/70 mb-3">Delivery Analysis</h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  <DeliveryStat label="Volume" value={prosody.averageVolume} unit="%" advice={prosody.averageVolume < 20 ? "Speak louder" : prosody.averageVolume > 80 ? "Too loud" : "Good"} />
                  <DeliveryStat label="Volume Dynamics" value={prosody.volumeVariation} unit="%" advice={prosody.volumeVariation < 15 ? "Too monotone" : "Good variety"} />
                  <DeliveryStat label="Pitch Variety" value={prosody.pitchVariation} unit="%" advice={prosody.pitchVariation < 10 ? "Monotone" : "Expressive"} />
                  <DeliveryStat label="Energy" value={prosody.energyLevel} unit="%" advice={prosody.energyLevel < 20 ? "Low" : prosody.energyLevel > 70 ? "High" : "Moderate"} />
                  <DeliveryStat label="Silence" value={prosody.silenceRatio} unit="%" advice={prosody.silenceRatio > 60 ? "Too many pauses" : "Good pace"} />
                </div>
              </div>
            )}

            {/* Persona feedback detail */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Persona list — horizontal scroll on mobile, vertical on desktop */}
              <div className="md:w-56 flex-shrink-0">
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0 md:space-y-2">
                  {feedback.map((fb, i) => {
                    const p = PERSONA_LIBRARY.find((pp) => pp.id === fb.personaId);
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
                          <div className={`text-[11px] font-bold ${scoreColor(fb.overallScore)}`}>{fb.overallScore}/10</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detail panel */}
              {selected && persona && (
                <div className="flex-1 space-y-4 md:space-y-6">
                  {/* Persona header */}
                  <div className="flex items-start gap-3 md:gap-5">
                    <div className="flex-shrink-0">
                      <MiiAvatar persona={persona} size={70} reaction={selected.overallScore >= 6 ? "smile" : selected.overallScore >= 4 ? "think" : "frown"} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base md:text-xl font-semibold mb-1">{persona.name}</h2>
                      <p className="text-xs md:text-sm text-white/50 mb-2 line-clamp-2">{persona.bio}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{persona.profession}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{persona.politicalLeaning}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300">{persona.communicationStyle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`rounded-lg border p-4 md:p-5 ${scoreBg(selected.overallScore)}`}>
                    <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
                      <div className={`text-3xl md:text-4xl font-bold ${scoreColor(selected.overallScore)}`}>{selected.overallScore}</div>
                      <div>
                        <div className="text-xs md:text-sm font-medium">Overall Impression</div>
                        <div className="text-[11px] md:text-xs text-white/50">{selected.emotionalResponse}</div>
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

                  {/* Strengths & Weaknesses — stack on mobile, side-by-side on desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 md:p-5">
                      <h3 className="text-xs md:text-sm font-medium text-emerald-400 mb-2 md:mb-3">Strengths</h3>
                      <ul className="space-y-1.5 md:space-y-2">
                        {selected.strengths.map((s, i) => (
                          <li key={i} className="text-xs md:text-sm text-white/60 flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">+</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 md:p-5">
                      <h3 className="text-xs md:text-sm font-medium text-red-400 mb-2 md:mb-3">Areas for Improvement</h3>
                      <ul className="space-y-1.5 md:space-y-2">
                        {selected.weaknesses.map((w, i) => (
                          <li key={i} className="text-xs md:text-sm text-white/60 flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">-</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Suggestion */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 md:p-5">
                    <h3 className="text-xs md:text-sm font-medium text-blue-400 mb-1.5 md:mb-2">Suggestion</h3>
                    <p className="text-xs md:text-sm text-white/60 leading-relaxed italic">"{selected.suggestion}"</p>
                    <p className="text-[10px] md:text-xs text-white/30 mt-1.5 md:mt-2">— {persona.name}, {persona.profession}</p>
                  </div>
                </div>
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
                          <div className="text-[10px] md:text-xs text-white/50">
                            {new Date(session.date).toLocaleDateString()} at {new Date(session.date).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className={`text-lg md:text-2xl font-bold ${scoreColor(avg)}`}>{avg.toFixed(1)}</div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 md:gap-2 text-[10px] md:text-xs">
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Personas</div><div className="font-medium">{session.personaIds.length}</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Words</div><div className="font-medium">{session.wordCount}</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">Duration</div><div className="font-medium">{Math.floor(session.duration / 60)}m</div></div>
                        <div className="bg-white/5 rounded px-2 py-1"><div className="text-white/50">WPM</div><div className="font-medium">{session.speechMetrics.wordsPerMinute}</div></div>
                      </div>
                      {session.feedback && <div className="text-[10px] text-blue-400 mt-2">Click to view full report</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryStat({ label, value, unit, advice }: { label: string; value: number; unit: string; advice: string }) {
  const color = value < 20 ? "text-red-400" : value > 70 ? "text-emerald-400" : "text-yellow-400";
  const barColor = value < 20 ? "bg-red-400" : value > 70 ? "bg-emerald-400" : "bg-yellow-400";
  return (
    <div className="bg-surface-raised rounded-lg p-3">
      <div className="text-[10px] text-white/50 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}{unit}</div>
      <div className="w-full h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <div className="text-[9px] text-white/30 mt-1">{advice}</div>
    </div>
  );
}
