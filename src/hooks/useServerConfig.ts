import { useCallback, useEffect, useState } from "react";

/**
 * Shared state machinery for Settings panels backed by a server endpoint.
 *
 * Both the voice config and character names panels follow the same pattern:
 *   1. Load once from GET endpoint, extracting a nested field from the
 *      response envelope (e.g. `data.custom`, `data.names`).
 *   2. Keep an in-progress `edits` draft separate from the last-saved value.
 *   3. On save, wrap the cleaned value in a body envelope expected by the
 *      PUT endpoint, and flash a "Saved" state for 2s.
 *
 * This hook collapses that boilerplate. The `extract` and `wrap` callbacks
 * bridge the endpoint-specific envelope shape so panels can stay focused on
 * their field-level UI.
 */
export interface UseServerConfigOptions<T> {
  getUrl: string;
  putUrl: string;
  extract: (response: unknown) => T;
  wrap: (value: T) => unknown;
  onError?: (message: string) => void;
}

export interface UseServerConfigResult<T> {
  value: T | null;
  edits: T | null;
  setEdits: (next: T) => void;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  /** Attempts to save; returns true on success, false on failure. */
  save: () => Promise<boolean>;
}

export function useServerConfig<T>(options: UseServerConfigOptions<T>): UseServerConfigResult<T> {
  const { getUrl, putUrl, extract, wrap, onError } = options;

  const [value, setValue] = useState<T | null>(null);
  const [edits, setEditsState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(getUrl)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const extracted = extract(data);
        setValue(extracted);
        setEditsState(extracted);
      })
      .catch(() => onError?.("Failed to load config"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUrl]);

  const setEdits = useCallback((next: T) => {
    setEditsState(next);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (edits === null) return false;
    setSaving(true);
    try {
      const res = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wrap(edits)),
      });
      if (!res.ok) throw new Error("Save failed");
      setValue(edits);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } catch {
      onError?.("Failed to save config");
      return false;
    } finally {
      setSaving(false);
    }
  }, [putUrl, edits, wrap, onError]);

  const dirty = value !== null && edits !== null && JSON.stringify(edits) !== JSON.stringify(value);

  return { value, edits, setEdits, loading, saving, saved, dirty, save };
}
