import { SpeechMetrics } from "../hooks/useSpeechMetrics";
import { VisualMetricsSnapshot } from "../hooks/useVisualAnalysis";

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
  visualMetrics?: VisualMetricsSnapshot;
  feedback?: StoredFeedback[];
  transcript?: string;
}

let sessionHistory: SessionRecord[] = [];

export function addSession(session: SessionRecord): void {
  sessionHistory.push(session);
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
}
