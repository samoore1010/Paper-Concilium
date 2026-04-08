import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { ProsodyFrame } from "../hooks/useProsody";
import { generateCoachingReport, CoachingReport } from "../data/prosodyAnalysis";

export interface SessionEvent {
  time: number;       // seconds
  type: "filler" | "volume-drop" | "monotone" | "emphasis" | "interrupt" | "silence";
  label: string;
  severity: "info" | "warning" | "good";
}

export interface ChatMessage {
  from: string;
  text: string;
  time: number; // seconds from session start
}

interface SessionPlaybackProps {
  audioUrl: string;
  duration: number;
  timeline: ProsodyFrame[];
  events: SessionEvent[];
  transcript: string;
  chatMessages?: ChatMessage[];
  wpm?: number;
  fillerCount?: number;
  sessionType?: string;
}

export function SessionPlayback({ audioUrl, duration, timeline, events, transcript, chatMessages = [], wpm = 0, fillerCount = 0, sessionType = "business-pitch" }: SessionPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeMetric, setActiveMetric] = useState<"volume" | "pitch" | "energy">("volume");
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  // Reserve space at bottom of canvas for time axis labels
  const TIME_AXIS_HEIGHT = 18;

  // Redraw canvas on resize
  const [canvasSize, setCanvasSize] = useState(0); // triggers redraw
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => setCanvasSize((n) => n + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw the waveform/prosody graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timeline.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const totalH = rect.height;
    const h = totalH - TIME_AXIS_HEIGHT; // drawable area above time axis

    // Clear
    ctx.clearRect(0, 0, w, totalH);

    // Background horizontal grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Prefer audio duration so the chart never extends beyond the recording.
    const maxTime = duration || timeline[timeline.length - 1]?.time || 1;

    // Time axis labels and vertical gridlines
    const timeInterval = maxTime <= 60 ? 15 : maxTime <= 180 ? 30 : 60;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (let t = timeInterval; t < maxTime; t += timeInterval) {
      const x = (t / maxTime) * w;
      // Vertical gridline
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      // Time label
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(formatTime(t), x, totalH - 4);
    }

    // Volume bars (background)
    ctx.fillStyle = "rgba(99, 102, 241, 0.1)";
    timeline.forEach((frame) => {
      const x = (frame.time / maxTime) * w;
      const barH = (frame.volume / 100) * h;
      ctx.fillRect(x - 0.5, h - barH, 1.5, barH);
    });

    // Active metric line
    const getVal = (f: ProsodyFrame) => {
      if (activeMetric === "volume") return f.volume;
      if (activeMetric === "pitch") return Math.min(100, (f.pitch / 400) * 100);
      return f.energy;
    };

    const colors = { volume: "#6366f1", pitch: "#f59e0b", energy: "#10b981" };
    ctx.strokeStyle = colors[activeMetric];
    ctx.lineWidth = 2;
    ctx.beginPath();
    timeline.forEach((frame, i) => {
      const x = (frame.time / maxTime) * w;
      const y = h - (getVal(frame) / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under the line
    const lastFrame = timeline[timeline.length - 1];
    if (lastFrame) {
      ctx.lineTo((lastFrame.time / maxTime) * w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = colors[activeMetric] + "15";
      ctx.fill();
    }

    // Draw event markers with staggering and drop lines
    const markerColors = { info: "#6366f1", warning: "#f59e0b", good: "#10b981" };
    const markerPositions: { x: number; y: number }[] = [];
    events.forEach((evt) => {
      const x = (evt.time / maxTime) * w;
      let markerY = 14;
      // Stagger vertically when markers overlap within 12px
      for (const prev of markerPositions) {
        if (Math.abs(prev.x - x) < 12 && Math.abs(prev.y - markerY) < 12) {
          markerY += 14;
        }
      }
      markerPositions.push({ x, y: markerY });

      // Drop line from marker to waveform bottom
      ctx.strokeStyle = markerColors[evt.severity] + "40";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, markerY + 6);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Marker circle with white border ring
      ctx.fillStyle = markerColors[evt.severity];
      ctx.beginPath();
      ctx.arc(x, markerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Metric legend badge (top-left)
    const metricLabels = { volume: "Volume", pitch: "Pitch", energy: "Energy" };
    const labelText = metricLabels[activeMetric];
    ctx.font = "600 10px system-ui, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const badgeW = textW + 20;
    const badgeH = 18;
    const badgeX = 8;
    const badgeY = h - badgeH - 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();
    // Color dot
    ctx.fillStyle = colors[activeMetric];
    ctx.beginPath();
    ctx.arc(badgeX + 8, badgeY + badgeH / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Label text
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText(labelText, badgeX + 15, badgeY + badgeH / 2 + 3.5);

    // Draw playback position
    if (currentTime > 0) {
      const px = (currentTime / maxTime) * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();

      // Playhead dot
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [timeline, events, currentTime, activeMetric, duration, canvasSize]);

  // Sync audio time to state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleEnd = () => { setIsPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("ended", handleEnd);
    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("ended", handleEnd);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackSpeed;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("[Playback] Play failed:", err);
        // Retry: some browsers need a user-initiated load before play
        audio.load();
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      });
    }
  }, [isPlaying, playbackSpeed]);

  const seekTo = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    // Prefer audio duration so the chart never extends beyond the recording.
    const maxTime = duration || timeline[timeline.length - 1]?.time || 1;
    audio.currentTime = pct * maxTime;
    setCurrentTime(audio.currentTime);
  }, [timeline, duration]);

  // Find events near current playback time
  const activeEvents = events.filter((e) => Math.abs(e.time - currentTime) < 2);

  // Generate coaching report
  const coachingReport = useMemo(() => {
    if (timeline.length < 10) return null;
    return generateCoachingReport(timeline, wpm, fillerCount, duration, sessionType);
  }, [timeline, wpm, fillerCount, duration, sessionType]);

  if (!audioUrl) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No audio recording available for this session.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* Metric selector */}
      <div className="flex items-center gap-2">
        <span className="text-caption text-white/40">Show:</span>
        {(["volume", "pitch", "energy"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMetric(m)}
            className={`text-caption px-2 py-1 rounded transition-colors ${
              activeMetric === m
                ? m === "volume" ? "bg-indigo-500/20 text-indigo-300"
                : m === "pitch" ? "bg-amber-500/20 text-amber-300"
                : "bg-emerald-500/20 text-emerald-300"
                : "bg-white/5 text-white/40"
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Waveform canvas — responsive height */}
      <div ref={containerRef} className="relative rounded-lg bg-surface-raised border border-white/5 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-pointer h-[180px] sm:h-[220px] md:h-[260px] lg:h-[300px]"
          onClick={seekTo}
        />
        {/* Current time / duration overlays */}
        <div className="absolute bottom-5 left-2 text-caption text-white/30 font-mono">{formatTime(currentTime)}</div>
        <div className="absolute bottom-5 right-2 text-caption text-white/30 font-mono">{formatTime(duration)}</div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-surface-overlay hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-caption text-white/40">Speed:</span>
          {[0.5, 1, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => {
                setPlaybackSpeed(s);
                if (audioRef.current) audioRef.current.playbackRate = s;
              }}
              className={`text-caption px-2 py-1 rounded transition-colors ${playbackSpeed === s ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Event markers list */}
      {events.length > 0 && (
        <div className="space-y-1">
          <div className="text-caption text-white/40 uppercase tracking-wider">Session Events</div>
          <div className="max-h-[200px] overflow-y-auto scroll-touch space-y-1">
            {events.map((evt, i) => {
              const isActive = Math.abs(evt.time - currentTime) < 2;
              const colors = { info: "text-indigo-400", warning: "text-amber-400", good: "text-emerald-400" };
              const icons = { filler: "🔇", "volume-drop": "📉", monotone: "😐", emphasis: "💪", interrupt: "✋", silence: "⏸" };
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = evt.time;
                      setCurrentTime(evt.time);
                    }
                  }}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-label transition-colors ${
                    isActive ? "bg-surface-overlay" : "bg-surface-raised hover:bg-surface-overlay"
                  }`}
                >
                  <span className="text-xs">{icons[evt.type] || "📌"}</span>
                  <span className="text-white/30 font-mono text-caption w-10">{formatTime(evt.time)}</span>
                  <span className={colors[evt.severity]}>{evt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Chat Log */}
      {chatMessages.length > 0 && (
        <div className="space-y-1">
          <div className="text-caption text-white/40 uppercase tracking-wider">Session Chat Log</div>
          <div className="max-h-[300px] overflow-y-auto scroll-touch space-y-0.5 rounded-lg bg-surface-raised border border-white/5 p-2">
            {chatMessages.map((msg, i) => {
              const isYou = msg.from === "You";
              const isActive = Math.abs(msg.time - currentTime) < 2;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = msg.time;
                      setCurrentTime(msg.time);
                    }
                  }}
                  className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded text-label transition-colors ${
                    isActive ? "bg-white/10" : "hover:bg-surface-overlay"
                  }`}
                >
                  <span className="text-white/30 font-mono text-caption w-10 flex-shrink-0 pt-0.5">{formatTime(msg.time)}</span>
                  <span className={`font-medium flex-shrink-0 ${isYou ? "text-blue-400" : "text-amber-400"}`}>{msg.from}:</span>
                  <span className="text-white/60 break-words">{msg.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Coaching Report */}
      {coachingReport && (
        <div className="space-y-4 mt-6 pt-6 border-t border-white/5">
          {/* Overall Score */}
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${coachingReport.overallScore >= 70 ? "text-emerald-400" : coachingReport.overallScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {coachingReport.overallScore}
            </div>
            <div>
              <div className="text-sm font-medium">{coachingReport.overallRating} Delivery</div>
              <div className="text-caption text-white/40">Based on pitch, volume, pace, pauses, and filler word analysis</div>
            </div>
          </div>

          {coachingReport.topStrengths.length > 0 && (
            <div className="text-xs text-emerald-400">Strengths: {coachingReport.topStrengths.join(", ")}</div>
          )}
          {coachingReport.topImprovements.length > 0 && (
            <div className="text-xs text-amber-400">Focus areas: {coachingReport.topImprovements.join(", ")}</div>
          )}

          {/* Individual metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CoachingCard title="Pitch Variety" rating={coachingReport.pitch.rating} advice={coachingReport.pitch.advice}
              stats={[{ label: "Average", value: `${coachingReport.pitch.averagePitchHz} Hz` }, { label: "Range", value: `${coachingReport.pitch.pitchRangeHz[0]}-${coachingReport.pitch.pitchRangeHz[1]} Hz` }, { label: "Std Dev", value: `${coachingReport.pitch.pitchStdDev} Hz` }, { label: "Monotone", value: `${coachingReport.pitch.monotonePercent}%` }]}
            />
            <CoachingCard title="Volume & Projection" rating={coachingReport.volume.projectionRating} advice={coachingReport.volume.advice}
              stats={[{ label: "Level", value: `${coachingReport.volume.averageLevel}/100` }, { label: "Dynamic Range", value: `${coachingReport.volume.dynamicRange}` }, { label: "Dynamics", value: coachingReport.volume.dynamicsRating }, { label: "Quiet Drops", value: `${coachingReport.volume.quietMoments}` }]}
            />
            <CoachingCard title="Speaking Pace" rating={coachingReport.pace.rating} advice={coachingReport.pace.advice}
              stats={[{ label: "WPM", value: `${coachingReport.pace.wpm}` }]}
            />
            <CoachingCard title="Pause Usage" rating={coachingReport.pauses.rating} advice={coachingReport.pauses.advice}
              stats={[{ label: "Total Pauses", value: `${coachingReport.pauses.totalPauses}` }, { label: "Strategic (1-3s)", value: `${coachingReport.pauses.strategicPauses}` }, { label: "Awkward (4s+)", value: `${coachingReport.pauses.awkwardSilences}` }, { label: "Per Minute", value: `${coachingReport.pauses.pauseFrequency}` }]}
            />
            <CoachingCard title="Filler Words" rating={coachingReport.fillers.rating} advice={coachingReport.fillers.advice}
              stats={[{ label: "Count", value: `${coachingReport.fillers.count}` }, { label: "Per Minute", value: `${coachingReport.fillers.perMinute}` }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CoachingCard({ title, rating, advice, stats, className }: {
  title: string; rating: string; advice: string;
  stats: { label: string; value: string }[];
  className?: string;
}) {
  const ratingColors: Record<string, string> = {
    excellent: "text-emerald-400", good: "text-emerald-400", optimal: "text-emerald-400", expressive: "text-emerald-400",
    moderate: "text-yellow-400", "low-variety": "text-yellow-400", slow: "text-yellow-400", fast: "text-yellow-400", quiet: "text-yellow-400", loud: "text-yellow-400", "too-few": "text-yellow-400", "too-many": "text-yellow-400", low: "text-yellow-400", flat: "text-yellow-400", dramatic: "text-blue-400",
    monotone: "text-red-400", "too-slow": "text-red-400", "too-fast": "text-red-400", "too-quiet": "text-red-400", "too-loud": "text-red-400", high: "text-orange-400", excessive: "text-red-400", "awkward-silences": "text-red-400", "overly-dramatic": "text-orange-400",
  };

  return (
    <div className={`rounded-xl border border-white/5 bg-surface-raised p-4 ${className || ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-white/80">{title}</h4>
        <span className={`text-caption font-medium px-2 py-0.5 rounded-full bg-white/5 ${ratingColors[rating] || "text-white/50"}`}>
          {rating.replace(/-/g, " ")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {stats.map((s) => (
          <div key={s.label} className="text-caption">
            <span className="text-white/40">{s.label}: </span>
            <span className="text-white/70 font-medium">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 mt-3 pt-3">
        <p className="text-label text-white/50 leading-relaxed">{advice}</p>
      </div>
    </div>
  );
}

// Generate events from prosody timeline and speech metrics
export function generateSessionEvents(
  timeline: ProsodyFrame[],
  fillerWordCount: number,
  chatMessages: { from: string; text: string; time: number }[]
): SessionEvent[] {
  const events: SessionEvent[] = [];
  if (timeline.length === 0) return events;

  // Detect volume drops (below 15 for 2+ seconds)
  let lowVolStart: number | null = null;
  for (const frame of timeline) {
    if (frame.volume < 15 && !frame.isSilent) {
      if (lowVolStart === null) lowVolStart = frame.time;
    } else {
      if (lowVolStart !== null && frame.time - lowVolStart >= 2) {
        events.push({ time: lowVolStart, type: "volume-drop", label: `Volume dropped for ${(frame.time - lowVolStart).toFixed(1)}s`, severity: "warning" });
      }
      lowVolStart = null;
    }
  }

  // Detect monotone stretches (pitch variation < 5 for 5+ seconds)
  for (let i = 0; i < timeline.length; i++) {
    const window = timeline.slice(i, i + 50); // ~5 seconds at 100ms intervals
    if (window.length < 50) break;
    const pitches = window.filter((f) => f.pitch > 0).map((f) => f.pitch);
    if (pitches.length > 10) {
      const avg = pitches.reduce((a, b) => a + b, 0) / pitches.length;
      const variance = pitches.reduce((s, p) => s + (p - avg) ** 2, 0) / pitches.length;
      if (Math.sqrt(variance) < 15) {
        events.push({ time: window[0].time, type: "monotone", label: "Monotone stretch — vary your pitch", severity: "warning" });
        i += 50; // Skip ahead
      }
    }
  }

  // Detect long silences (3+ seconds)
  let silenceStart: number | null = null;
  for (const frame of timeline) {
    if (frame.isSilent) {
      if (silenceStart === null) silenceStart = frame.time;
    } else {
      if (silenceStart !== null && frame.time - silenceStart >= 3) {
        events.push({ time: silenceStart, type: "silence", label: `${(frame.time - silenceStart).toFixed(1)}s pause`, severity: "info" });
      }
      silenceStart = null;
    }
  }

  // Detect high-energy moments
  for (let i = 10; i < timeline.length - 10; i++) {
    const prev = timeline.slice(i - 10, i);
    const curr = timeline.slice(i, i + 10);
    const prevEnergy = prev.reduce((s, f) => s + f.energy, 0) / prev.length;
    const currEnergy = curr.reduce((s, f) => s + f.energy, 0) / curr.length;
    if (currEnergy - prevEnergy > 25) {
      events.push({ time: timeline[i].time, type: "emphasis", label: "Great energy build!", severity: "good" });
      i += 30; // Skip ahead
    }
  }

  // Audience interrupts from chat
  chatMessages.forEach((msg) => {
    if (msg.from !== "You") {
      events.push({ time: msg.time, type: "interrupt", label: `${msg.from} spoke`, severity: "info" });
    }
  });

  // Sort by time
  events.sort((a, b) => a.time - b.time);
  return events;
}
