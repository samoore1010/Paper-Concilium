import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Exercise, Lesson, Unit, UNITS } from "../../data/practice/lessons";
import { getScriptById } from "../../data/practice/scripts";
import { calculateDeliveryScore, DeliveryScore } from "../../data/practice/scoring";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useSpeechMetrics } from "../../hooks/useSpeechMetrics";
import { useProsody } from "../../hooks/useProsody";

interface ExerciseViewProps {
  lessonId: string;
  onComplete: (exerciseId: string, score: DeliveryScore) => void;
  onBack: () => void;
}

type ExerciseState = "ready" | "recording" | "done";

export function ExerciseView({ lessonId, onComplete, onBack }: ExerciseViewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [state, setState] = useState<ExerciseState>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState<DeliveryScore | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const { isListening, startListening, stopListening } = useSpeechRecognition();
  const { metrics: speechMetrics, updateMetrics, reset: resetSpeechMetrics } = useSpeechMetrics();
  const { metrics: prosodyMetrics, startAnalysis, stopAnalysis } = useProsody();

  // Find lesson and exercises
  const lesson = (() => {
    for (const unit of UNITS) {
      const l = unit.lessons.find((l: Lesson) => l.id === lessonId);
      if (l) return { lesson: l, unit };
    }
    return null;
  })();

  if (!lesson) return <div className="min-h-screen bg-surface-base text-white flex items-center justify-center">Lesson not found</div>;

  const exercises = lesson.lesson.exercises;
  const currentExercise = exercises[currentIdx];
  const script = getScriptById(currentExercise.scriptId);
  if (!script) return null;

  const handleStart = () => {
    setState("recording");
    setElapsed(0);
    setScore(null);
    startListening();
    startAnalysis();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const handleStop = () => {
    setState("done");
    stopListening();
    stopAnalysis();
    clearInterval(timerRef.current);

    // Calculate score
    const result = calculateDeliveryScore(
      prosodyMetrics,
      speechMetrics,
      currentExercise.targets,
      currentExercise.starThresholds,
      currentExercise.xpReward,
      script.durationSeconds
    );
    setScore(result);
    onComplete(currentExercise.id, result);
  };

  const handleNext = () => {
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setState("ready");
      setScore(null);
      setElapsed(0);
    } else {
      onBack(); // lesson complete
    }
  };

  const handleRetry = () => {
    setState("ready");
    setScore(null);
    setElapsed(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-[100dvh] bg-surface-base text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm">← Exit</button>
        <div className="text-center">
          <div className="text-xs font-medium">{lesson.lesson.title}</div>
          <div className="text-[10px] text-white/40">{currentIdx + 1} of {exercises.length}</div>
        </div>
        <div className="text-xs text-white/40 font-mono">{fmt(elapsed)}</div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${((currentIdx + (state === "done" ? 1 : 0)) / exercises.length) * 100}%` }} />
      </div>

      {/* Exercise content */}
      <div className="flex-1 flex flex-col px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        {/* Instruction */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-semibold mb-1">{currentExercise.title}</h2>
          <p className="text-xs md:text-sm text-white/50">{currentExercise.instruction}</p>
          {currentExercise.targets.wpmRange && (
            <div className="mt-2 text-[10px] text-white/30">Target: {currentExercise.targets.wpmRange[0]}-{currentExercise.targets.wpmRange[1]} WPM</div>
          )}
        </div>

        {/* Script / Teleprompter */}
        <div className={`flex-1 rounded-xl border p-4 md:p-6 mb-4 md:mb-6 overflow-y-auto transition-all ${
          state === "recording" ? "border-purple-500/40 bg-purple-500/5" : "border-white/5 bg-surface-raised"
        }`}>
          {state === "done" && score ? (
            <ScoreDisplay score={score} exercise={currentExercise} isLast={currentIdx >= exercises.length - 1} onNext={handleNext} onRetry={handleRetry} />
          ) : (
            <div className="text-base md:text-lg leading-relaxed text-white/80 font-light">
              {script.text}
            </div>
          )}
        </div>

        {/* Live metrics during recording */}
        {state === "recording" && (
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <LiveMetric label="WPM" value={speechMetrics.wordsPerMinute} target={currentExercise.targets.wpmRange} />
            <LiveMetric label="Volume" value={prosodyMetrics.averageVolume} />
            <LiveMetric label="Fillers" value={speechMetrics.fillerWordCount} bad />
            <LiveMetric label="Energy" value={prosodyMetrics.energyLevel} />
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {state === "ready" && (
            <motion.button
              onClick={handleStart}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Start Speaking
            </motion.button>
          )}
          {state === "recording" && (
            <motion.button
              onClick={handleStop}
              className="px-8 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium flex items-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Stop Recording
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreDisplay({ score, exercise, isLast, onNext, onRetry }: {
  score: DeliveryScore; exercise: Exercise; isLast: boolean;
  onNext: () => void; onRetry: () => void;
}) {
  const starColor = score.stars >= 3 ? "text-yellow-400" : score.stars >= 2 ? "text-yellow-400" : score.stars >= 1 ? "text-yellow-500" : "text-white/20";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      {/* Stars */}
      <div className="flex justify-center gap-2 mb-3">
        {[1, 2, 3].map((s) => (
          <motion.span
            key={s}
            className={`text-3xl ${s <= score.stars ? starColor : "text-white/15"}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: s * 0.2, type: "spring", stiffness: 200 }}
          >
            ★
          </motion.span>
        ))}
      </div>

      <div className="text-2xl font-bold mb-1">{score.overall}/100</div>
      <div className="text-xs text-purple-300 mb-4">+{score.xpEarned} XP</div>

      {/* Breakdown */}
      <div className="space-y-2 text-left mb-6">
        {score.breakdown.map((b) => (
          <div key={b.metric} className="flex items-center gap-3">
            <div className="w-16 text-[10px] text-white/40">{b.metric}</div>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${b.score >= 80 ? "bg-emerald-400" : b.score >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                style={{ width: `${b.score}%` }}
              />
            </div>
            <div className="w-8 text-[10px] text-right">{b.score}</div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="text-left space-y-1 mb-6">
        {score.breakdown.map((b) => (
          <p key={b.metric} className="text-[11px] text-white/50">
            <span className="text-white/70 font-medium">{b.metric}:</span> {b.feedback}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button onClick={onRetry} className="px-4 py-2 bg-surface-raised hover:bg-surface-overlay rounded-lg text-xs font-medium">
          Retry
        </button>
        <button onClick={onNext} className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-xs font-medium">
          {isLast ? "Finish Lesson" : "Next Exercise"}
        </button>
      </div>
    </motion.div>
  );
}

function LiveMetric({ label, value, target, bad }: { label: string; value: number; target?: [number, number]; bad?: boolean }) {
  let color = "text-white/70";
  if (target) {
    color = value >= target[0] && value <= target[1] ? "text-emerald-400" : "text-orange-400";
  } else if (bad) {
    color = value === 0 ? "text-emerald-400" : value <= 2 ? "text-yellow-400" : "text-red-400";
  }

  return (
    <div className="bg-surface-raised rounded-lg p-2">
      <div className="text-[9px] text-white/40">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
