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
} from "lucide-react";
import {
  AppSettings,
  loadSettings,
  saveSettings,
  resetSettings,
} from "../data/appSettings";
import { getSessionHistory, clearHistory } from "../data/sessionHistory";

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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface-overlay border border-white/10 text-body text-white/80 shadow-lg z-50"
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
