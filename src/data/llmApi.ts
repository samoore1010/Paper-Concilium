import { ReactionType } from "./personas";

export interface LLMReaction {
  personaId: string;
  reaction: ReactionType;
  comment: string | null;
  question: string | null;
  reasoning: string;
  shouldInterrupt?: boolean;
  urgency?: "low" | "medium" | "high";
  /** Reaction intensity 0.3-1.0 (mild to emphatic). Drives animation amplitude. */
  intensity?: number;
}

export interface LLMFeedback {
  personaId: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestion: string;
  emotionalResponse: string;
}

const API_BASE = "";  // Same origin

export async function checkLLMAvailability(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    return data.llmAvailable === true;
  } catch {
    return false;
  }
}

export async function getLLMReactionsBatch(
  personaIds: string[],
  userText: string,
  sessionType: string,
  messageHistory: string[],
  sourceContext?: { summary: string; filenames: string[]; combinedText: string }
): Promise<LLMReaction[]> {
  const res = await fetch(`${API_BASE}/api/react-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaIds, userText, sessionType, messageHistory, sourceContext }),
  });

  if (!res.ok) throw new Error("Failed to get LLM reactions");

  const data = await res.json();
  return (data.reactions || []).map((r: any) => {
    const urgency = r.urgency || "low";
    // Derive intensity: use LLM-provided value if valid, else map from urgency
    let intensity = typeof r.intensity === "number" ? r.intensity : null;
    if (intensity === null || intensity < 0.3 || intensity > 1.0) {
      intensity = urgency === "high" ? 0.9 : urgency === "medium" ? 0.65 : 0.45;
    }
    return {
      personaId: r.personaId,
      reaction: mapReaction(r.reaction),
      comment: r.comment || null,
      question: r.question || null,
      reasoning: r.reasoning || "",
      shouldInterrupt: r.shouldInterrupt === true || r.shouldInterrupt === "true",
      urgency,
      intensity,
    };
  });
}

export async function getLLMFeedbackBatch(
  personaIds: string[],
  transcript: string,
  sessionType: string
): Promise<LLMFeedback[]> {
  const res = await fetch(`${API_BASE}/api/feedback-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaIds, transcript, sessionType }),
  });

  if (!res.ok) throw new Error("Failed to get LLM feedback");

  const data = await res.json();
  return (data.feedback || []).map((f: any) => ({
    personaId: f.personaId,
    overallScore: Math.max(1, Math.min(10, f.overallScore || 5)),
    summary: f.summary || "",
    strengths: f.strengths || [],
    weaknesses: f.weaknesses || [],
    suggestion: f.suggestion || "",
    emotionalResponse: f.emotionalResponse || "",
  }));
}

function mapReaction(r: string): ReactionType {
  const valid: ReactionType[] = ["nod", "shake", "think", "smile", "frown", "neutral"];
  return valid.includes(r as ReactionType) ? (r as ReactionType) : "neutral";
}
