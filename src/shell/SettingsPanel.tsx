import { type ThemePref, useSettings } from "../store/settings.ts";
import { Overlay } from "./Overlay.tsx";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DELAYS = [
  { value: 250, label: "0.25s" },
  { value: 750, label: "0.75s" },
  { value: 1500, label: "1.5s" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const delay = useSettings((s) => s.autosaveDelayMs);
  const setDelay = useSettings((s) => s.setAutosaveDelay);

  return (
    <Overlay onClose={onClose} className="settings">
      <h2>Settings</h2>
      <div className="settings-row">
        <span className="settings-label">Appearance</span>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              className={theme === t.value ? "selected" : ""}
              onClick={() => setTheme(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-row">
        <span className="settings-label">Auto-save after</span>
        <div className="segmented" role="radiogroup" aria-label="Auto-save delay">
          {DELAYS.map((d) => (
            <button
              type="button"
              key={d.value}
              role="radio"
              aria-checked={delay === d.value}
              className={delay === d.value ? "selected" : ""}
              onClick={() => setDelay(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
