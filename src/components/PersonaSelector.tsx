import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PERSONA_LIBRARY, PERSONA_PACKS, ARCHETYPE_DISCLAIMER, Persona, PersonaPack } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import { getRecentSessions, SessionRecord } from "../data/sessionHistory";

interface PersonaSelectorProps {
  onStartSession: (personas: Persona[], sessionType: string) => void;
  onViewSession?: (session: SessionRecord) => void;
}

const SESSION_TYPES = [
  { id: "business-pitch", label: "Business Pitch", desc: "Practice pitching your startup or product to investors" },
  { id: "mock-trial", label: "Mock Trial / Oral Argument", desc: "Present legal arguments to a simulated jury or judge panel" },
  { id: "public-speaking", label: "Public Speaking", desc: "Practice a keynote, class presentation, or speech" },
  { id: "sales-demo", label: "Sales Demo", desc: "Rehearse a product demo for prospective clients" },
];

const PACK_COLORS: Record<PersonaPack, { bg: string; border: string; glow: string; accent: string }> = {
  general: { bg: "from-blue-600/20 to-blue-900/30", border: "border-blue-500/40", glow: "shadow-blue-500/20", accent: "text-blue-400" },
  "legal-bench": { bg: "from-amber-600/20 to-amber-900/30", border: "border-amber-500/40", glow: "shadow-amber-500/20", accent: "text-amber-400" },
  "business-tank": { bg: "from-emerald-600/20 to-emerald-900/30", border: "border-emerald-500/40", glow: "shadow-emerald-500/20", accent: "text-emerald-400" },
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/50 w-20 text-right">{label}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] text-white/40 w-4">{value}</span>
    </div>
  );
}

function CharacterThumbnail({
  persona,
  isSelected,
  isHighlighted,
  onClick,
  onHover,
  index,
}: {
  persona: Persona;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onHover: () => void;
  index: number;
}) {
  const isLocked = persona.locked;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={isLocked ? undefined : onClick}
      onMouseEnter={isLocked ? undefined : onHover}
      className={`relative w-[72px] h-[72px] md:w-20 md:h-20 rounded-lg border-2 transition-all flex items-center justify-center overflow-hidden ${
        isLocked
          ? "border-white/10 bg-white/[0.02] cursor-not-allowed opacity-40"
          : isHighlighted
          ? "border-yellow-400 bg-yellow-500/10 shadow-lg shadow-yellow-500/20 scale-105"
          : isSelected
          ? "border-blue-400 bg-blue-500/15 shadow-md shadow-blue-500/15"
          : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06] cursor-pointer"
      }`}
    >
      {isLocked ? (
        <div className="flex flex-col items-center gap-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[8px] text-white/20">LOCKED</span>
        </div>
      ) : (
        <div className="scale-90">
          <MiiAvatar persona={persona} size={64} />
        </div>
      )}
      {isSelected && !isLocked && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 16 16" fill="white">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </div>
      )}
    </motion.button>
  );
}

function SpotlightPanel({ persona, packColors }: { persona: Persona; packColors: typeof PACK_COLORS["general"] }) {
  return (
    <motion.div
      key={persona.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col h-full bg-gradient-to-b ${packColors.bg} rounded-xl border ${packColors.border} p-5 shadow-xl ${packColors.glow}`}
    >
      {/* Avatar + Name */}
      <div className="flex items-start gap-5 mb-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          <MiiAvatar persona={persona} size={120} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white tracking-tight">{persona.name}</h3>
          <p className={`text-sm font-medium ${packColors.accent} italic`}>"{persona.archetype}"</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{persona.profession}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{persona.communicationStyle}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">Age {persona.age}</span>
          </div>
        </div>
      </div>

      {/* Catchphrase */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4 px-3 py-2 rounded-lg bg-black/20 border border-white/5"
      >
        <p className="text-sm text-white/70 italic">"{persona.catchphrase}"</p>
      </motion.div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        <StatBar label="Toughness" value={persona.stats.toughness} color="bg-red-500" />
        <StatBar label="Domain Depth" value={persona.stats.domainDepth} color="bg-blue-500" />
        <StatBar label="Patience" value={persona.stats.patience} color="bg-green-500" />
      </div>

      {/* Bio */}
      <p className="text-xs text-white/50 leading-relaxed mb-4 flex-1">{persona.bio}</p>

      {/* Priorities & Pet Peeves */}
      <div className="grid grid-cols-2 gap-3 text-[10px]">
        <div>
          <span className="text-white/30 uppercase tracking-wider block mb-1">Priorities</span>
          <div className="flex flex-wrap gap-1">
            {persona.priorities.slice(0, 3).map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300/70">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <span className="text-white/30 uppercase tracking-wider block mb-1">Pet Peeves</span>
          <div className="flex flex-wrap gap-1">
            {persona.pet_peeves.slice(0, 3).map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300/70">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SelectedPanelDock({
  selectedPersonas,
  onRemove,
}: {
  selectedPersonas: Persona[];
  onRemove: (id: string) => void;
}) {
  if (selectedPersonas.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 frosted-glass border-t border-white/10 safe-bottom"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="text-xs text-white/40 uppercase tracking-wider flex-shrink-0">Your Panel</span>
        <div className="flex gap-2 overflow-x-auto flex-1 scroll-touch">
          <AnimatePresence mode="popLayout">
            {selectedPersonas.map((p) => (
              <motion.button
                key={p.id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => onRemove(p.id)}
                className="relative flex-shrink-0 w-12 h-12 rounded-lg border border-white/20 bg-white/5 overflow-hidden group"
                title={`Remove ${p.name}`}
              >
                <div className="scale-75 -translate-x-0.5 -translate-y-0.5">
                  <MiiAvatar persona={p} size={48} />
                </div>
                <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/40 transition-colors flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <span className="text-sm font-bold text-white/70 flex-shrink-0">{selectedPersonas.length}</span>
      </div>
    </motion.div>
  );
}

function MobileSpotlightCard({
  persona,
  isSelected,
  onToggle,
  packColors,
}: {
  persona: Persona;
  isSelected: boolean;
  onToggle: () => void;
  packColors: typeof PACK_COLORS["general"];
}) {
  return (
    <motion.div
      className={`flex-shrink-0 w-[85vw] snap-center rounded-xl border-2 p-5 transition-colors ${
        isSelected ? "border-blue-400 bg-blue-500/10" : `${packColors.border} bg-gradient-to-b ${packColors.bg}`
      }`}
    >
      <div className="flex items-center gap-4 mb-3">
        <MiiAvatar persona={persona} size={80} />
        <div>
          <h3 className="text-lg font-bold text-white">{persona.name}</h3>
          <p className={`text-xs ${packColors.accent} italic`}>"{persona.archetype}"</p>
        </div>
      </div>
      <p className="text-xs text-white/60 italic mb-3">"{persona.catchphrase}"</p>
      <div className="space-y-1.5 mb-3">
        <StatBar label="Toughness" value={persona.stats.toughness} color="bg-red-500" />
        <StatBar label="Domain Depth" value={persona.stats.domainDepth} color="bg-blue-500" />
        <StatBar label="Patience" value={persona.stats.patience} color="bg-green-500" />
      </div>
      <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-3">{persona.bio}</p>
      <button
        onClick={onToggle}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isSelected
            ? "bg-blue-500 text-white"
            : "bg-white/10 text-white/70 hover:bg-white/15"
        }`}
      >
        {isSelected ? "Selected" : "Select"}
      </button>
    </motion.div>
  );
}

export function PersonaSelector({ onStartSession, onViewSession }: PersonaSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessionType, setSessionType] = useState("business-pitch");
  const [activePack, setActivePack] = useState<PersonaPack>("general");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [recentSessions] = useState<SessionRecord[]>(() => getRecentSessions(3));
  const [showSessionType, setShowSessionType] = useState(false);

  const filteredPersonas = PERSONA_LIBRARY.filter((p) => p.pack === activePack);
  const packColors = PACK_COLORS[activePack];

  const effectiveHighlightedId =
    filteredPersonas.find((p) => p.id === highlightedId) ? highlightedId : filteredPersonas[0]?.id ?? null;
  const highlightedPersona = filteredPersonas.find((p) => p.id === effectiveHighlightedId) || filteredPersonas[0];

  const handlePackChange = useCallback((pack: PersonaPack) => {
    setActivePack(pack);
    setSelected(new Set());
    setHighlightedId(null);
    const packInfo = PERSONA_PACKS.find((p) => p.id === pack);
    if (packInfo) setSessionType(packInfo.sessionType);
  }, []);

  const togglePersona = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removePersona = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const packIds = filteredPersonas.filter((p) => !p.locked).map((p) => p.id);
    const allSelected = packIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(packIds));
  }, [filteredPersonas, selected]);

  const allPackSelected = filteredPersonas.filter((p) => !p.locked).length > 0
    && filteredPersonas.filter((p) => !p.locked).every((p) => selected.has(p.id));
  const selectedPersonas = PERSONA_LIBRARY.filter((p) => selected.has(p.id));

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-4 md:px-6 py-3 sticky top-0 z-40 bg-[#0a0a18]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">
              PP
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">PitchPractice</h1>
              <p className="text-[10px] text-white/40">SELECT YOUR AUDIENCE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionType(!showSessionType)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <span>{SESSION_TYPES.find((s) => s.id === sessionType)?.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${showSessionType ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              onClick={() => onStartSession(selectedPersonas, sessionType)}
              disabled={selected.size === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
            >
              Fight! ({selected.size})
            </button>
          </div>
        </div>

        {/* Session Type Dropdown */}
        <AnimatePresence>
          {showSessionType && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-w-7xl mx-auto pt-3 pb-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                {SESSION_TYPES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => { setSessionType(st.id); setShowSessionType(false); }}
                    className={`text-left p-3 rounded-lg border transition-all text-xs ${
                      sessionType === st.id
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="font-medium mb-0.5">{st.label}</div>
                    <div className="text-white/40 leading-relaxed">{st.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Recent Sessions (collapsed) */}
        {recentSessions.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto scroll-touch pb-1">
            {recentSessions.map((session) => {
              const scoreColor = session.overallScore >= 7 ? "text-emerald-400" : session.overallScore >= 5 ? "text-yellow-400" : "text-red-400";
              return (
                <button
                  key={session.id}
                  onClick={() => session.feedback && onViewSession?.(session)}
                  className={`flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center gap-3 text-xs ${session.feedback ? "hover:bg-white/[0.04] cursor-pointer" : "opacity-50 cursor-default"}`}
                >
                  <span className={`font-bold ${scoreColor}`}>{(session.overallScore || 0).toFixed(1)}</span>
                  <span className="text-white/40">{session.sessionType.replace(/-/g, " ")}</span>
                  <span className="text-white/20">{new Date(session.date).toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Pack Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto scroll-touch pb-1">
          {PERSONA_PACKS.map((pack) => {
            const colors = PACK_COLORS[pack.id];
            const isActive = activePack === pack.id;
            const count = PERSONA_LIBRARY.filter((p) => p.pack === pack.id).length;
            return (
              <button
                key={pack.id}
                onClick={() => handlePackChange(pack.id)}
                className={`flex-shrink-0 text-left px-4 py-3 rounded-xl border-2 transition-all min-w-[180px] ${
                  isActive
                    ? `${colors.border} bg-gradient-to-br ${colors.bg} shadow-lg ${colors.glow}`
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{pack.icon}</span>
                  <span className={`font-semibold text-sm ${isActive ? "text-white" : "text-white/70"}`}>{pack.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider ${isActive ? colors.accent : "text-white/30"}`}>{pack.subtitle}</span>
                  <span className="text-[10px] text-white/20">{count} characters</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div className="mb-4 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] text-white/35 leading-relaxed">
          {ARCHETYPE_DISCLAIMER}
        </div>

        {/* Main Content: Roster Grid + Spotlight */}
        <div className="hidden md:grid md:grid-cols-[1fr_380px] gap-6">
          {/* Left: Roster Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40">{filteredPersonas.length} characters</span>
              <button onClick={selectAll} className={`text-xs ${packColors.accent} hover:opacity-80`}>
                {allPackSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredPersonas.map((persona, idx) => (
                <CharacterThumbnail
                  key={persona.id}
                  persona={persona}
                  isSelected={selected.has(persona.id)}
                  isHighlighted={effectiveHighlightedId === persona.id}
                  onClick={() => togglePersona(persona.id)}
                  onHover={() => setHighlightedId(persona.id)}
                  index={idx}
                />
              ))}
            </div>
          </div>

          {/* Right: Spotlight Panel */}
          <div className="sticky top-20 h-fit">
            <AnimatePresence mode="wait">
              {highlightedPersona && (
                <SpotlightPanel persona={highlightedPersona} packColors={packColors} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile: Swipeable Cards */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/40">{filteredPersonas.length} characters</span>
            <button onClick={selectAll} className={`text-xs ${packColors.accent} hover:opacity-80`}>
              {allPackSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-touch pb-4 -mx-4 px-4">
            {filteredPersonas.filter((p) => !p.locked).map((persona) => (
              <MobileSpotlightCard
                key={persona.id}
                persona={persona}
                isSelected={selected.has(persona.id)}
                onToggle={() => togglePersona(persona.id)}
                packColors={packColors}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Dock: Selected Panel */}
      <AnimatePresence>
        {selectedPersonas.length > 0 && (
          <SelectedPanelDock selectedPersonas={selectedPersonas} onRemove={removePersona} />
        )}
      </AnimatePresence>

      {/* Bottom padding for dock */}
      {selectedPersonas.length > 0 && <div className="h-20" />}
    </div>
  );
}
