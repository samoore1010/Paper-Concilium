// ============================================================
// App Settings — persisted in localStorage
// ============================================================

export interface AppSettings {
  // Audio
  preferredMic: string; // deviceId or "default"
  ttsProvider: "elevenlabs" | "openai" | "browser";
  ttsSpeed: number; // 0.5–2.0
  autoPlayTTS: boolean;
  micSensitivity: number; // 0–100

  // Practice
  defaultSessionDuration: number; // minutes: 2, 5, 10, 15, 30
  defaultPersonaCount: number; // 1–6
  autoStartRecording: boolean;
  showTeleprompter: boolean;

  // Notifications
  practiceReminders: boolean;
  streakReminders: boolean;

  // Display
  theme: "dark"; // only dark for now
  compactMode: boolean;
  showAnimations: boolean;

  // Data
  // (no persisted data prefs — actions only)
}

const STORAGE_KEY = "concilium_app_settings";

const DEFAULT_SETTINGS: AppSettings = {
  preferredMic: "default",
  ttsProvider: "elevenlabs",
  ttsSpeed: 1.0,
  autoPlayTTS: true,
  micSensitivity: 50,

  defaultSessionDuration: 5,
  defaultPersonaCount: 3,
  autoStartRecording: true,
  showTeleprompter: true,

  practiceReminders: false,
  streakReminders: true,

  theme: "dark",
  compactMode: false,
  showAnimations: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — silently degrade
  }
}

export function resetSettings(): AppSettings {
  const defaults = { ...DEFAULT_SETTINGS };
  saveSettings(defaults);
  return defaults;
}

export { DEFAULT_SETTINGS };
