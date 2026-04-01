import { PersonaPack, PERSONA_LIBRARY, Persona } from "./personas";

// ============================================================
// Types
// ============================================================

export type MasteryTier = "none" | "bronze" | "silver" | "gold" | "platinum";

export const MASTERY_ORDER: MasteryTier[] = ["none", "bronze", "silver", "gold", "platinum"];

export const MASTERY_COLORS: Record<MasteryTier, string> = {
  none: "#6b7280",
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  platinum: "#e5e4e2",
};

export const MASTERY_LABELS: Record<MasteryTier, string> = {
  none: "Unranked",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export interface CharacterStats {
  personaId: string;
  sessionsCompleted: number;
  totalScore: number;
  bestScore: number;
  masteryTier: MasteryTier;
  dossierLevel: number; // 0-3
  lastSessionDate: number;
}

export interface CollectionProgress {
  unlockedCharacters: string[];
  characterStats: Record<string, CharacterStats>;
  seasonalClaims: string[];
}

export interface UnlockRequirement {
  type: "starter" | "sessions" | "mastery" | "pack-sessions" | "seasonal";
  description: string;
  sessionsRequired?: number;
  packId?: PersonaPack;
  masteryTarget?: { personaId: string; tier: MasteryTier };
  availableFrom?: string;
  availableUntil?: string;
}

export interface DossierEntry {
  level: number;
  title: string;
  content: string;
  requiredTier: MasteryTier;
}

// ============================================================
// Mastery Thresholds
// ============================================================

const MASTERY_THRESHOLDS: { tier: MasteryTier; sessions: number; avgScore: number }[] = [
  { tier: "bronze", sessions: 3, avgScore: 4.0 },
  { tier: "silver", sessions: 5, avgScore: 5.5 },
  { tier: "gold", sessions: 8, avgScore: 7.0 },
  { tier: "platinum", sessions: 12, avgScore: 8.0 },
];

// ============================================================
// Unlock Requirements per Persona
// ============================================================

const UNLOCK_REQUIREMENTS: Record<string, UnlockRequirement> = {
  // General pack — all starters (backwards compatible)
  "maria-chen": { type: "starter", description: "Available from the start" },
  "james-wilson": { type: "starter", description: "Available from the start" },
  "aisha-johnson": { type: "starter", description: "Available from the start" },
  "carlos-reyes": { type: "starter", description: "Available from the start" },
  "patricia-omalley": { type: "starter", description: "Available from the start" },
  "dev-patel": { type: "starter", description: "Available from the start" },

  // Legal Pack — "The Bench"
  "bench-institutionalist": { type: "starter", description: "Available from the start" },
  "bench-peoples-advocate": { type: "starter", description: "Available from the start" },
  "bench-pragmatic-scholar": { type: "starter", description: "Available from the start" },
  "bench-originalist": {
    type: "pack-sessions",
    description: "Complete 3 sessions with Legal Pack characters",
    sessionsRequired: 3,
    packId: "legal-bench",
  },
  "bench-prosecutor": {
    type: "pack-sessions",
    description: "Complete 3 sessions with Legal Pack characters",
    sessionsRequired: 3,
    packId: "legal-bench",
  },
  "bench-textualist": {
    type: "pack-sessions",
    description: "Complete 5 sessions with Legal Pack characters",
    sessionsRequired: 5,
    packId: "legal-bench",
  },
  "bench-precedent-keeper": {
    type: "pack-sessions",
    description: "Complete 5 sessions with Legal Pack characters",
    sessionsRequired: 5,
    packId: "legal-bench",
  },
  "bench-doctrine-purist": {
    type: "mastery",
    description: "Reach Silver mastery with any Legal Pack character",
    masteryTarget: { personaId: "__any_legal__", tier: "silver" },
  },
  "bench-living-constitutionalist": {
    type: "mastery",
    description: "Reach Silver mastery with any Legal Pack character",
    masteryTarget: { personaId: "__any_legal__", tier: "silver" },
  },

  // Business Pack — "The Tank"
  "tank-scale-hunter": { type: "starter", description: "Available from the start" },
  "tank-street-smart-closer": { type: "starter", description: "Available from the start" },
  "tank-royalty-king": {
    type: "pack-sessions",
    description: "Complete 3 sessions with Business Pack characters",
    sessionsRequired: 3,
    packId: "business-tank",
  },
  "tank-product-queen": {
    type: "pack-sessions",
    description: "Complete 3 sessions with Business Pack characters",
    sessionsRequired: 3,
    packId: "business-tank",
  },
  "tank-growth-driver": {
    type: "pack-sessions",
    description: "Complete 5 sessions with Business Pack characters",
    sessionsRequired: 5,
    packId: "business-tank",
  },
  "tank-brand-builder": {
    type: "mastery",
    description: "Reach Silver mastery with any Business Pack character",
    masteryTarget: { personaId: "__any_business__", tier: "silver" },
  },
};

// ============================================================
// Dossier Content per Persona
// ============================================================

function buildDossier(persona: Persona): DossierEntry[] {
  return [
    {
      level: 0,
      title: "Profile",
      content: persona.bio,
      requiredTier: "none",
    },
    {
      level: 1,
      title: "What They Look For",
      content: `Priorities: ${persona.priorities.join(", ")}`,
      requiredTier: "bronze",
    },
    {
      level: 2,
      title: "What Sets Them Off",
      content: `Pet peeves: ${persona.pet_peeves.join(", ")}. Avoid these to maintain their engagement and earn higher scores.`,
      requiredTier: "silver",
    },
    {
      level: 3,
      title: "Mastery Strategy",
      content: buildMasteryStrategy(persona),
      requiredTier: "gold",
    },
  ];
}

function buildMasteryStrategy(persona: Persona): string {
  const style = persona.communicationStyle;
  const strategies: Record<string, string> = {
    analytical: "Lead with data and structured arguments. Present clear frameworks early, back claims with specific metrics, and anticipate follow-up questions about methodology.",
    emotional: "Connect through personal stories and real-world impact. Show genuine passion, use concrete examples of who benefits, and acknowledge the human cost of inaction.",
    skeptical: "Front-load your strongest evidence and acknowledge risks proactively. Show you've stress-tested your own arguments and have contingency plans.",
    supportive: "Be authentic and humble. Show genuine commitment to making things work, acknowledge limitations honestly, and demonstrate practical feasibility.",
    blunt: "Be direct and concise. Lead with the bottom line, skip pleasantries, and show you respect their time by getting to the point immediately.",
    socratic: "Prepare for hypotheticals. Have clear limiting principles, test your own rule against edge cases before presenting, and embrace the questioning process.",
    confrontational: "Know your facts cold. Expect rapid-fire challenges, answer directly without hedging, and maintain composure under pressure.",
  };
  return strategies[style] || strategies.analytical;
}

// ============================================================
// Persistence
// ============================================================

const STORAGE_KEY = "concilium-character-collection";

function getDefaultCollection(): CollectionProgress {
  const starters = Object.entries(UNLOCK_REQUIREMENTS)
    .filter(([, req]) => req.type === "starter")
    .map(([id]) => id);

  return {
    unlockedCharacters: starters,
    characterStats: {},
    seasonalClaims: [],
  };
}

export function loadCollection(): CollectionProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: CollectionProgress = JSON.parse(stored);
      // Ensure all starters are unlocked (handles new personas added after first save)
      const starters = Object.entries(UNLOCK_REQUIREMENTS)
        .filter(([, req]) => req.type === "starter")
        .map(([id]) => id);
      for (const id of starters) {
        if (!parsed.unlockedCharacters.includes(id)) {
          parsed.unlockedCharacters.push(id);
        }
      }
      return parsed;
    }
  } catch {}
  return getDefaultCollection();
}

export function saveCollection(collection: CollectionProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  } catch {}
}

// ============================================================
// Session Recording (called after a MeetingRoom session ends)
// ============================================================

export function recordCharacterSession(
  collection: CollectionProgress,
  personaIds: string[],
  perPersonaScores: Record<string, number>
): { collection: CollectionProgress; newUnlocks: string[] } {
  const updated: CollectionProgress = {
    unlockedCharacters: [...collection.unlockedCharacters],
    characterStats: { ...collection.characterStats },
    seasonalClaims: [...collection.seasonalClaims],
  };

  // Update stats for each persona that participated
  for (const personaId of personaIds) {
    const score = perPersonaScores[personaId] ?? 0;
    const prev = updated.characterStats[personaId];
    const stats: CharacterStats = prev
      ? { ...prev }
      : {
          personaId,
          sessionsCompleted: 0,
          totalScore: 0,
          bestScore: 0,
          masteryTier: "none",
          dossierLevel: 0,
          lastSessionDate: 0,
        };

    stats.sessionsCompleted += 1;
    stats.totalScore += score;
    stats.bestScore = Math.max(stats.bestScore, score);
    stats.lastSessionDate = Date.now();

    // Calculate mastery tier
    const avgScore = stats.totalScore / stats.sessionsCompleted;
    let newTier: MasteryTier = "none";
    for (const threshold of MASTERY_THRESHOLDS) {
      if (stats.sessionsCompleted >= threshold.sessions && avgScore >= threshold.avgScore) {
        newTier = threshold.tier;
      }
    }
    stats.masteryTier = newTier;

    // Calculate dossier level based on mastery
    const tierIdx = MASTERY_ORDER.indexOf(newTier);
    stats.dossierLevel = Math.min(tierIdx, 3);

    updated.characterStats[personaId] = stats;
  }

  // Check for new unlocks
  const newUnlocks: string[] = [];
  for (const [personaId, req] of Object.entries(UNLOCK_REQUIREMENTS)) {
    if (updated.unlockedCharacters.includes(personaId)) continue;

    if (checkUnlockCondition(req, updated)) {
      updated.unlockedCharacters.push(personaId);
      newUnlocks.push(personaId);
    }
  }

  saveCollection(updated);
  return { collection: updated, newUnlocks };
}

// ============================================================
// Unlock Checking
// ============================================================

function checkUnlockCondition(req: UnlockRequirement, collection: CollectionProgress): boolean {
  switch (req.type) {
    case "starter":
      return true;

    case "pack-sessions": {
      if (!req.packId || !req.sessionsRequired) return false;
      const packPersonas = PERSONA_LIBRARY.filter((p) => p.pack === req.packId).map((p) => p.id);
      const totalSessions = packPersonas.reduce(
        (sum, id) => sum + (collection.characterStats[id]?.sessionsCompleted ?? 0),
        0
      );
      return totalSessions >= req.sessionsRequired;
    }

    case "mastery": {
      if (!req.masteryTarget) return false;
      const targetTierIdx = MASTERY_ORDER.indexOf(req.masteryTarget.tier);

      if (req.masteryTarget.personaId === "__any_legal__") {
        const legalPersonas = PERSONA_LIBRARY.filter((p) => p.pack === "legal-bench").map((p) => p.id);
        return legalPersonas.some(
          (id) => MASTERY_ORDER.indexOf(collection.characterStats[id]?.masteryTier ?? "none") >= targetTierIdx
        );
      }
      if (req.masteryTarget.personaId === "__any_business__") {
        const bizPersonas = PERSONA_LIBRARY.filter((p) => p.pack === "business-tank").map((p) => p.id);
        return bizPersonas.some(
          (id) => MASTERY_ORDER.indexOf(collection.characterStats[id]?.masteryTier ?? "none") >= targetTierIdx
        );
      }

      const stats = collection.characterStats[req.masteryTarget.personaId];
      return stats ? MASTERY_ORDER.indexOf(stats.masteryTier) >= targetTierIdx : false;
    }

    case "seasonal": {
      if (!req.availableFrom || !req.availableUntil) return false;
      const now = new Date().toISOString().split("T")[0];
      return now >= req.availableFrom && now <= req.availableUntil;
    }

    case "sessions": {
      // Generic session count across all characters
      const totalSessions = Object.values(collection.characterStats).reduce(
        (sum, s) => sum + s.sessionsCompleted,
        0
      );
      return totalSessions >= (req.sessionsRequired ?? 0);
    }

    default:
      return false;
  }
}

// ============================================================
// Query Helpers
// ============================================================

export function getUnlockRequirement(personaId: string): UnlockRequirement {
  return UNLOCK_REQUIREMENTS[personaId] ?? { type: "starter", description: "Available from the start" };
}

export function getCharacterStats(collection: CollectionProgress, personaId: string): CharacterStats | null {
  return collection.characterStats[personaId] ?? null;
}

export function getDossier(persona: Persona, stats: CharacterStats | null): DossierEntry[] {
  const entries = buildDossier(persona);
  const currentTierIdx = MASTERY_ORDER.indexOf(stats?.masteryTier ?? "none");
  return entries.map((entry) => ({
    ...entry,
    content: MASTERY_ORDER.indexOf(entry.requiredTier) <= currentTierIdx ? entry.content : "🔒 Locked",
  }));
}

export function getPackProgress(collection: CollectionProgress, pack: PersonaPack): {
  total: number;
  unlocked: number;
  mastered: number;
} {
  const packPersonas = PERSONA_LIBRARY.filter((p) => p.pack === pack);
  const unlocked = packPersonas.filter((p) => collection.unlockedCharacters.includes(p.id)).length;
  const mastered = packPersonas.filter(
    (p) => MASTERY_ORDER.indexOf(collection.characterStats[p.id]?.masteryTier ?? "none") >= 1
  ).length;
  return { total: packPersonas.length, unlocked, mastered };
}

export function getCollectionSummary(collection: CollectionProgress): {
  totalCharacters: number;
  totalUnlocked: number;
  totalMastered: number;
  highestTier: MasteryTier;
  totalSessions: number;
} {
  const totalCharacters = PERSONA_LIBRARY.length;
  const totalUnlocked = collection.unlockedCharacters.length;
  const stats = Object.values(collection.characterStats);
  const totalMastered = stats.filter((s) => MASTERY_ORDER.indexOf(s.masteryTier) >= 1).length;
  const totalSessions = stats.reduce((sum, s) => sum + s.sessionsCompleted, 0);

  let highestTier: MasteryTier = "none";
  for (const s of stats) {
    if (MASTERY_ORDER.indexOf(s.masteryTier) > MASTERY_ORDER.indexOf(highestTier)) {
      highestTier = s.masteryTier;
    }
  }

  return { totalCharacters, totalUnlocked, totalMastered, highestTier, totalSessions };
}

export function getMasteryProgress(stats: CharacterStats | null): {
  currentTier: MasteryTier;
  nextTier: MasteryTier | null;
  sessionsToNext: number;
  scoreToNext: number;
} {
  if (!stats) {
    return { currentTier: "none", nextTier: "bronze", sessionsToNext: 3, scoreToNext: 4.0 };
  }

  const currentIdx = MASTERY_ORDER.indexOf(stats.masteryTier);
  const nextThreshold = MASTERY_THRESHOLDS[currentIdx]; // none→bronze, bronze→silver, etc.

  if (!nextThreshold) {
    return { currentTier: stats.masteryTier, nextTier: null, sessionsToNext: 0, scoreToNext: 0 };
  }

  const avgScore = stats.sessionsCompleted > 0 ? stats.totalScore / stats.sessionsCompleted : 0;

  return {
    currentTier: stats.masteryTier,
    nextTier: nextThreshold.tier,
    sessionsToNext: Math.max(0, nextThreshold.sessions - stats.sessionsCompleted),
    scoreToNext: Math.max(0, nextThreshold.avgScore - avgScore),
  };
}
