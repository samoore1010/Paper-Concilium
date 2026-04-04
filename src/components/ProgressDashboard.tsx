import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Trophy,
  Clock,
  Mic,
  Activity,
  Calendar,
} from "lucide-react";
import { getSessionHistory, SessionRecord } from "../data/sessionHistory";

interface ProgressDashboardProps {
  onBack: () => void;
}

export function ProgressDashboard({ onBack }: ProgressDashboardProps) {
  const [sessions] = useState<SessionRecord[]>(getSessionHistory);
  // === DERIVED DATA ===
  const scoreData = useMemo(
    () =>
      sessions.map((s, i) => ({
        session: i + 1,
        score: Math.round(s.overallScore * 10) / 10,
        date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })),
    [sessions]
  );

  const prosodyData = useMemo(
    () =>
      sessions
        .filter((s) => s.prosodyMetrics)
        .map((s, i) => ({
          session: i + 1,
          volume: Math.round((s.prosodyMetrics!.volumeVariation ?? 0) * 100),
          pitch: Math.round((s.prosodyMetrics!.pitchVariation ?? 0) * 100),
          silence: Math.round((s.prosodyMetrics!.silenceRatio ?? 0) * 100),
        })),
    [sessions]
  );

  const speechData = useMemo(
    () =>
      sessions.map((s, i) => ({
        session: i + 1,
        wpm: Math.round(s.speechMetrics?.wordsPerMinute ?? 0),
        fillers: s.speechMetrics?.fillerWordCount ?? 0,
        duration: Math.round(s.duration / 60),
      })),
    [sessions]
  );

  const heatmap = useMemo(() => buildHeatmap(sessions), [sessions]);

  const bests = useMemo(() => {
    if (sessions.length === 0) return null;
    const highScore = Math.max(...sessions.map((s) => s.overallScore));
    const longestDuration = Math.max(...sessions.map((s) => s.duration));
    const highWpm = Math.max(...sessions.map((s) => s.speechMetrics?.wordsPerMinute ?? 0));
    const lowFillers = Math.min(
      ...sessions.map((s) => s.speechMetrics?.fillerWordCount ?? Infinity)
    );
    return { highScore, longestDuration, highWpm, lowFillers };
  }, [sessions]);

  const avgScore =
    sessions.length > 0
      ? sessions.reduce((a, s) => a + s.overallScore, 0) / sessions.length
      : 0;

  const totalTime = sessions.reduce((a, s) => a + s.duration, 0);

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-base text-white flex flex-col items-center justify-center p-6">
        <Calendar className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-heading font-semibold mb-2">No sessions yet</h2>
        <p className="text-body text-white/50 mb-6 text-center max-w-sm">
          Complete your first practice session to start tracking your progress.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-section-sm md:py-section space-y-section-sm md:space-y-section">
        {/* Page Header */}
        <div>
          <h1 className="text-heading font-semibold text-white">Progress</h1>
          <p className="text-body text-white/50 mt-1">Track your improvement over time</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Trophy className="w-4 h-4" />}
            label="Avg Score"
            value={avgScore.toFixed(1)}
            accent="text-yellow-400"
          />
          <SummaryCard
            icon={<Activity className="w-4 h-4" />}
            label="Sessions"
            value={sessions.length.toString()}
            accent="text-blue-400"
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4" />}
            label="Total Time"
            value={formatDuration(totalTime)}
            accent="text-green-400"
          />
          <SummaryCard
            icon={<Mic className="w-4 h-4" />}
            label="Avg WPM"
            value={
              sessions.length > 0
                ? Math.round(
                    sessions.reduce((a, s) => a + (s.speechMetrics?.wordsPerMinute ?? 0), 0) /
                      sessions.length
                  ).toString()
                : "—"
            }
            accent="text-purple-400"
          />
        </div>

        {/* Performance Trends section */}
        <div className="text-label font-semibold text-white/30 uppercase tracking-widest px-0.5">Performance Trends</div>

        {/* Score Trend */}
        <ChartCard title="Score Trend" icon={<TrendingUp className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scoreData}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" stroke="#facc15" strokeWidth={2} fill="url(#scoreGrad)" dot={{ fill: "#facc15", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Prosody Trends */}
        {prosodyData.length > 0 && (
          <ChartCard title="Prosody Trends" icon={<Activity className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={prosodyData}>
                <XAxis dataKey="session" tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="volume" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Volume Var %" />
                <Line type="monotone" dataKey="pitch" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} name="Pitch Var %" />
                <Line type="monotone" dataKey="silence" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} name="Silence %" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 px-2">
              <LegendDot color="#60a5fa" label="Volume Variation" />
              <LegendDot color="#c084fc" label="Pitch Variation" />
              <LegendDot color="#f87171" label="Silence Ratio" />
            </div>
          </ChartCard>
        )}

        {/* Speech Metrics */}
        <ChartCard title="Speech Metrics" icon={<Mic className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={speechData}>
              <XAxis dataKey="session" tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff50", fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="wpm" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} name="WPM" />
              <Line type="monotone" dataKey="fillers" stroke="#fb923c" strokeWidth={2} dot={{ r: 3 }} name="Filler Words" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 px-2">
            <LegendDot color="#34d399" label="Words/Min" />
            <LegendDot color="#fb923c" label="Filler Words" />
          </div>
        </ChartCard>

        {/* Divider between Performance and Activity */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Activity section */}
        <div className="text-label font-semibold text-white/30 uppercase tracking-widest px-0.5">Activity</div>

        {/* Practice Heatmap */}
        <ChartCard title="Practice Frequency" icon={<Calendar className="w-4 h-4" />}>
          <Heatmap data={heatmap} />
        </ChartCard>

        {/* Personal Bests */}
        {bests && (
          <div>
            <h3 className="text-body font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Personal Bests
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BestCard label="Highest Score" value={bests.highScore.toFixed(1)} unit="/10" />
              <BestCard label="Longest Session" value={formatDuration(bests.longestDuration)} />
              <BestCard label="Fastest WPM" value={Math.round(bests.highWpm).toString()} unit="wpm" />
              <BestCard
                label="Fewest Fillers"
                value={bests.lowFillers === Infinity ? "—" : bests.lowFillers.toString()}
                unit="words"
              />
            </div>
          </div>
        )}
    </div>
  );
}

// === HELPER COMPONENTS ===

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <motion.div
      className="rounded-xl border border-white/5 bg-surface-raised p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`flex items-center gap-1.5 mb-1.5 ${accent}`}>{icon}<span className="text-label text-white/50">{label}</span></div>
      <div className="text-heading font-bold">{value}</div>
    </motion.div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="rounded-xl border border-white/5 bg-surface-raised p-4 md:p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-body font-semibold text-white/80 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function BestCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-raised p-3 text-center">
      <div className="text-label text-white/40 mb-1">{label}</div>
      <div className="text-subtitle font-bold text-yellow-400">
        {value}
        {unit && <span className="text-label text-yellow-400/60 ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-caption text-white/40">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-white/50 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/70">{p.name}:</span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// === HEATMAP ===

interface HeatmapDay {
  date: string;
  count: number;
  dayOfWeek: number;
  weekIndex: number;
}

function buildHeatmap(sessions: SessionRecord[]): HeatmapDay[] {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    const key = new Date(s.date).toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const days: HeatmapDay[] = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90); // last ~13 weeks

  let weekIndex = 0;
  let prevWeek = -1;
  const cursor = new Date(start);
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getDay();
    const week = Math.floor((cursor.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (week !== prevWeek) {
      weekIndex = week;
      prevWeek = week;
    }
    days.push({ date: key, count: counts[key] ?? 0, dayOfWeek, weekIndex });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Only show Mon, Wed, Fri to avoid crowding
const DOW_SHOWN = new Set([1, 3, 5]);

function Heatmap({ data }: { data: HeatmapDay[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const weeks = Math.max(...data.map((d) => d.weekIndex)) + 1;

  // Build month label positions: first week index where a new month starts
  const monthLabels = useMemo(() => {
    const seen = new Set<string>();
    const labels: { weekIndex: number; label: string }[] = [];
    for (const d of data) {
      const monthKey = d.date.slice(0, 7); // "YYYY-MM"
      if (!seen.has(monthKey)) {
        seen.add(monthKey);
        const date = new Date(d.date + "T00:00:00");
        labels.push({
          weekIndex: d.weekIndex,
          label: date.toLocaleDateString("en-US", { month: "short" }),
        });
      }
    }
    return labels;
  }, [data]);

  const CELL = 14;
  const GAP = 3;
  const DAY_LABEL_W = 28;

  return (
    <div className="overflow-x-auto">
      {/* Month labels row */}
      <div className="flex mb-1" style={{ paddingLeft: DAY_LABEL_W }}>
        {monthLabels.map(({ weekIndex, label }) => (
          <div
            key={label + weekIndex}
            className="text-caption text-white/30 whitespace-nowrap"
            style={{
              position: "relative",
              left: weekIndex * (CELL + GAP),
              minWidth: 0,
              marginRight: 0,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid with day labels */}
      <div className="flex items-start gap-[3px]">
        {/* Day-of-week labels */}
        <div
          className="flex flex-col gap-[3px] shrink-0"
          style={{ width: DAY_LABEL_W, paddingTop: 0 }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="text-caption text-white/30 leading-none flex items-center"
              style={{ height: CELL }}
            >
              {DOW_SHOWN.has(i) ? DOW_LABELS[i] : ""}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div
          className="inline-grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`,
            gridTemplateRows: `repeat(7, ${CELL}px)`,
          }}
        >
          {data.map((d) => {
            const intensity = d.count === 0 ? 0 : Math.max(0.2, d.count / maxCount);
            return (
              <div
                key={d.date}
                className="rounded-[3px] transition-colors"
                style={{
                  gridColumn: d.weekIndex + 1,
                  gridRow: d.dayOfWeek + 1,
                  backgroundColor:
                    d.count === 0
                      ? "rgba(255,255,255,0.04)"
                      : `rgba(74, 222, 128, ${intensity})`,
                }}
                title={`${d.date}: ${d.count} session${d.count !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2" style={{ paddingLeft: DAY_LABEL_W }}>
        <span className="text-caption text-white/30">Less</span>
        {[0, 0.2, 0.4, 0.7, 1].map((o) => (
          <div
            key={o}
            className="w-3 h-3 rounded-[2px]"
            style={{
              backgroundColor:
                o === 0 ? "rgba(255,255,255,0.04)" : `rgba(74, 222, 128, ${o})`,
            }}
          />
        ))}
        <span className="text-caption text-white/30">More</span>
      </div>
    </div>
  );
}

// === UTILS ===

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
