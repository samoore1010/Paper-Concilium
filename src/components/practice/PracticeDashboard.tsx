import { motion } from "framer-motion";
import { UNITS, Unit, Lesson } from "../../data/practice/lessons";
import { UserProgress, getLevelProgress, LEVEL_NAMES, ACHIEVEMENTS } from "../../data/practice/progress";

interface PracticeDashboardProps {
  progress: UserProgress;
  onSelectLesson: (lessonId: string) => void;
}

export function PracticeDashboard({ progress, onSelectLesson }: PracticeDashboardProps) {
  const levelInfo = getLevelProgress(progress);

  return (
    <div className="px-4 md:px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-section-sm md:mb-section">
          <StatCard label="Level" value={LEVEL_NAMES[progress.level]} sub={`${progress.totalXP} XP`} color="blue" />
          <StatCard label="Stars" value={progress.totalStars.toString()} sub={`earned`} color="yellow" />
          <StatCard label="Streak" value={`${progress.currentStreak}d`} sub={`best: ${progress.longestStreak}d`} color="orange" />
          <StatCard label="Done" value={progress.totalExercisesCompleted.toString()} sub="exercises" color="emerald" />
        </div>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-section-sm md:mb-section" />

        {/* XP Progress bar */}
        <div className="mb-section-sm md:mb-section">
          <div className="flex items-center justify-between text-xs text-white/40 mb-1">
            <span>Level {progress.level}: {LEVEL_NAMES[progress.level]}</span>
            <span>{progress.totalXP} / {levelInfo.next} XP</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Skill Tree */}
        <div className="space-y-8">
          {UNITS.map((unit) => (
            <UnitSection key={unit.id} unit={unit} progress={progress} onSelectLesson={onSelectLesson} />
          ))}
        </div>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-section-sm md:mt-section mb-section-sm md:mb-section" />

        {/* Achievements */}
        <div>
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-subsection-sm md:mb-subsection">Achievements</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = progress.achievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    unlocked
                      ? "border-yellow-500/30 bg-yellow-500/10"
                      : "border-white/5 bg-surface-raised opacity-40"
                  }`}
                >
                  <div className="text-2xl mb-1">{ach.icon}</div>
                  <div className="text-label font-medium">{ach.title}</div>
                  <div className="text-caption text-white/40 mt-0.5">{ach.description}</div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}

function UnitSection({ unit, progress, onSelectLesson }: { unit: Unit; progress: UserProgress; onSelectLesson: (id: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{unit.icon}</span>
        <div>
          <h2 className="text-sm md:text-base font-semibold">{unit.title}</h2>
          <p className="text-caption md:text-xs text-white/40">{unit.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        {unit.lessons.map((lesson) => {
          const isUnlocked = progress.totalStars >= lesson.unlockRequirement;
          const lessonStars = lesson.exercises.reduce((sum, ex) => sum + (progress.exerciseResults[ex.id]?.stars || 0), 0);
          const maxStars = lesson.exercises.length * 3;
          const isComplete = lessonStars >= lesson.exercises.length; // at least 1 star per exercise

          return (
            <motion.button
              key={lesson.id}
              onClick={() => isUnlocked && onSelectLesson(lesson.id)}
              disabled={!isUnlocked}
              className={`text-left p-3 md:p-4 rounded-xl border transition-all ${
                !isUnlocked
                  ? "border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed"
                  : isComplete
                  ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                  : "border-white/5 bg-surface-raised hover:bg-surface-overlay"
              }`}
              whileHover={isUnlocked ? { scale: 1.01 } : {}}
              whileTap={isUnlocked ? { scale: 0.99 } : {}}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs md:text-sm font-medium">{lesson.title}</span>
                {!isUnlocked && <span className="text-caption text-white/30">🔒 {lesson.unlockRequirement}★</span>}
              </div>
              <p className="text-caption md:text-xs text-white/40 mb-2">{lesson.description}</p>

              {/* Star progress */}
              <div className="flex items-center gap-1">
                {lesson.exercises.map((ex) => {
                  const result = progress.exerciseResults[ex.id];
                  const stars = result?.stars || 0;
                  return (
                    <div key={ex.id} className="flex gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <span key={s} className={`text-caption ${s <= stars ? "text-yellow-400" : "text-white/15"}`}>★</span>
                      ))}
                    </div>
                  );
                })}
                <span className="text-caption text-white/30 ml-auto">{lessonStars}/{maxStars}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400", yellow: "text-yellow-400", orange: "text-orange-400", emerald: "text-emerald-400",
  };
  return (
    <div className="rounded-lg border border-white/5 bg-surface-raised p-2 md:p-3 text-center">
      <div className="text-caption text-white/40 mb-0.5">{label}</div>
      <div className={`text-sm md:text-lg font-bold ${colors[color]}`}>{value}</div>
      <div className="text-caption text-white/30">{sub}</div>
    </div>
  );
}
