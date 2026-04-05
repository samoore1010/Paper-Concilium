export interface VoiceConfig {
  preferredGender: "male" | "female";
  pitch: number;
  rate: number;
  volume: number;
  openaiVoice: string;  // OpenAI TTS voice ID
  speed: number;        // OpenAI TTS speed (0.25-4.0)
}

// ElevenLabs voice IDs — default assignments for all personas.
// General pack has hand-picked voices; bench/tank packs default to Rachel
// until the user assigns custom IDs in Settings → Voice Configuration.
export const ELEVENLABS_DEFAULT_VOICES: Record<string, string> = {
  // General pack
  "maria-chen":       "21m00Tcm4TlvDq8ikWAM", // Rachel
  "james-wilson":     "fATgBRI8wg5KkDFg8vBd", // Custom
  "aisha-johnson":    "EXAVITQu4vr4xnSDxMaL", // Bella
  "carlos-reyes":     "ErXwobaYiN019PkySvjV",  // Antoni
  "patricia-omalley": "MF3mGyEYCl7XYWbV9V6O", // Elli
  "dev-patel":        "TxGEqnHWrfWFTfGW9XjX",  // Josh
  // Legal pack — default Rachel until custom IDs are configured
  "bench-institutionalist":    "21m00Tcm4TlvDq8ikWAM",
  "bench-originalist":         "21m00Tcm4TlvDq8ikWAM",
  "bench-prosecutor":          "21m00Tcm4TlvDq8ikWAM",
  "bench-peoples-advocate":    "21m00Tcm4TlvDq8ikWAM",
  "bench-pragmatic-scholar":   "21m00Tcm4TlvDq8ikWAM",
  "bench-textualist":          "21m00Tcm4TlvDq8ikWAM",
  "bench-precedent-keeper":    "21m00Tcm4TlvDq8ikWAM",
  "bench-doctrine-purist":     "21m00Tcm4TlvDq8ikWAM",
  "bench-living-constitutionalist": "21m00Tcm4TlvDq8ikWAM",
  // Business pack — default Rachel until custom IDs are configured
  "tank-royalty-king":       "21m00Tcm4TlvDq8ikWAM",
  "tank-scale-hunter":       "21m00Tcm4TlvDq8ikWAM",
  "tank-street-smart-closer": "21m00Tcm4TlvDq8ikWAM",
  "tank-product-queen":      "21m00Tcm4TlvDq8ikWAM",
  "tank-growth-driver":      "21m00Tcm4TlvDq8ikWAM",
  "tank-brand-builder":      "21m00Tcm4TlvDq8ikWAM",
};

// ElevenLabs voice ID resolution is server-side (server/index.ts resolveVoiceId).
// ELEVENLABS_DEFAULT_VOICES above is kept only for Settings input placeholders.
// PERSONA_VOICE_MAP below is unrelated — it tunes the browser Web Speech API
// fallback (pitch/rate/volume/gender hints) when no API TTS is available.

export const PERSONA_VOICE_MAP: Record<string, VoiceConfig> = {
  "maria-chen": {
    preferredGender: "female",
    pitch: 1.1,
    rate: 0.95,
    volume: 0.9,
    openaiVoice: "nova",
    speed: 1.0,
  },
  "james-wilson": {
    preferredGender: "male",
    pitch: 0.8,
    rate: 0.85,
    volume: 0.85,
    openaiVoice: "onyx",
    speed: 0.9,
  },
  "aisha-johnson": {
    preferredGender: "female",
    pitch: 0.9,
    rate: 1.05,
    volume: 0.95,
    openaiVoice: "shimmer",
    speed: 1.05,
  },
  "carlos-reyes": {
    preferredGender: "male",
    pitch: 1.1,
    rate: 1.1,
    volume: 0.9,
    openaiVoice: "echo",
    speed: 1.1,
  },
  "patricia-omalley": {
    preferredGender: "female",
    pitch: 1.2,
    rate: 0.9,
    volume: 0.85,
    openaiVoice: "fable",
    speed: 0.9,
  },
  "dev-patel": {
    preferredGender: "male",
    pitch: 0.85,
    rate: 1.0,
    volume: 0.95,
    openaiVoice: "alloy",
    speed: 1.0,
  },
};

export function getVoiceConfig(personaId: string): VoiceConfig {
  return (
    PERSONA_VOICE_MAP[personaId] || {
      preferredGender: "female" as const,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.9,
      openaiVoice: "alloy",
      speed: 1.0,
    }
  );
}

export function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  config: VoiceConfig
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const englishVoices = voices.filter(
    (v) => v.lang.startsWith("en") && !v.name.includes("Google")
  );
  const googleVoices = voices.filter(
    (v) => v.lang.startsWith("en") && v.name.includes("Google")
  );

  const candidates = googleVoices.length > 0 ? googleVoices : englishVoices.length > 0 ? englishVoices : voices;

  const genderMatch = candidates.filter((v) => {
    const name = v.name.toLowerCase();
    if (config.preferredGender === "female") {
      return name.includes("female") || name.includes("woman") || name.includes("samantha") || name.includes("karen") || name.includes("victoria") || name.includes("fiona");
    }
    return name.includes("male") || name.includes("daniel") || name.includes("david") || name.includes("james") || name.includes("alex");
  });

  return genderMatch.length > 0 ? genderMatch[0] : candidates[0];
}
