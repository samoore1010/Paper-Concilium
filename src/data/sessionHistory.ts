import { SpeechMetrics } from "../hooks/useSpeechMetrics";

export interface ProsodyRecord {
  averageVolume: number;
  volumeVariation: number;
  pitchVariation: number;
  energyLevel: number;
  silenceRatio: number;
}

export interface StoredFeedback {
  personaId: string;
  personaName: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestion: string;
  emotionalResponse: string;
}

export interface SessionRecord {
  id: string;
  date: number;
  sessionType: string;
  personaIds: string[];
  overallScore: number;
  perPersonaScores: Record<string, number>;
  wordCount: number;
  duration: number;
  speechMetrics: SpeechMetrics;
  prosodyMetrics?: ProsodyRecord;
  feedback?: StoredFeedback[];
  transcript?: string;
}

const STORAGE_KEY = "concilium_session_history";

function loadFromStorage(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage full or unavailable — silently degrade
  }
}

let sessionHistory: SessionRecord[] = loadFromStorage();

export function addSession(session: SessionRecord): void {
  sessionHistory.push(session);
  saveToStorage(sessionHistory);
}

export function getSessionHistory(): SessionRecord[] {
  return [...sessionHistory];
}

export function getRecentSessions(count: number = 3): SessionRecord[] {
  return sessionHistory.slice(-count).reverse();
}

export function getSessionById(id: string): SessionRecord | undefined {
  return sessionHistory.find((s) => s.id === id);
}

export function clearHistory(): void {
  sessionHistory = [];
  saveToStorage(sessionHistory);
}
