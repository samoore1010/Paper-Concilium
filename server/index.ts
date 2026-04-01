import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getPersonaPrompt, buildReactionPrompt, buildFeedbackPrompt } from "./personaPrompts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../dist")));

// === Provider Init ===

let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// === Voice Mappings ===

const OPENAI_VOICES: Record<string, string> = {
  "maria-chen": "nova",
  "james-wilson": "onyx",
  "aisha-johnson": "shimmer",
  "carlos-reyes": "echo",
  "patricia-omalley": "fable",
  "dev-patel": "alloy",
};

const ELEVENLABS_VOICES: Record<string, string> = {
  "maria-chen": "21m00Tcm4TlvDq8ikWAM",      // Rachel
  "james-wilson": "fATgBRI8wg5KkDFg8vBd",     // Custom voice
  "aisha-johnson": "EXAVITQu4vr4xnSDxMaL",   // Bella
  "carlos-reyes": "ErXwobaYiN019PkySvjV",     // Antoni
  "patricia-omalley": "MF3mGyEYCl7XYWbV9V6O", // Elli
  "dev-patel": "TxGEqnHWrfWFTfGW9XjX",       // Josh
};

// === Health Check ===

app.get("/api/health", (_req, res) => {
  const ttsProviders: string[] = [];
  if (process.env.OPENAI_API_KEY) ttsProviders.push("openai");
  if (process.env.ELEVENLABS_API_KEY) ttsProviders.push("elevenlabs");

  res.json({
    status: "ok",
    llmAvailable: !!process.env.ANTHROPIC_API_KEY,
    ttsAvailable: ttsProviders.length > 0,
    ttsProviders,
    sttAvailable: !!process.env.ELEVENLABS_API_KEY,
  });
});

// ElevenLabs diagnostic — test TTS directly
app.get("/api/tts/test-elevenlabs", async (_req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.json({ status: "no key", keyLength: 0 });

  const keyPreview = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);

  // Test 1: models endpoint (should work with any valid key)
  let modelsStatus = "untested";
  try {
    const modelsRes = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: { "xi-api-key": apiKey },
    });
    modelsStatus = modelsRes.ok ? "ok" : `error ${modelsRes.status}`;
  } catch (e: any) { modelsStatus = e.message; }

  // Test 2: actual TTS call with a short text
  let ttsStatus = "untested";
  let ttsDetail = "";
  try {
    const ttsRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: "Test.",
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (ttsRes.ok) {
      const size = (await ttsRes.arrayBuffer()).byteLength;
      ttsStatus = "ok";
      ttsDetail = `audio ${size} bytes`;
    } else {
      ttsStatus = `error ${ttsRes.status}`;
      ttsDetail = await ttsRes.text();
    }
  } catch (e: any) { ttsStatus = e.message; }

  res.json({ keyPreview, keyLength: apiKey.length, modelsStatus, ttsStatus, ttsDetail });
});

// === ElevenLabs STT Token (official single-use token flow) ===

app.get("/api/scribe-token", async (_req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ available: false, error: "ElevenLabs not configured" });

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[STT Token] Failed ${response.status}: ${detail}`);
      return res.status(response.status).json({ available: false, error: "Failed to mint single-use token", detail });
    }

    const data = await response.json();
    if (!data?.token) {
      return res.status(502).json({ available: false, error: "Token missing from ElevenLabs response" });
    }

    res.json({ available: true, token: data.token, type: "single_use" });
  } catch (err: any) {
    console.error("[STT Token] Error:", err.message);
    res.status(500).json({ available: false, error: "Unable to mint token", detail: err.message });
  }
});

// === Streaming TTS Endpoint ===

app.post("/api/tts/stream", async (req, res) => {
  const { text, personaId, provider } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey && provider === "elevenlabs") return res.status(503).json({ error: "ElevenLabs not configured" });

  // Use ElevenLabs streaming endpoint
  if (apiKey && (provider === "elevenlabs" || provider === "auto")) {
    try {
      const voiceId = ELEVENLABS_VOICES[personaId] || "21m00Tcm4TlvDq8ikWAM";
      console.log(`[TTS:Stream] ElevenLabs voice="${voiceId}" persona="${personaId}"`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          optimize_streaming_latency: 3, // Balance quality + speed
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[TTS:Stream] ElevenLabs error ${response.status}:`, errText);
        // Fallback to non-streaming
        return ttsOpenAI(text, personaId, 1.0, res);
      }

      // Pipe the streaming response directly to the client
      res.set({
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(Buffer.from(value));
        }
      };
      await pump();
    } catch (err: any) {
      console.error("[TTS:Stream] Error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Streaming TTS failed" });
      }
    }
    return;
  }

  // Fallback to regular TTS
  return ttsOpenAI(text, personaId, 1.0, res);
});

// === TTS Endpoint (multi-provider) ===

app.post("/api/tts", async (req, res) => {
  const { text, personaId, speed, provider } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const requested = provider || "auto";

  // ElevenLabs (premium) — preferred when explicitly requested or auto with key
  if ((requested === "elevenlabs" || requested === "auto") && process.env.ELEVENLABS_API_KEY) {
    return ttsElevenLabs(text, personaId, res);
  }

  // OpenAI — standard
  if ((requested === "openai" || requested === "auto") && process.env.OPENAI_API_KEY) {
    return ttsOpenAI(text, personaId, speed, res);
  }

  return res.status(503).json({ error: "No TTS provider configured." });
});

async function ttsOpenAI(text: string, personaId: string, speed: number, res: any) {
  const client = getOpenAI();
  if (!client) return res.status(503).json({ error: "OpenAI not configured" });

  try {
    const voice = (OPENAI_VOICES[personaId] || "alloy") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    console.log(`[TTS:OpenAI] voice="${voice}" persona="${personaId}"`);

    const response = await client.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      speed: speed || 1.0,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    // Stream the audio to reduce perceived latency
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length.toString() });
    res.send(buffer);
  } catch (error: any) {
    console.error("[TTS:OpenAI] Error:", error.message);
    res.status(500).json({ error: "OpenAI TTS failed", detail: error.message });
  }
}

async function ttsElevenLabs(text: string, personaId: string, res: any) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured" });

  try {
    const voiceId = ELEVENLABS_VOICES[personaId] || "21m00Tcm4TlvDq8ikWAM";
    const keyPreview = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`[TTS:ElevenLabs] voiceId="${voiceId}" persona="${personaId}" keyPreview="${keyPreview}" keyLength=${apiKey.length}`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[TTS:ElevenLabs] API error ${response.status}: ${errBody}`);

      throw new Error(`ElevenLabs API returned ${response.status}: ${errBody}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    // Stream the audio to reduce perceived latency
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length.toString() });
    res.send(buffer);
  } catch (error: any) {
    console.error("[TTS:ElevenLabs] Error:", error.message);
    res.status(500).json({ error: "ElevenLabs TTS failed", detail: error.message });
  }
}

// === Script Generation ===

app.post("/api/generate-script", async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: "LLM not configured." });

  const { description, sessionType, durationMinutes } = req.body;
  if (!description) return res.status(400).json({ error: "description required" });

  const duration = durationMinutes || 3;
  const wordCount = duration * 130; // ~130 WPM target

  try {
    console.log(`[Script] Generating ${duration}min script for: "${description.substring(0, 50)}..."`);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "You are an expert speechwriter. Generate scripts that are natural to speak aloud — conversational, clear, with natural pause points. Do not include stage directions or annotations. Just the spoken words.",
      messages: [{
        role: "user",
        content: `Write a ${duration}-minute ${sessionType?.replace(/-/g, " ") || "presentation"} script (approximately ${wordCount} words) based on this description:

"${description}"

Requirements:
- Natural spoken language (not written prose)
- Clear structure with a strong opening, body, and close
- Include rhetorical questions and pause-worthy moments
- Appropriate for the session type
- Approximately ${wordCount} words

Return ONLY the script text, no titles or annotations.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[Script] Generated ${text.split(/\s+/).length} words`);
    res.json({ script: text.trim() });
  } catch (error: any) {
    console.error("[Script] Error:", error.message);
    res.status(500).json({ error: "Failed to generate script", detail: error.message });
  }
});

// === LLM Reaction Endpoints ===

app.post("/api/react", async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: "LLM not configured." });

  const { personaId, userText, sessionType, messageHistory } = req.body;
  if (!personaId || !userText) return res.status(400).json({ error: "personaId and userText required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const persona = getPersonaPrompt(personaId, effectiveSessionType);
    const prompt = buildReactionPrompt(persona, userText, effectiveSessionType, messageHistory || []);
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 300,
      system: persona.systemPrompt, messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = safeParseJSON(text);
    if (!parsed) throw new Error("Failed to parse JSON");
    res.json(parsed);
  } catch (error: any) {
    console.error("Reaction error:", error.message);
    res.status(500).json({ error: "Failed to generate reaction", detail: error.message });
  }
});

app.post("/api/react-batch", async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: "LLM not configured." });

  const { personaIds, userText, sessionType, messageHistory } = req.body;
  if (!personaIds?.length || !userText) return res.status(400).json({ error: "personaIds and userText required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const results = await Promise.allSettled(
      personaIds.map(async (personaId: string) => {
        const persona = getPersonaPrompt(personaId, effectiveSessionType);
        const prompt = buildReactionPrompt(persona, userText, effectiveSessionType, messageHistory || []);
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001", max_tokens: 300,
          system: persona.systemPrompt, messages: [{ role: "user", content: prompt }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const parsed = safeParseJSON(text);
        if (!parsed) throw new Error("Failed to parse JSON");
        return { personaId, ...parsed };
      })
    );

    const reactions = results.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled").map((r) => r.value);
    const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r, i) => ({ personaId: personaIds[i], error: r.reason?.message }));
    res.json({ reactions, errors });
  } catch (error: any) {
    console.error("Batch reaction error:", error.message);
    res.status(500).json({ error: "Failed to generate reactions" });
  }
});

// === LLM Feedback Endpoints ===

app.post("/api/feedback", async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: "LLM not configured." });

  const { personaId, transcript, sessionType } = req.body;
  if (!personaId || !transcript) return res.status(400).json({ error: "personaId and transcript required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const persona = getPersonaPrompt(personaId, effectiveSessionType);
    const prompt = buildFeedbackPrompt(persona, transcript, effectiveSessionType);
    console.log(`[Feedback] Generating for ${personaId}...`);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1500,
      system: persona.systemPrompt, messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[Feedback] Raw for ${personaId}: ${text.substring(0, 100)}...`);
    const parsed = safeParseJSON(text);
    if (!parsed) return res.status(500).json({ error: "Failed to parse LLM response" });

    console.log(`[Feedback] Success for ${personaId}: score ${parsed.overallScore}`);
    res.json({ personaId, personaName: personaId, ...parsed });
  } catch (error: any) {
    console.error(`[Feedback] Error for ${personaId}:`, error.message);
    res.status(500).json({ error: "Failed to generate feedback", detail: error.message });
  }
});

app.post("/api/feedback-batch", async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: "LLM not configured." });

  const { personaIds, transcript, sessionType } = req.body;
  if (!personaIds?.length || !transcript) return res.status(400).json({ error: "personaIds and transcript required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const feedback: any[] = [];
    for (const personaId of personaIds) {
      try {
        const persona = getPersonaPrompt(personaId, effectiveSessionType);
        const prompt = buildFeedbackPrompt(persona, transcript, effectiveSessionType);
        const message = await client.messages.create({
          model: "claude-sonnet-4-6", max_tokens: 1500,
          system: persona.systemPrompt, messages: [{ role: "user", content: prompt }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const parsed = safeParseJSON(text);
        if (!parsed) throw new Error("Failed to parse JSON");
        feedback.push({ personaId, ...parsed });
        console.log(`[Feedback-Batch] ${personaId}: score ${parsed.overallScore}`);
      } catch (err: any) {
        console.error(`[Feedback-Batch] Failed for ${personaId}:`, err.message);
      }
    }
    res.json({ feedback });
  } catch (error: any) {
    console.error("Batch feedback error:", error.message);
    res.status(500).json({ error: "Failed to generate feedback" });
  }
});

// === SPA Fallback ===
app.use((_req: any, res: any) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  const ttsProviders: string[] = [];
  if (process.env.OPENAI_API_KEY) ttsProviders.push("openai");
  if (process.env.ELEVENLABS_API_KEY) ttsProviders.push("elevenlabs");
  console.log(`Server running on port ${PORT}`);
  console.log(`LLM: ${!!process.env.ANTHROPIC_API_KEY ? "yes" : "no"}`);
  console.log(`TTS providers: ${ttsProviders.length > 0 ? ttsProviders.join(", ") : "none"}`);
  console.log(`STT client-token flow: ${!!process.env.ELEVENLABS_API_KEY ? "yes" : "no"}`);
});

function safeParseJSON(text: string): any {
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
