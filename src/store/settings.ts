import { getCurrentWindow } from "@tauri-apps/api/window";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePref = "system" | "light" | "dark";

export const SIDEBAR_DEFAULT = 216;

interface SettingsState {
  theme: ThemePref;
  autosaveDelayMs: number;
  sidebarWidth: number;
  setTheme: (theme: ThemePref) => void;
  setAutosaveDelay: (ms: number) => void;
  setSidebarWidth: (px: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      autosaveDelayMs: 750,
      sidebarWidth: SIDEBAR_DEFAULT,
      setTheme: (theme) => set({ theme }),
      setAutosaveDelay: (autosaveDelayMs) => set({ autosaveDelayMs }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
    }),
    { name: "kladd.settings" },
  ),
);

/** data-theme drives the tokens (color-scheme override); the window theme
 * keeps native chrome (title bar, menus) in step. */
export function applyTheme(theme: ThemePref) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  getCurrentWindow()
    .setTheme(theme === "system" ? null : theme)
    .catch(() => {});
}
