import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
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

// === Voice Config Persistence ===

const VOICE_CONFIG_PATH = path.join(__dirname, "../data/voice-config.json");
let customVoiceConfig: Record<string, string> = {};

function loadVoiceConfig(): Record<string, string> {
  try {
    if (fs.existsSync(VOICE_CONFIG_PATH)) {
      const raw = fs.readFileSync(VOICE_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (err: any) {
    console.error("[VoiceConfig] Failed to load:", err.message);
  }
  return {};
}

function saveVoiceConfig(config: Record<string, string>): void {
  const dir = path.dirname(VOICE_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(VOICE_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

function resolveVoiceId(personaId: string): string {
  return customVoiceConfig[personaId] || ELEVENLABS_VOICES[personaId] || "21m00Tcm4TlvDq8ikWAM";
}

// Load custom config at startup
customVoiceConfig = loadVoiceConfig();
console.log(`[VoiceConfig] Loaded ${Object.keys(customVoiceConfig).length} custom voice mapping(s)`);

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
      const voiceId = resolveVoiceId(personaId);
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
          optimize_streaming_latency: 4, // Max speed (slight quality tradeoff is acceptable for real-time)
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
    const voiceId = resolveVoiceId(personaId);
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

  const { description, sessionType, durationMinutes, sourceContext, emphasisNotes, outlineMode } = req.body;
  if (!description && !sourceContext) return res.status(400).json({ error: "description or sourceContext required" });

  const duration = durationMinutes || 3;
  const wordCount = duration * 130; // ~130 WPM target

  // Source-material-aware generation uses Sonnet for quality; plain generation uses Haiku
  const isFromMaterials = !!sourceContext?.combinedText;
  const model = isFromMaterials ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";

  try {
    const sourceLabel = isFromMaterials
      ? `${sourceContext.fileCount} source file(s): ${sourceContext.filenames.join(", ")}`
      : description.substring(0, 50);
    console.log(`[Script] Generating ${duration}min ${outlineMode ? "outline" : "script"} from: "${sourceLabel}..."`);

    let userPrompt: string;

    if (isFromMaterials) {
      // Structured generation from uploaded source materials
      const sessionLabel = sessionType?.replace(/-/g, " ") || "presentation";
      const modeInstruction = outlineMode
        ? `Generate a structured OUTLINE (not a full script) for a ${duration}-minute ${sessionLabel}. For each section, provide:
- A section heading
- 3-5 key talking points as bullet points
- Transition notes to the next section
- Approximate time allocation

Use the format:
--- Section: [Section Title] (~Xm) ---
• Key point 1
• Key point 2
• Key point 3
[Transition: brief transition note]`
        : `Write a ${duration}-minute ${sessionLabel} script (approximately ${wordCount} words) structured around the source material.

Use section markers in this exact format to divide the script:
--- Section: [Section Title] (~Xm) ---

Where X is the approximate minutes for that section. Then write the spoken words for that section.

Requirements:
- Natural spoken language (not written prose)
- Strong opening that hooks the audience
- Smooth transitions between sections
- Key data points and supporting evidence from the source material woven in naturally
- Rhetorical questions and pause-worthy moments
- Strong closing that reinforces the main message
- Approximately ${wordCount} words total`;

      userPrompt = `${modeInstruction}

SOURCE MATERIAL:
${sourceContext.combinedText.substring(0, 12000)}

${description ? `SPEAKER'S DESCRIPTION/FOCUS:\n${description}\n` : ""}${emphasisNotes ? `EMPHASIS NOTES (areas to highlight):\n${emphasisNotes}\n` : ""}
Generate the ${outlineMode ? "outline" : "script"} now. Return ONLY the ${outlineMode ? "outline" : "script text with section markers"}, no meta-commentary.`;
    } else {
      // Original plain generation (no source materials)
      userPrompt = `Write a ${duration}-minute ${sessionType?.replace(/-/g, " ") || "presentation"} script (approximately ${wordCount} words) based on this description:

"${description}"

Requirements:
- Natural spoken language (not written prose)
- Clear structure with a strong opening, body, and close
- Include rhetorical questions and pause-worthy moments
- Appropriate for the session type
- Approximately ${wordCount} words

Return ONLY the script text, no titles or annotations.`;
    }

    const systemPrompt = isFromMaterials
      ? "You are an expert speechwriter and presentation coach. You transform source materials into compelling, well-structured presentations. You preserve key facts, data points, and arguments from the source while making them natural and engaging to speak aloud. You organize content into clear sections with smooth transitions."
      : "You are an expert speechwriter. Generate scripts that are natural to speak aloud — conversational, clear, with natural pause points. Do not include stage directions or annotations. Just the spoken words.";

    const message = await client.messages.create({
      model,
      max_tokens: isFromMaterials ? 4000 : 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[Script] Generated ${text.split(/\s+/).length} words (${outlineMode ? "outline" : "script"}, model: ${model})`);
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

  const { personaId, userText, sessionType, messageHistory, sourceContext } = req.body;
  if (!personaId || !userText) return res.status(400).json({ error: "personaId and userText required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const persona = getPersonaPrompt(personaId, effectiveSessionType);
    const prompt = buildReactionPrompt(persona, userText, effectiveSessionType, messageHistory || [], sourceContext || undefined);
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

  const { personaIds, userText, sessionType, messageHistory, sourceContext } = req.body;
  if (!personaIds?.length || !userText) return res.status(400).json({ error: "personaIds and userText required" });

  const effectiveSessionType = sessionType || "business-pitch";
  try {
    const results = await Promise.allSettled(
      personaIds.map(async (personaId: string) => {
        const persona = getPersonaPrompt(personaId, effectiveSessionType);
        const prompt = buildReactionPrompt(persona, userText, effectiveSessionType, messageHistory || [], sourceContext || undefined);
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

// === Source Material Extraction ===

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB per file, max 5 files
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/markdown",
    ];
    // Also accept by extension as MIME types can vary
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".pdf", ".docx", ".pptx", ".txt", ".md"];
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
    }
  },
});

interface ExtractedFile {
  filename: string;
  type: string;
  text: string;
  pageCount?: number;
}

async function extractFileContent(file: Express.Multer.File): Promise<ExtractedFile> {
  const ext = path.extname(file.originalname).toLowerCase();
  const base: Omit<ExtractedFile, "text"> = { filename: file.originalname, type: ext.replace(".", "") };

  if (ext === ".txt" || ext === ".md") {
    return { ...base, text: file.buffer.toString("utf-8") };
  }

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    const textResult = await parser.getText();
    const info = await parser.getInfo();
    await parser.destroy();
    return { ...base, text: textResult.text, pageCount: info.total };
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { ...base, text: result.value };
  }

  if (ext === ".pptx") {
    // PPTX is a ZIP of XML files — extract slide text via basic XML parsing
    const text = await extractPptxText(file.buffer);
    return { ...base, text };
  }

  throw new Error(`No extractor for ${ext}`);
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slides: { num: number; text: string }[] = [];

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    const match = filename.match(/ppt\/slides\/slide(\d+)\.xml/);
    if (match && !zipEntry.dir) {
      const xml = await zipEntry.async("string");
      // Extract text from <a:t> tags
      const textParts: string[] = [];
      const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
      let m;
      while ((m = regex.exec(xml)) !== null) {
        textParts.push(m[1]);
      }
      if (textParts.length > 0) {
        slides.push({ num: parseInt(match[1]), text: textParts.join(" ") });
      }
    }
  }

  slides.sort((a, b) => a.num - b.num);
  return slides.map((s) => `[Slide ${s.num}]\n${s.text}`).join("\n\n");
}

app.post("/api/extract-materials", upload.array("files", 5), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files provided" });
  }

  console.log(`[Materials] Extracting ${files.length} file(s): ${files.map((f) => f.originalname).join(", ")}`);

  try {
    const results = await Promise.allSettled(files.map(extractFileContent));

    const extracted: ExtractedFile[] = [];
    const errors: { filename: string; error: string }[] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        extracted.push(r.value);
      } else {
        errors.push({ filename: files[i].originalname, error: r.reason?.message || "Unknown error" });
      }
    });

    // Build sourceContext summary
    const combinedText = extracted.map((e) => {
      const header = e.pageCount ? `--- ${e.filename} (${e.pageCount} pages) ---` : `--- ${e.filename} ---`;
      return `${header}\n${e.text}`;
    }).join("\n\n");

    console.log(`[Materials] Extracted ${extracted.length} file(s), ${errors.length} error(s), ${combinedText.length} chars total`);

    res.json({
      extracted,
      errors,
      combinedText,
      sourceContext: {
        fileCount: extracted.length,
        filenames: extracted.map((e) => e.filename),
        totalChars: combinedText.length,
        summary: combinedText.substring(0, 500) + (combinedText.length > 500 ? "..." : ""),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Materials] Error:", msg);
    res.status(500).json({ error: "Failed to extract materials", detail: msg });
  }
});

// === Admin Voice Config ===

app.get("/api/admin/voice-config", (_req, res) => {
  res.json({
    defaults: ELEVENLABS_VOICES,
    custom: customVoiceConfig,
  });
});

app.put("/api/admin/voice-config", (req, res) => {
  const { config } = req.body;
  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "config object required" });
  }

  // Validate: only allow non-empty string values, strip empty strings
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.trim()) {
      cleaned[key] = value.trim();
    }
  }

  try {
    saveVoiceConfig(cleaned);
    customVoiceConfig = cleaned;
    console.log(`[VoiceConfig] Saved ${Object.keys(cleaned).length} custom voice mapping(s)`);
    res.json({ saved: true, count: Object.keys(cleaned).length });
  } catch (err: any) {
    console.error("[VoiceConfig] Save error:", err.message);
    res.status(500).json({ error: "Failed to save voice config", detail: err.message });
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
