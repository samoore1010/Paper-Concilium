import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PERSONA_LIBRARY, PERSONA_PACKS, ARCHETYPE_DISCLAIMER, Persona, PersonaPack } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import ScrollFadeContainer from "./ScrollFadeContainer";
import { getRecentSessions, SessionRecord } from "../data/sessionHistory";
import {
  CollectionProgress,
  getUnlockRequirement,
  getCharacterStats,
  MASTERY_COLORS,
  MASTERY_LABELS,
  MasteryTier,
} from "../data/characterCollection";

interface PersonaSelectorProps {
  onStartSession: (personas: Persona[], sessionType: string) => void;
  onViewSession?: (session: SessionRecord) => void;
  collection: CollectionProgress;
}

/** Session type labels keyed by pack sessionType */
const SESSION_TYPE_LABELS: Record<string, string> = {
  "business-pitch": "Business Pitch",
  "mock-trial": "Mock Trial / Oral Argument",
  "public-speaking": "Public Speaking",
  "sales-demo": "Sales Demo",
};

/** Pack accent colors for themed glows */
const PACK_COLORS: Record<PersonaPack, string> = {
  general: "#6366f1",
  "legal-bench": "#8b4513",
  "business-tank": "#d4a017",
};

export function PersonaSelector({ onStartSession, onViewSession, collection }: PersonaSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessionType, setSessionType] = useState("business-pitch");
  const [activePack, setActivePack] = useState<PersonaPack>("general");
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [spotlightPersona, setSpotlightPersona] = useState<Persona | null>(null);
  const [selectFlash, setSelectFlash] = useState<string | null>(null);
  const [recentSessionsExpanded, setRecentSessionsExpanded] = useState(false);

  useEffect(() => {
    setRecentSessions(getRecentSessions(3));
  }, []);

  const filteredPersonas = PERSONA_LIBRARY.filter((p) => p.pack === activePack);
  const packColor = PACK_COLORS[activePack];

  const handlePackChange = (pack: PersonaPack) => {
    setActivePack(pack);
    setSelected(new Set());
    setSpotlightPersona(null);
    const packInfo = PERSONA_PACKS.find((p) => p.id === pack);
    if (packInfo) setSessionType(packInfo.sessionType);
  };

  const isUnlocked = useCallback(
    (id: string) => collection.unlockedCharacters.includes(id),
    [collection.unlockedCharacters]
  );

  const togglePersona = (persona: Persona) => {
    if (!isUnlocked(persona.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(persona.id)) {
        next.delete(persona.id);
      } else {
        next.add(persona.id);
        // Flash effect on selection
        setSelectFlash(persona.id);
        setTimeout(() => setSelectFlash(null), 400);
      }
      return next;
    });
  };

  const unlockedInPack = filteredPersonas.filter((p) => isUnlocked(p.id));

  const selectAll = () => {
    const unlockedIds = unlockedInPack.map((p) => p.id);
    const allSelected = unlockedIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unlockedIds));
    }
  };

  const allPackSelected = unlockedInPack.length > 0 && unlockedInPack.every((p) => selected.has(p.id));
  const selectedPersonas = PERSONA_LIBRARY.filter((p) => selected.has(p.id));

  return (
    <div className="px-4 md:px-6 py-6 md:py-8">
      {/* Start session button — sticky at bottom */}
      {selected.size > 0 && (
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] md:bottom-6 right-4 md:right-6 z-30">
          <button
            onClick={() => onStartSession(selectedPersonas, sessionType)}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/25"
          >
            Start Session ({selected.size})
          </button>
        </div>
      )}

        {/* ===== HERO / WELCOME AREA ===== */}
        <section className="mb-section-sm md:mb-section">
          <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">
            {recentSessions.length > 0 ? "Ready for another round?" : "Practice makes perfect"}
          </h1>
          <p className="text-sm text-white/50">
            Choose your audience and start presenting.
          </p>
        </section>

        {/* ===== CHOOSE YOUR AUDIENCE ===== */}
        <section>
          <div className="flex items-center justify-between mb-subsection-sm md:mb-subsection">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">Choose Your Audience</h2>
          </div>

          {/* Pack Tabs — enriched with session type context */}
          <div className="grid grid-cols-1 md:flex md:flex-wrap gap-2 md:gap-3 mb-subsection-sm md:mb-subsection">
            {PERSONA_PACKS.map((pack) => {
              const sessionLabel = SESSION_TYPE_LABELS[pack.sessionType] || pack.sessionType;
              return (
                <button
                  key={pack.id}
                  onClick={() => handlePackChange(pack.id)}
                  className={`text-left p-4 rounded-lg border transition-all md:flex-1 md:min-w-[250px] ${
                    activePack === pack.id
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-white/5 bg-surface-raised hover:bg-surface-overlay"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{pack.icon}</span>
                    <span className="font-medium text-sm">{pack.name}</span>
                  </div>
                  <div className="text-caption text-white/40 uppercase tracking-wider mb-1">
                    {pack.subtitle} — {sessionLabel}
                  </div>
                  <div className="text-xs text-white/40 leading-relaxed line-clamp-2">{pack.description}</div>
                </button>
              );
            })}
          </div>

          <div className="mb-subsection-sm md:mb-subsection px-4 py-3 rounded-lg border border-white/5 bg-surface-raised text-xs text-white/50 leading-relaxed">
            {ARCHETYPE_DISCLAIMER}
          </div>

          <div className="flex items-center justify-between mb-subsection-sm md:mb-subsection">
            <span className="text-xs text-white/40">{filteredPersonas.length} characters in this pack</span>
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">
              {allPackSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* ===== CHARACTER SELECT LAYOUT ===== */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Roster Grid — compact character tiles */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePack}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
                >
                  {filteredPersonas.map((persona, idx) => {
                    const unlocked = isUnlocked(persona.id);
                    const isSelected = selected.has(persona.id);
                    const isSpotlit = spotlightPersona?.id === persona.id;
                    const isFlashing = selectFlash === persona.id;
                    const req = getUnlockRequirement(persona.id);

                    return (
                      <motion.button
                        key={persona.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                        onClick={() => {
                          if (unlocked) {
                            togglePersona(persona);
                            setSpotlightPersona(persona);
                          } else {
                            setSpotlightPersona(persona);
                          }
                        }}
                        onMouseEnter={() => setSpotlightPersona(persona)}
                        className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                          !unlocked
                            ? "border-white/5 bg-white/[0.01] cursor-default"
                            : isSelected
                            ? "border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20"
                            : isSpotlit
                            ? "border-white/30 bg-surface-overlay"
                            : "border-white/5 bg-surface-raised hover:bg-surface-overlay hover:border-white/20"
                        }`}
                      >
                        {/* Selection flash effect */}
                        {isFlashing && (
                          <motion.div
                            initial={{ opacity: 0.8, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 rounded-lg bg-blue-400/40 pointer-events-none"
                          />
                        )}

                        {/* Avatar */}
                        <div className={`${!unlocked ? "opacity-15 grayscale" : ""} transition-all`}>
                          <MiiAvatar persona={persona} size={56} />
                        </div>

                        {/* Name */}
                        <div className={`text-caption font-medium mt-1 truncate w-full text-center ${
                          !unlocked ? "text-white/15" : "text-white/80"
                        }`}>
                          {unlocked ? persona.name.split(" ")[0] : "???"}
                        </div>

                        {/* Lock icon overlay */}
                        {!unlocked && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-black/40 rounded-full p-1.5 animate-pulse">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white/30">
                                <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4z" fill="currentColor" />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Selection checkmark */}
                        {isSelected && unlocked && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 16 16" fill="white">
                              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                            </svg>
                          </div>
                        )}

                        {/* Spotlight indicator dot */}
                        {isSpotlit && unlocked && (
                          <div
                            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: packColor }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Spotlight Preview Panel */}
            <div className="lg:w-[320px] flex-shrink-0">
              <AnimatePresence mode="wait">
                {spotlightPersona ? (
                  <SpotlightPanel
                    key={spotlightPersona.id}
                    persona={spotlightPersona}
                    unlocked={isUnlocked(spotlightPersona.id)}
                    isSelected={selected.has(spotlightPersona.id)}
                    collection={collection}
                    packColor={packColor}
                    onToggle={() => togglePersona(spotlightPersona)}
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-white/5 bg-surface-raised p-6 text-center text-white/30 text-sm h-full min-h-[300px] flex items-center justify-center"
                  >
                    <div>
                      <div className="text-2xl mb-2">👆</div>
                      <div>Hover over a character to preview</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Section Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-section-sm md:mt-section" />

          {/* ===== TEAM DOCK ===== */}
          <AnimatePresence>
            {selectedPersonas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-section-sm md:mt-section p-4 rounded-xl border border-white/5 bg-surface-raised"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Your Team ({selectedPersonas.length})
                  </h3>
                  <button
                    onClick={() => onStartSession(selectedPersonas, sessionType)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ready!
                  </button>
                </div>
                <ScrollFadeContainer className="flex gap-3 overflow-x-auto pb-1">
                  {selectedPersonas.map((persona) => (
                    <motion.button
                      key={persona.id}
                      layout
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => {
                        togglePersona(persona);
                        setSpotlightPersona(persona);
                      }}
                      className="flex flex-col items-center gap-1 flex-shrink-0 group"
                    >
                      <div className="relative">
                        <MiiAvatar persona={persona} size={48} enableParallax={false} />
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="8" height="8" viewBox="0 0 16 16" fill="white">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-caption text-white/50 font-medium">{persona.name.split(" ")[0]}</span>
                    </motion.button>
                  ))}
                </ScrollFadeContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ===== RECENT SESSIONS (collapsed, de-emphasized) ===== */}
        {recentSessions.length > 0 && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-section-sm md:mt-section" />
            <section className="mt-section-sm md:mt-section">
              <button
                onClick={() => setRecentSessionsExpanded((prev) => !prev)}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors w-full"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={`transition-transform ${recentSessionsExpanded ? "rotate-90" : ""}`}
                >
                  <path d="M6 3l5 5-5 5V3z" />
                </svg>
                <span className="text-xs font-medium uppercase tracking-wider">Recent Sessions</span>
                <span className="text-xs text-white/25">({recentSessions.length})</span>
              </button>
              <AnimatePresence>
                {recentSessionsExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      {recentSessions.map((session) => {
                        const scoreColor = session.overallScore >= 7 ? "text-emerald-400" : session.overallScore >= 5 ? "text-yellow-400" : "text-red-400";
                        const scoreBg = session.overallScore >= 7 ? "bg-emerald-500/10 border-emerald-500/20" : session.overallScore >= 5 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";
                        const date = new Date(session.date).toLocaleDateString();
                        return (
                          <button
                            key={session.id}
                            onClick={() => session.feedback && onViewSession?.(session)}
                            className={`rounded-lg border p-3 text-left transition-all ${scoreBg} ${session.feedback ? "hover:brightness-125 cursor-pointer" : "opacity-60 cursor-default"}`}
                          >
                            <div className="text-xs text-white/50 mb-1">{date}</div>
                            <div className="text-sm font-medium text-white mb-1">{session.sessionType.replace(/-/g, " ")}</div>
                            <div className={`text-lg font-bold ${scoreColor}`}>{(session.overallScore || 0).toFixed(1)}/10</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-white/40">{session.personaIds.length} personas</span>
                              {session.feedback && <span className="text-caption text-blue-400">View report</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}
    </div>
  );
}

/** Spotlight panel — large character preview with stats and details */
function SpotlightPanel({
  persona,
  unlocked,
  isSelected,
  collection,
  packColor,
  onToggle,
}: {
  persona: Persona;
  unlocked: boolean;
  isSelected: boolean;
  collection: CollectionProgress;
  packColor: string;
  onToggle: () => void;
}) {
  const stats = getCharacterStats(collection, persona.id);
  const req = getUnlockRequirement(persona.id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-white/5 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${packColor}15 0%, transparent 70%), rgba(255,255,255,0.02)`,
      }}
    >
      {/* Avatar spotlight area */}
      <div className="relative flex items-center justify-center py-6" style={{ minHeight: 200 }}>
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${packColor}20 0%, transparent 60%)`,
          }}
        />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={`relative ${!unlocked ? "grayscale opacity-30" : ""}`}
        >
          <MiiAvatar
            persona={persona}
            size={160}
            themeAccentColor={packColor}
            enableParallax={true}
          />
        </motion.div>
      </div>

      {/* Info section */}
      <div className="px-5 pb-5">
        {/* Name + archetype */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {unlocked ? persona.name : "???"}
            </h3>
            {unlocked && (
              <span className="text-caption px-1.5 py-0.5 rounded bg-surface-overlay text-white/50">
                {persona.age}
              </span>
            )}
            {stats && stats.masteryTier !== "none" && (
              <MasteryBadge tier={stats.masteryTier} />
            )}
          </div>
          <div className="text-xs text-white/40 italic mt-0.5">{persona.archetype}</div>
          {unlocked && persona.catchphrase && (
            <div className="text-label text-white/30 mt-1">"{persona.catchphrase}"</div>
          )}
        </div>

        {unlocked ? (
          <>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <Tag color="blue">{persona.profession}</Tag>
              <Tag color="green">{persona.politicalLeaning}</Tag>
              <Tag color="orange">{persona.communicationStyle}</Tag>
            </div>

            {/* Stats visual */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatBar label="Tough" value={persona.stats.toughness} color="#ef4444" />
              <StatBar label="Depth" value={persona.stats.domainDepth} color="#3b82f6" />
              <StatBar label="Patient" value={persona.stats.patience} color="#22c55e" />
            </div>

            {/* Bio */}
            <p className="text-xs text-white/40 leading-relaxed mb-4">{persona.bio}</p>

            {/* Select button */}
            <button
              onClick={onToggle}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? "bg-blue-500/20 border border-blue-400 text-blue-300 hover:bg-blue-500/30"
                  : "bg-surface-raised border border-white/5 text-white/70 hover:bg-surface-overlay"
              }`}
            >
              {isSelected ? "Remove from Team" : "Add to Team"}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-raised border border-white/5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white/20 flex-shrink-0">
              <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4z" fill="currentColor" />
            </svg>
            <span className="text-label text-white/30">{req.description}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Stat bar — fighting game style power gauge */
function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-caption text-white/40 uppercase tracking-wider">{label}</span>
        <span className="text-caption font-mono text-white/50">{value}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MasteryBadge({ tier }: { tier: MasteryTier }) {
  return (
    <span
      className="text-caption px-1.5 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: `${MASTERY_COLORS[tier]}20`,
        color: MASTERY_COLORS[tier],
      }}
    >
      {MASTERY_LABELS[tier]}
    </span>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-300",
    green: "bg-emerald-500/20 text-emerald-300",
    orange: "bg-orange-500/20 text-orange-300",
  };
  return (
    <span className={`text-caption px-1.5 py-0.5 rounded ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}
