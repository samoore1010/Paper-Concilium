import { useState } from "react";
import { PERSONA_LIBRARY, PERSONA_PACKS, Persona, PersonaPack } from "../data/personas";
import {
  CollectionProgress,
  MasteryTier,
  MASTERY_COLORS,
  MASTERY_LABELS,
  getUnlockRequirement,
  getCharacterStats,
  getDossier,
  getPackProgress,
  getCollectionSummary,
  getMasteryProgress,
} from "../data/characterCollection";
import { MiiAvatar } from "./MiiAvatar";

interface CollectionDashboardProps {
  collection: CollectionProgress;
  onBack: () => void;
}

export function CollectionDashboard({ collection, onBack }: CollectionDashboardProps) {
  const [activePack, setActivePack] = useState<PersonaPack | "all">("all");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  const summary = getCollectionSummary(collection);

  const displayedPersonas =
    activePack === "all"
      ? PERSONA_LIBRARY
      : PERSONA_LIBRARY.filter((p) => p.pack === activePack);

  return (
    <div className="min-h-screen bg-surface-base text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-white/40 hover:text-white transition-colors text-sm"
            >
              &larr; Back
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Character Collection</h1>
              <p className="text-xs text-white/40">
                {summary.totalUnlocked}/{summary.totalCharacters} unlocked
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-section-sm md:mb-section">
          <StatCard label="Characters" value={`${summary.totalUnlocked}/${summary.totalCharacters}`} sub="unlocked" />
          <StatCard label="Mastered" value={String(summary.totalMastered)} sub="characters" />
          <StatCard label="Sessions" value={String(summary.totalSessions)} sub="total" />
          <StatCard
            label="Highest Rank"
            value={MASTERY_LABELS[summary.highestTier]}
            sub=""
            color={MASTERY_COLORS[summary.highestTier]}
          />
        </div>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-section-sm md:mb-section" />

        {/* Pack Progress */}
        <section className="mb-section-sm md:mb-section">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-subsection-sm md:mb-subsection">Pack Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PERSONA_PACKS.map((pack) => {
              const progress = getPackProgress(collection, pack.id);
              const pct = progress.total > 0 ? (progress.unlocked / progress.total) * 100 : 0;
              return (
                <button
                  key={pack.id}
                  onClick={() => setActivePack(activePack === pack.id ? "all" : pack.id)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    activePack === pack.id
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-white/5 bg-surface-raised hover:bg-surface-overlay"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{pack.icon}</span>
                    <span className="font-medium text-sm">{pack.name}</span>
                  </div>
                  <div className="text-xs text-white/40 mb-2">
                    {progress.unlocked}/{progress.total} unlocked &middot; {progress.mastered} mastered
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-section-sm md:mb-section" />

        {/* Character Grid */}
        <section>
          <div className="flex items-center justify-between mb-subsection-sm md:mb-subsection">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">
              {activePack === "all" ? "All Characters" : PERSONA_PACKS.find((p) => p.id === activePack)?.name}
            </h2>
            {activePack !== "all" && (
              <button onClick={() => setActivePack("all")} className="text-xs text-blue-400 hover:text-blue-300">
                Show All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedPersonas.map((persona) => {
              const isUnlocked = collection.unlockedCharacters.includes(persona.id);
              const stats = getCharacterStats(collection, persona.id);
              const req = getUnlockRequirement(persona.id);

              return (
                <button
                  key={persona.id}
                  onClick={() => isUnlocked && setSelectedPersona(persona)}
                  className={`relative text-left p-4 rounded-lg border transition-all ${
                    isUnlocked
                      ? "border-white/5 bg-surface-raised hover:bg-surface-overlay cursor-pointer"
                      : "border-white/5 bg-white/[0.01] cursor-default"
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={isUnlocked ? "" : "opacity-20 grayscale"}>
                      <MiiAvatar persona={persona} size={64} />
                    </div>
                    {isUnlocked ? (
                      <>
                        <span className="font-medium text-sm">{persona.name}</span>
                        <span className="text-caption text-white/30 italic">{persona.archetype}</span>
                        {stats && stats.masteryTier !== "none" && (
                          <MasteryBadge tier={stats.masteryTier} />
                        )}
                        {stats && (
                          <span className="text-caption text-white/30">
                            {stats.sessionsCompleted} session{stats.sessionsCompleted !== 1 ? "s" : ""}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-sm text-white/20">???</span>
                        <span className="text-caption text-white/20">{req.description}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Character Detail Modal */}
      {selectedPersona && (
        <CharacterDetailModal
          persona={selectedPersona}
          collection={collection}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-white/5 bg-surface-raised">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-caption text-white/30">{sub}</div>}
    </div>
  );
}

function MasteryBadge({ tier }: { tier: MasteryTier }) {
  return (
    <span
      className="text-caption px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: `${MASTERY_COLORS[tier]}20`,
        color: MASTERY_COLORS[tier],
        border: `1px solid ${MASTERY_COLORS[tier]}40`,
      }}
    >
      {MASTERY_LABELS[tier]}
    </span>
  );
}

function CharacterDetailModal({
  persona,
  collection,
  onClose,
}: {
  persona: Persona;
  collection: CollectionProgress;
  onClose: () => void;
}) {
  const stats = getCharacterStats(collection, persona.id);
  const dossier = getDossier(persona, stats);
  const mastery = getMasteryProgress(stats);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-base border border-white/5 rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <MiiAvatar persona={persona} size={80} />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{persona.name}</h3>
            <p className="text-xs text-white/40 italic mb-2">{persona.archetype}</p>
            {stats && stats.masteryTier !== "none" && <MasteryBadge tier={stats.masteryTier} />}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">&times;</button>
        </div>

        {/* Stats */}
        {stats ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 rounded-lg bg-surface-raised">
              <div className="text-lg font-bold">{stats.sessionsCompleted}</div>
              <div className="text-caption text-white/40">Sessions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-raised">
              <div className="text-lg font-bold">{stats.bestScore.toFixed(1)}</div>
              <div className="text-caption text-white/40">Best Score</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-raised">
              <div className="text-lg font-bold">
                {stats.sessionsCompleted > 0 ? (stats.totalScore / stats.sessionsCompleted).toFixed(1) : "—"}
              </div>
              <div className="text-caption text-white/40">Avg Score</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-white/30 text-sm mb-6">
            No sessions yet. Practice with this character to build your dossier.
          </div>
        )}

        {/* Mastery Progress */}
        {mastery.nextTier && (
          <div className="mb-6 p-3 rounded-lg border border-white/5 bg-surface-raised">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">
                Next: <span style={{ color: MASTERY_COLORS[mastery.nextTier] }}>{MASTERY_LABELS[mastery.nextTier]}</span>
              </span>
            </div>
            <div className="text-caption text-white/30 space-y-1">
              {mastery.sessionsToNext > 0 && (
                <div>{mastery.sessionsToNext} more session{mastery.sessionsToNext !== 1 ? "s" : ""} needed</div>
              )}
              {mastery.scoreToNext > 0 && (
                <div>Avg score needs +{mastery.scoreToNext.toFixed(1)} points</div>
              )}
            </div>
          </div>
        )}

        {/* Dossier */}
        <div>
          <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Character Dossier</h4>
          <div className="space-y-3">
            {dossier.map((entry) => {
              const isLocked = entry.content === "\uD83D\uDD12 Locked";
              return (
                <div
                  key={entry.level}
                  className={`p-3 rounded-lg border ${
                    isLocked
                      ? "border-white/5 bg-white/[0.01]"
                      : "border-white/5 bg-surface-raised"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isLocked ? "text-white/20" : "text-white/60"}`}>
                      {entry.title}
                    </span>
                    {isLocked && (
                      <span
                        className="text-caption px-1.5 py-0.5 rounded"
                        style={{
                          color: MASTERY_COLORS[entry.requiredTier],
                          backgroundColor: `${MASTERY_COLORS[entry.requiredTier]}15`,
                        }}
                      >
                        {MASTERY_LABELS[entry.requiredTier]}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${isLocked ? "text-white/15" : "text-white/40"}`}>
                    {entry.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
