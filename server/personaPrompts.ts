/**
 * Persona prompt resolution and prompt building.
 *
 * Delegates to the personalityEngine for structured, multi-layered prompt
 * composition. The engine composes system prompts from discrete identity,
 * behavioral, domain-knowledge, and voice layers.
 *
 * Public API is unchanged — getPersonaPrompt / buildReactionPrompt /
 * buildFeedbackPrompt still work the same way for the server endpoints.
 */

import { composePersonaPrompt } from "./personalityEngine.js";

export interface PersonaPrompt {
  systemPrompt: string;
  reactionInstruction: string;
  feedbackInstruction: string;
}

/**
 * Get the composed prompt for a persona. The sessionType is needed because
 * domain knowledge varies by session. Defaults to "business-pitch".
 *
 * Falls back to "maria-chen" if the persona ID is unknown.
 */
export function getPersonaPrompt(personaId: string, sessionType = "business-pitch", customName?: string): PersonaPrompt {
  const composed = composePersonaPrompt(personaId, sessionType, customName)
    ?? composePersonaPrompt("maria-chen", sessionType);
  // maria-chen is always defined, so this is safe
  return composed as PersonaPrompt;
}

// Session-specific turn-taking instructions
const TURN_TAKING: Record<string, string> = {
  "mock-trial": `This is an oral argument before a judicial panel. You are a judge. You SHOULD interrupt the presenter with tough questions — this is how oral arguments work. Don't wait for them to finish if you have a pressing question. Be direct and challenging. If the presenter pauses even briefly, you may jump in. Set "shouldInterrupt" to true when you have a question you'd ask mid-speech.`,

  "business-pitch": `This is a business pitch. You're an investor/panelist. Generally let the presenter make their case, but you CAN interrupt if something is unclear, if they make a bold claim without evidence, or if you're losing interest. Set "shouldInterrupt" to true only for important clarifications.`,

  "public-speaking": `This is a keynote or speech. You are in the audience. Do NOT interrupt — listen silently and react non-verbally. Save all questions and comments. Only set "shouldInterrupt" to false. You may think and react, but the speaker has the floor.`,

  "sales-demo": `This is a sales presentation. You're a potential client. You can ask clarifying questions occasionally but generally let them present. Set "shouldInterrupt" to true only if you're confused or need immediate clarification.`,
};

export interface SourceContextForPrompt {
  summary: string;
  filenames: string[];
  combinedText: string;
}

export function buildReactionPrompt(persona: PersonaPrompt, userText: string, sessionType: string, messageHistory: string[], sourceContext?: SourceContextForPrompt): string {
  const context = messageHistory.length > 0
    ? `\n\nPrevious statements from the presenter:\n${messageHistory.slice(-5).map((m, i) => `${i + 1}. "${m}"`).join("\n")}`
    : "";

  const turnTaking = TURN_TAKING[sessionType] || TURN_TAKING["business-pitch"];

  // Build source material context block (~500 tokens max as per spec)
  let sourceBlock = "";
  if (sourceContext?.combinedText) {
    // Truncate to ~2000 chars (~500 tokens) for prompt budget
    const truncated = sourceContext.combinedText.substring(0, 2000);
    sourceBlock = `\n\nSOURCE MATERIALS (the presenter's reference documents: ${sourceContext.filenames.join(", ")}):
${truncated}${sourceContext.combinedText.length > 2000 ? "\n[...truncated]" : ""}

CONTEXT-AWARE INSTRUCTIONS:
- You have access to the presenter's source materials above. Use them to ask SPECIFIC, informed questions.
- If the presenter makes a claim that contradicts or misrepresents the source material, challenge it.
- If they skip important content from the source, you may ask about it.
- If they cite data, verify it against the source and ask for clarification if it seems off.
- Ask about specific details from the source material that relate to YOUR expertise and priorities.
- One sharp, specific question beats three generic ones.`;
  }

  return `The presenter is giving a ${sessionType.replace(/-/g, " ")}. They just said:

"${userText}"${context}${sourceBlock}

SESSION BEHAVIOR: ${turnTaking}

${persona.reactionInstruction}

Add these fields to the JSON:
- "shouldInterrupt": boolean (true if you would speak up RIGHT NOW, before the presenter continues)
- "urgency": "low" | "medium" | "high" (how important is it that you speak)

Respond with ONLY the JSON object, no other text.`;
}

export function buildFeedbackPrompt(persona: PersonaPrompt, fullTranscript: string, sessionType: string): string {
  return `The presenter just completed a ${sessionType.replace(/-/g, " ")}. Here is their full transcript:

---
${fullTranscript}
---

${persona.feedbackInstruction}

Respond with a JSON object:
{
  "overallScore": <number 1-10>,
  "summary": "<string>",
  "strengths": ["<string>", "<string>"],
  "weaknesses": ["<string>", "<string>"],
  "suggestion": "<string>",
  "emotionalResponse": "<string>"
}

Respond with ONLY the JSON object, no other text.`;
}
