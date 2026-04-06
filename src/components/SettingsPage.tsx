import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Timer,
  Bell,
  Monitor,
  Database,
  Info,
  RotateCcw,
  Trash2,
  Download,
  ChevronDown,
  Volume2,
  Save,
  Check,
  Play,
  Loader2,
  Tag,
  Brain,
  ChevronRight,
  Upload,
  FileText,
  X,
} from "lucide-react";
import {
  AppSettings,
  loadSettings,
  saveSettings,
  resetSettings,
} from "../data/appSettings";
import { getSessionHistory, clearHistory } from "../data/sessionHistory";
import { PERSONA_LIBRARY, PERSONA_PACKS, Persona } from "../data/personas";
import { ELEVENLABS_DEFAULT_VOICES } from "../data/voiceConfig";
import { useServerConfig } from "../hooks/useServerConfig";
import { MiiAvatar } from "./MiiAvatar";

// ============================================================
// Settings Page
// ============================================================

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);

  // Load available mic devices
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setMicDevices(devices.filter((d) => d.kind === "audioinput"));
    }).catch(() => {});
  }, []);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleReset = () => {
    const defaults = resetSettings();
    setSettings(defaults);
    setShowResetConfirm(false);
    showToast("Settings reset to defaults");
  };

  const handleClearData = () => {
    clearHistory();
    setShowClearDataConfirm(false);
    showToast("Session history cleared");
  };

  const handleExportData = () => {
    const sessions = getSessionHistory();
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `concilium-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Session data exported");
  };

  const sessionCount = getSessionHistory().length;

  return (
    <div className="px-4 py-section-sm md:py-section space-y-section-sm md:space-y-section max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-heading font-semibold text-white">Settings</h1>
        <p className="text-body text-white/50 mt-1">
          Configure your practice experience
        </p>
      </div>

      {/* Audio Settings */}
      <SettingsPanel
        icon={<Mic className="w-4 h-4" />}
        title="Audio"
        description="Microphone and text-to-speech preferences"
      >
        <SelectRow
          label="Microphone"
          value={settings.preferredMic}
          onChange={(v) => update("preferredMic", v)}
          options={[
            { value: "default", label: "System Default" },
            ...micDevices
              .filter((d) => d.deviceId !== "default")
              .map((d) => ({
                value: d.deviceId,
                label: d.label || `Mic ${d.deviceId.slice(0, 8)}`,
              })),
          ]}
        />
        <SelectRow
          label="TTS Provider"
          value={settings.ttsProvider}
          onChange={(v) => update("ttsProvider", v as AppSettings["ttsProvider"])}
          options={[
            { value: "elevenlabs", label: "ElevenLabs (Premium)" },
            { value: "openai", label: "OpenAI" },
            { value: "browser", label: "Browser (Free)" },
          ]}
        />
        <SliderRow
          label="TTS Speed"
          value={settings.ttsSpeed}
          min={0.5}
          max={2.0}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => update("ttsSpeed", v)}
        />
        <ToggleRow
          label="Auto-play persona speech"
          value={settings.autoPlayTTS}
          onChange={(v) => update("autoPlayTTS", v)}
        />
        <SliderRow
          label="Mic Sensitivity"
          value={settings.micSensitivity}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update("micSensitivity", v)}
        />
      </SettingsPanel>

      {/* Practice Settings */}
      <SettingsPanel
        icon={<Timer className="w-4 h-4" />}
        title="Practice"
        description="Session defaults and behavior"
      >
        <SelectRow
          label="Default Duration"
          value={String(settings.defaultSessionDuration)}
          onChange={(v) => update("defaultSessionDuration", Number(v))}
          options={[
            { value: "2", label: "2 minutes" },
            { value: "5", label: "5 minutes" },
            { value: "10", label: "10 minutes" },
            { value: "15", label: "15 minutes" },
            { value: "30", label: "30 minutes" },
          ]}
        />
        <SelectRow
          label="Default Audience Size"
          value={String(settings.defaultPersonaCount)}
          onChange={(v) => update("defaultPersonaCount", Number(v))}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({
            value: String(n),
            label: `${n} persona${n > 1 ? "s" : ""}`,
          }))}
        />
        <ToggleRow
          label="Auto-start recording"
          value={settings.autoStartRecording}
          onChange={(v) => update("autoStartRecording", v)}
        />
        <ToggleRow
          label="Show teleprompter by default"
          value={settings.showTeleprompter}
          onChange={(v) => update("showTeleprompter", v)}
        />
      </SettingsPanel>

      {/* Notifications */}
      <SettingsPanel
        icon={<Bell className="w-4 h-4" />}
        title="Notifications"
        description="Reminders and alerts"
      >
        <ToggleRow
          label="Practice reminders"
          description="Get nudged to practice regularly"
          value={settings.practiceReminders}
          onChange={(v) => update("practiceReminders", v)}
        />
        <ToggleRow
          label="Streak reminders"
          description="Don't lose your practice streak"
          value={settings.streakReminders}
          onChange={(v) => update("streakReminders", v)}
        />
      </SettingsPanel>

      {/* Display */}
      <SettingsPanel
        icon={<Monitor className="w-4 h-4" />}
        title="Display"
        description="Theme and visual preferences"
      >
        <SelectRow
          label="Theme"
          value={settings.theme}
          onChange={() => {}}
          options={[{ value: "dark", label: "Dark (default)" }]}
          disabled
        />
        <ToggleRow
          label="Compact mode"
          description="Reduce spacing and card sizes"
          value={settings.compactMode}
          onChange={(v) => update("compactMode", v)}
        />
        <ToggleRow
          label="Animations"
          description="Show motion and transitions"
          value={settings.showAnimations}
          onChange={(v) => update("showAnimations", v)}
        />
      </SettingsPanel>

      {/* Data Management */}
      <SettingsPanel
        icon={<Database className="w-4 h-4" />}
        title="Data"
        description="Export or clear your practice data"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-white/80">Session History</p>
              <p className="text-label text-white/40">
                {sessionCount} session{sessionCount !== 1 ? "s" : ""} recorded
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={sessionCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay text-label text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
          <div className="h-px bg-white/5" />
          {showClearDataConfirm ? (
            <div className="flex items-center justify-between">
              <p className="text-body text-red-400">
                Delete all session data? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearDataConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-raised text-label text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearData}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-label transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearDataConfirm(true)}
              disabled={sessionCount === 0}
              className="flex items-center gap-1.5 text-label text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear session history
            </button>
          )}
        </div>
      </SettingsPanel>

      {/* Admin Voice Config */}
      <VoiceConfigPanel showToast={showToast} />

      {/* Character Studio — brain editor */}
      <CharacterStudioPanel showToast={showToast} />

      {/* Character Names */}
      <CharacterNamesPanel showToast={showToast} />

      {/* About */}
      <SettingsPanel
        icon={<Info className="w-4 h-4" />}
        title="About"
        description="App information"
      >
        <div className="space-y-2 text-body">
          <InfoRow label="App" value="Concilium" />
          <InfoRow label="Version" value="0.1.0" />
          <InfoRow label="Platform" value="Web (React + Vite)" />
        </div>
      </SettingsPanel>

      {/* Reset */}
      <div className="pb-8">
        {showResetConfirm ? (
          <div className="flex items-center gap-3 justify-center">
            <p className="text-body text-white/60">Reset all settings?</p>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-surface-raised text-label text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-label transition-colors"
            >
              Reset
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 mx-auto text-label text-white/40 hover:text-white/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset all settings to defaults
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] md:bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface-overlay border border-white/10 text-body text-white/80 shadow-lg z-50"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// Panel wrapper
// ============================================================

function SettingsPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/5 bg-surface-raised p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="text-violet-400">{icon}</div>
        <div>
          <h2 className="text-subtitle font-medium text-white">{title}</h2>
          <p className="text-label text-white/40">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );
}

// ============================================================
// Row primitives
// ============================================================

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-body text-white/80">{label}</p>
        {description && (
          <p className="text-label text-white/40">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${
          value ? "bg-violet-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-body text-white/80">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none bg-surface-overlay border border-white/5 rounded-lg px-3 py-1.5 pr-7 text-label text-white/70 focus:outline-none focus:border-violet-500/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-body text-white/80">{label}</p>
        <span className="text-label text-violet-400 font-medium tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}

// ============================================================
// Voice Configuration Panel
// ============================================================

const PACK_LABELS: Record<string, string> = {
  general: "General Audience",
  "legal-bench": "The Bench",
  "business-tank": "The Tank",
};

function CharacterNamesPanel({ showToast }: { showToast: (msg: string) => void }) {
  const { edits, setEdits, loading, saving, saved, dirty, save } = useServerConfig<Record<string, string>>({
    getUrl: "/api/admin/character-config",
    putUrl: "/api/admin/character-config",
    extract: (data) => (data as { names?: Record<string, string> }).names || {},
    wrap: (names) => ({ names }),
    onError: (msg) => showToast(msg),
  });

  const handleSave = async () => {
    if (await save()) showToast("Character names saved");
  };

  const updateName = (personaId: string, name: string) => {
    if (!edits) return;
    const next = { ...edits };
    if (name.trim()) next[personaId] = name;
    else delete next[personaId];
    setEdits(next);
  };

  const hasChanges = dirty;

  const grouped = PERSONA_PACKS.map((pack) => ({
    pack,
    personas: PERSONA_LIBRARY.filter((p) => p.pack === pack.id),
  }));

  return (
    <SettingsPanel
      icon={<Tag className="w-4 h-4" />}
      title="Character Names"
      description="Customize display names for each character"
    >
      {loading ? (
        <p className="text-label text-white/40">Loading...</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ pack, personas }) => (
            <div key={pack.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{pack.icon}</span>
                <h3 className="text-label font-medium text-white/60 uppercase tracking-wider">
                  {PACK_LABELS[pack.id] || pack.name}
                </h3>
              </div>
              <div className="space-y-1.5">
                {personas.map((persona) => (
                  <div key={persona.id} className="flex items-center gap-3 py-1.5">
                    <div className="flex-shrink-0 w-8 h-8">
                      <MiiAvatar persona={persona} size={32} />
                    </div>
                    <div className="flex-shrink-0 w-36 min-w-0">
                      <p className="text-body text-white/50 truncate leading-tight text-xs">
                        {persona.name}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={edits?.[persona.id] || ""}
                      onChange={(e) => updateName(persona.id, e.target.value)}
                      placeholder={persona.name}
                      className="flex-1 min-w-0 bg-surface-overlay border border-white/5 rounded-lg px-2.5 py-1.5 text-label text-white/70 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="sticky bottom-0 bg-surface-raised flex justify-end pt-2 pb-1">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-label font-medium transition-colors ${
                saved
                  ? "bg-green-500/20 text-green-400"
                  : hasChanges
                    ? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              {saved ? (
                <><Check className="w-3.5 h-3.5" />Saved</>
              ) : (
                <><Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save Names"}</>
              )}
            </button>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}

function VoiceConfigPanel({ showToast }: { showToast: (msg: string) => void }) {
  const { edits, setEdits, loading, saving, saved, dirty, save } = useServerConfig<Record<string, string>>({
    getUrl: "/api/admin/voice-config",
    putUrl: "/api/admin/voice-config",
    extract: (data) => (data as { custom?: Record<string, string> }).custom || {},
    wrap: (config) => {
      // Strip empty values before sending — the server also cleans but we
      // want the local "dirty" check to match what lives server-side.
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(config)) {
        if (value.trim()) cleaned[key] = value.trim();
      }
      return { config: cleaned };
    },
    onError: (msg) => showToast(msg),
  });

  const handleSave = async () => {
    if (await save()) showToast("Voice configuration saved");
  };

  const updateVoiceId = (personaId: string, voiceId: string) => {
    if (!edits) return;
    const next = { ...edits };
    if (voiceId.trim()) next[personaId] = voiceId;
    else delete next[personaId];
    setEdits(next);
  };

  const hasChanges = dirty;

  // Group personas by pack
  const grouped = PERSONA_PACKS.map((pack) => ({
    pack,
    personas: PERSONA_LIBRARY.filter((p) => p.pack === pack.id),
  }));

  return (
    <SettingsPanel
      icon={<Volume2 className="w-4 h-4" />}
      title="Voice Configuration"
      description="Map ElevenLabs voice IDs to characters"
    >
      {loading ? (
        <p className="text-label text-white/40">Loading voice config...</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ pack, personas }) => (
            <div key={pack.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{pack.icon}</span>
                <h3 className="text-label font-medium text-white/60 uppercase tracking-wider">
                  {PACK_LABELS[pack.id] || pack.name}
                </h3>
                <span className="text-label text-white/30">
                  {personas.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {personas.map((persona) => (
                  <VoiceConfigRow
                    key={persona.id}
                    persona={persona}
                    defaultVoiceId={ELEVENLABS_DEFAULT_VOICES[persona.id]}
                    customVoiceId={edits?.[persona.id] || ""}
                    onChange={(v) => updateVoiceId(persona.id, v)}
                    showToast={showToast}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Save button */}
          <div className="sticky bottom-0 bg-surface-raised flex justify-end pt-2 pb-1">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-label font-medium transition-colors ${
                saved
                  ? "bg-green-500/20 text-green-400"
                  : hasChanges
                    ? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save Voice Config"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}

function VoiceConfigRow({
  persona,
  defaultVoiceId,
  customVoiceId,
  onChange,
  showToast,
}: {
  persona: Persona;
  defaultVoiceId?: string;
  customVoiceId: string;
  onChange: (v: string) => void;
  showToast: (msg: string) => void;
}) {
  const hasCustom = !!customVoiceId.trim();
  const [testing, setTesting] = useState(false);

  const effectiveVoiceId = customVoiceId.trim() || defaultVoiceId || "";

  const handleTest = async () => {
    if (!effectiveVoiceId) {
      showToast("No voice ID to test");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/voice-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: effectiveVoiceId,
          text: `Hello, I'm ${persona.name}. This is a voice test.`,
        }),
      });

      if (!res.ok) {
        let msg = `Voice test failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.detail) msg = `ElevenLabs: ${String(data.detail).slice(0, 120)}`;
          else if (data?.error) msg = data.error;
        } catch {}
        showToast(msg);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        showToast("Audio playback failed");
      };
      await audio.play();
    } catch (err: any) {
      showToast(`Test error: ${err?.message || "unknown"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8">
        <MiiAvatar persona={persona} size={32} />
      </div>

      {/* Name + archetype */}
      <div className="flex-shrink-0 w-36 min-w-0">
        <p className="text-body text-white/80 truncate leading-tight">
          {persona.name}
        </p>
        <p className="text-[10px] text-white/35 truncate leading-tight">
          {persona.archetype}
        </p>
      </div>

      {/* Status dot */}
      <div
        className={`flex-shrink-0 w-2 h-2 rounded-full ${
          hasCustom ? "bg-green-400" : "bg-white/20"
        }`}
        title={hasCustom ? "Custom voice configured" : "Using default fallback"}
      />

      {/* Voice ID input */}
      <input
        type="text"
        value={customVoiceId}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultVoiceId || "Rachel (default)"}
        className="flex-1 min-w-0 bg-surface-overlay border border-white/5 rounded-lg px-2.5 py-1.5 text-label text-white/70 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 font-mono"
      />

      {/* Test button — plays a sample so user can verify the voice ID works */}
      <button
        type="button"
        onClick={handleTest}
        disabled={testing || !effectiveVoiceId}
        title="Preview this voice"
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-overlay border border-white/5 text-white/60 hover:text-violet-400 hover:border-violet-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {testing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ============================================================
// Character Studio — per-character brain editor
// ============================================================
//
// Each character has a brain = structured definition (priorities, pet
// peeves, disagreement style, reaction triggers, opening lines...) plus a
// freeform notes.md that gets appended to the LLM system prompt. Edits here
// write to the $CONFIG_DATA_DIR/characters/{id}/ volume on Railway, so they
// persist across redeploys without a commit.

interface KnowledgeFileMeta {
  filename: string;
  originalName: string;
  byteSize: number;
  addedAt: string;
}

interface CharacterBrain {
  id: string;
  definition: {
    id: string;
    name: string;
    age: number;
    gender: string;
    profession: string;
    politicalLeaning: string;
    bio: string;
    archetype: string;
    archetypeSource: string;
    disclaimer: string;
    priorities: string[];
    pet_peeves: string[];
    behavioral: {
      questioningStyle: string;
      interruptionPattern: string;
      reactionTriggers: { leanForward: string[]; checkOut: string[] };
      disagreementStyle: string;
      intellectualBlindSpots: string[];
      rhetoricalTendencies: string[];
      domainVocabulary: string[];
      openingPatterns: string[];
    };
    voice: { voiceId?: string; speakingPace: string; prosodyDescription: string };
  };
  notes: string;
  knowledge: KnowledgeFileMeta[];
}

function CharacterStudioPanel({ showToast }: { showToast: (msg: string) => void }) {
  const [brains, setBrains] = useState<CharacterBrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/characters")
      .then((r) => r.json())
      .then((data: { characters: CharacterBrain[] }) => setBrains(data.characters || []))
      .catch(() => showToast("Failed to load character brains"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleSave = async (id: string, updated: CharacterBrain) => {
    const res = await fetch(`/api/admin/characters/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definition: updated.definition, notes: updated.notes }),
    });
    if (!res.ok) throw new Error("Save failed");
    setBrains((prev) => prev.map((b) => (b.id === id ? updated : b)));
  };

  const handleKnowledgeChange = (id: string, knowledge: KnowledgeFileMeta[]) => {
    setBrains((prev) => prev.map((b) => (b.id === id ? { ...b, knowledge } : b)));
  };

  const grouped = PERSONA_PACKS.map((pack) => ({
    pack,
    items: PERSONA_LIBRARY.filter((p) => p.pack === pack.id)
      .map((p) => brains.find((b) => b.id === p.id))
      .filter((b): b is CharacterBrain => !!b),
  }));

  return (
    <SettingsPanel
      icon={<Brain className="w-4 h-4" />}
      title="Character Studio"
      description="Edit each character's brain — priorities, behaviors, and freeform instructions"
    >
      {loading ? (
        <p className="text-label text-white/40">Loading characters...</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ pack, items }) => (
            <div key={pack.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{pack.icon}</span>
                <h3 className="text-label font-medium text-white/60 uppercase tracking-wider">
                  {PACK_LABELS[pack.id] || pack.name}
                </h3>
              </div>
              <div className="space-y-1.5">
                {items.map((brain) => {
                  const persona = PERSONA_LIBRARY.find((p) => p.id === brain.id);
                  if (!persona) return null;
                  const isExpanded = expandedId === brain.id;
                  return (
                    <div
                      key={brain.id}
                      className="rounded-lg border border-white/5 bg-surface-overlay overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : brain.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <div className="flex-shrink-0 w-8 h-8">
                          <MiiAvatar persona={persona} size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body text-white/80 truncate leading-tight">
                            {brain.definition.name}
                          </p>
                          <p className="text-[10px] text-white/35 truncate leading-tight">
                            {brain.definition.archetype}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </button>
                      {isExpanded && (
                        <CharacterBrainEditor
                          brain={brain}
                          onSave={handleSave}
                          onKnowledgeChange={handleKnowledgeChange}
                          showToast={showToast}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsPanel>
  );
}

function CharacterBrainEditor({
  brain,
  onSave,
  onKnowledgeChange,
  showToast,
}: {
  brain: CharacterBrain;
  onSave: (id: string, updated: CharacterBrain) => Promise<void>;
  onKnowledgeChange: (id: string, knowledge: KnowledgeFileMeta[]) => void;
  showToast: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<CharacterBrain>(brain);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset draft when the upstream brain changes (e.g. after a save elsewhere)
  useEffect(() => { setDraft(brain); }, [brain]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(brain);

  const updateDef = <K extends keyof CharacterBrain["definition"]>(
    key: K,
    value: CharacterBrain["definition"][K],
  ) => {
    setDraft((d) => ({ ...d, definition: { ...d.definition, [key]: value } }));
  };

  const updateBehavioral = <K extends keyof CharacterBrain["definition"]["behavioral"]>(
    key: K,
    value: CharacterBrain["definition"]["behavioral"][K],
  ) => {
    setDraft((d) => ({
      ...d,
      definition: {
        ...d.definition,
        behavioral: { ...d.definition.behavioral, [key]: value },
      },
    }));
  };

  const updateTriggers = (key: "leanForward" | "checkOut", value: string[]) => {
    setDraft((d) => ({
      ...d,
      definition: {
        ...d.definition,
        behavioral: {
          ...d.definition.behavioral,
          reactionTriggers: { ...d.definition.behavioral.reactionTriggers, [key]: value },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(brain.id, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast(`${draft.definition.name} brain saved`);
    } catch {
      showToast("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-white/5 p-3 space-y-3">
      <BrainField label="Display name">
        <input
          type="text"
          value={draft.definition.name}
          onChange={(e) => updateDef("name", e.target.value)}
          className={brainInputClass}
        />
      </BrainField>

      <BrainField label="Archetype">
        <input
          type="text"
          value={draft.definition.archetype}
          onChange={(e) => updateDef("archetype", e.target.value)}
          className={brainInputClass}
        />
      </BrainField>

      <BrainField label="Bio">
        <textarea
          value={draft.definition.bio}
          onChange={(e) => updateDef("bio", e.target.value)}
          rows={2}
          className={brainInputClass}
        />
      </BrainField>

      <BrainField label="Priorities (one per line)">
        <ListEditor
          items={draft.definition.priorities}
          onChange={(v) => updateDef("priorities", v)}
        />
      </BrainField>

      <BrainField label="Pet peeves (one per line)">
        <ListEditor
          items={draft.definition.pet_peeves}
          onChange={(v) => updateDef("pet_peeves", v)}
        />
      </BrainField>

      <BrainField label="Lean forward when... (one per line)">
        <ListEditor
          items={draft.definition.behavioral.reactionTriggers.leanForward}
          onChange={(v) => updateTriggers("leanForward", v)}
        />
      </BrainField>

      <BrainField label="Check out when... (one per line)">
        <ListEditor
          items={draft.definition.behavioral.reactionTriggers.checkOut}
          onChange={(v) => updateTriggers("checkOut", v)}
        />
      </BrainField>

      <BrainField label="Disagreement style">
        <textarea
          value={draft.definition.behavioral.disagreementStyle}
          onChange={(e) => updateBehavioral("disagreementStyle", e.target.value)}
          rows={2}
          className={brainInputClass}
        />
      </BrainField>

      <BrainField label="Rhetorical tendencies (one per line)">
        <ListEditor
          items={draft.definition.behavioral.rhetoricalTendencies}
          onChange={(v) => updateBehavioral("rhetoricalTendencies", v)}
        />
      </BrainField>

      <BrainField label="Opening lines (one per line)">
        <ListEditor
          items={draft.definition.behavioral.openingPatterns}
          onChange={(v) => updateBehavioral("openingPatterns", v)}
        />
      </BrainField>

      <BrainField label="Freeform notes (Markdown — appended to system prompt)">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          rows={6}
          placeholder="Extra instructions, context, mood, custom rules..."
          className={`${brainInputClass} font-mono text-xs`}
        />
      </BrainField>

      <BrainField label="Knowledge files (PDF, DOCX, PPTX, TXT, MD — appended to prompt when relevant)">
        <KnowledgeManager
          characterId={brain.id}
          files={brain.knowledge}
          onChange={(next) => onKnowledgeChange(brain.id, next)}
          showToast={showToast}
        />
      </BrainField>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-label font-medium transition-colors ${
            saved
              ? "bg-green-500/20 text-green-400"
              : dirty
                ? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                : "bg-white/5 text-white/30 cursor-not-allowed"
          }`}
        >
          {saved ? (
            <><Check className="w-3.5 h-3.5" />Saved</>
          ) : (
            <><Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save Brain"}</>
          )}
        </button>
      </div>
    </div>
  );
}

const brainInputClass =
  "w-full bg-surface-raised border border-white/5 rounded-lg px-2.5 py-1.5 text-label text-white/80 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 resize-y";

function BrainField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ListEditor({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  // Edit as newline-separated text. Splitting happens on blur so the user can
  // type blank lines without them collapsing mid-keystroke.
  const [text, setText] = useState(items.join("\n"));
  useEffect(() => { setText(items.join("\n")); }, [items]);

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split("\n").map((s) => s.trim()).filter(Boolean))}
      rows={Math.max(2, Math.min(6, items.length + 1))}
      className={brainInputClass}
    />
  );
}

function KnowledgeManager({
  characterId,
  files,
  onChange,
  showToast,
}: {
  characterId: string;
  files: KnowledgeFileMeta[];
  onChange: (next: KnowledgeFileMeta[]) => void;
  showToast: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    for (const f of Array.from(fileList)) formData.append("files", f);

    setUploading(true);
    try {
      const res = await fetch(`/api/admin/characters/${characterId}/knowledge`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || "Upload failed");
        return;
      }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        showToast(`${data.errors.length} file(s) failed — ${data.errors[0].error}`);
      } else {
        showToast(`Added ${data.added?.length || 0} knowledge file(s)`);
      }
      if (Array.isArray(data.knowledge)) onChange(data.knowledge);
    } catch (err) {
      showToast(`Upload error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    try {
      const res = await fetch(
        `/api/admin/characters/${characterId}/knowledge/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || "Delete failed");
        return;
      }
      if (Array.isArray(data.knowledge)) onChange(data.knowledge);
      showToast("Knowledge file removed");
    } catch (err) {
      showToast(`Delete error: ${(err as Error).message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-2">
      {files.length === 0 ? (
        <p className="text-xs text-white/30 italic">No knowledge files uploaded yet.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.filename}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-white/5"
            >
              <FileText className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{f.originalName}</p>
                <p className="text-[10px] text-white/35">
                  {formatByteSize(f.byteSize)} · {new Date(f.addedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(f.filename)}
                disabled={deleting === f.filename}
                title="Remove"
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
              >
                {deleting === f.filename ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-label transition-colors ${
          uploading
            ? "border-white/10 text-white/30 cursor-wait"
            : "border-white/15 text-white/60 hover:border-violet-500/50 hover:text-violet-400 cursor-pointer"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" />
            Upload documents
          </>
        )}
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.txt,.md"
          disabled={uploading}
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = ""; // allow re-uploading the same file
          }}
          className="hidden"
        />
      </label>
    </div>
  );
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
