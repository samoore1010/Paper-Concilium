import { useState, useEffect } from "react";
import { PERSONA_LIBRARY, PERSONA_PACKS, ARCHETYPE_DISCLAIMER, Persona, PersonaPack } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
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
  onViewCollection?: () => void;
}

const SESSION_TYPES = [
  { id: "business-pitch", label: "Business Pitch", desc: "Practice pitching your startup or product to investors" },
  { id: "mock-trial", label: "Mock Trial / Oral Argument", desc: "Present legal arguments to a simulated jury or judge panel" },
  { id: "public-speaking", label: "Public Speaking", desc: "Practice a keynote, class presentation, or speech" },
  { id: "sales-demo", label: "Sales Demo", desc: "Rehearse a product demo for prospective clients" },
];

export function PersonaSelector({ onStartSession, onViewSession, collection, onViewCollection }: PersonaSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessionType, setSessionType] = useState("business-pitch");
  const [activePack, setActivePack] = useState<PersonaPack>("general");
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [staggerIndex, setStaggerIndex] = useState(-1);

  useEffect(() => {
    setRecentSessions(getRecentSessions(3));
  }, []);

  const filteredPersonas = PERSONA_LIBRARY.filter((p) => p.pack === activePack);

  useEffect(() => {
    setStaggerIndex(-1);
    let current = -1;
    const interval = setInterval(() => {
      current++;
      if (current < filteredPersonas.length) {
        setStaggerIndex(current);
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [activePack, filteredPersonas.length]);

  const handlePackChange = (pack: PersonaPack) => {
    setActivePack(pack);
    setSelected(new Set());
    const packInfo = PERSONA_PACKS.find((p) => p.id === pack);
    if (packInfo) setSessionType(packInfo.sessionType);
  };

  const isUnlocked = (id: string) => collection.unlockedCharacters.includes(id);

  const togglePersona = (id: string) => {
    if (!isUnlocked(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <div className="min-h-screen bg-[#0f0f23] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm">PP</div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">PitchPractice</h1>
              <p className="text-xs text-white/40">AI Audience Simulator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onViewCollection && (
              <button
                onClick={onViewCollection}
                className="px-4 py-2.5 border border-white/10 hover:bg-white/[0.04] rounded-lg text-sm font-medium transition-colors text-white/60"
              >
                Collection
              </button>
            )}
            <button
              onClick={() => onStartSession(selectedPersonas, sessionType)}
              disabled={selected.size === 0}
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Start Session ({selected.size})
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Recent Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      {session.feedback && <span className="text-[10px] text-blue-400">View report</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Session Type */}
        <section className="mb-10">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Session Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SESSION_TYPES.map((st) => (
              <button
                key={st.id}
                onClick={() => setSessionType(st.id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  sessionType === st.id
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="text-sm font-medium mb-1">{st.label}</div>
                <div className="text-xs text-white/40 leading-relaxed">{st.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Audience Pack Selection */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">Choose Your Audience</h2>
          </div>

          {/* Pack Tabs */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
            {PERSONA_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => handlePackChange(pack.id)}
                className={`flex-shrink-0 text-left p-4 rounded-lg border transition-all min-w-[200px] ${
                  activePack === pack.id
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{pack.icon}</span>
                  <span className="font-medium text-sm">{pack.name}</span>
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{pack.subtitle}</div>
                <div className="text-xs text-white/40 leading-relaxed line-clamp-2">{pack.description}</div>
              </button>
            ))}
          </div>

          <div className="mb-6 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs text-white/50 leading-relaxed">
            {ARCHETYPE_DISCLAIMER}
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-white/40">{filteredPersonas.length} characters in this pack</span>
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">
              {allPackSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPersonas.map((persona, idx) => {
              const unlocked = isUnlocked(persona.id);
              const isSelected = selected.has(persona.id);
              const isAnimating = idx <= staggerIndex;
              const stats = getCharacterStats(collection, persona.id);
              const req = getUnlockRequirement(persona.id);

              if (!unlocked) {
                return (
                  <div
                    key={persona.id}
                    className={`relative text-left p-4 rounded-lg border border-white/5 bg-white/[0.01] ${isAnimating ? "animate-stagger-in" : "opacity-0"}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 opacity-20 grayscale">
                        <MiiAvatar persona={persona} size={80} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-white/20 mb-1">???</div>
                        <div className="text-[10px] text-white/15 italic mb-2">{persona.archetype}</div>
                        <div className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white/20">
                            <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4z" fill="currentColor" />
                          </svg>
                          <span className="text-[10px] text-white/20">{req.description}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={persona.id}
                  onClick={() => togglePersona(persona.id)}
                  className={`relative text-left p-4 rounded-lg border transition-all ${isAnimating ? "animate-stagger-in" : "opacity-0"} ${
                    isSelected
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <MiiAvatar persona={persona} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">{persona.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                          {persona.age}
                        </span>
                        {stats && stats.masteryTier !== "none" && (
                          <MasteryBadge tier={stats.masteryTier} />
                        )}
                      </div>
                      <div className="text-[10px] text-white/30 italic mb-1">{persona.archetype}</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Tag color="blue">{persona.profession}</Tag>
                        <Tag color="green">{persona.politicalLeaning}</Tag>
                        <Tag color="orange">{persona.communicationStyle}</Tag>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{persona.bio}</p>
                    </div>
                  </div>
                  {/* Selection indicator */}
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "border-blue-400 bg-blue-500" : "border-white/20"
                  }`}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function MasteryBadge({ tier }: { tier: MasteryTier }) {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
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
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}
