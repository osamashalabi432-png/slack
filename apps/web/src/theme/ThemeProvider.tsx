import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getWebCssVariables } from "@openslaq/shared";
import {
  DEFAULT_CHROME_THEME_ID,
  chromeThemeVariables,
  getChromeTheme,
} from "./chrome-themes";

/** What the message area looks like. `system` follows the OS setting live. */
export type ThemeMode = "light" | "dark" | "system";
/** The mode actually in force once `system` has been resolved. */
export type ResolvedMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedMode;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
  /** Sidebar theme id — the chrome around the message area. */
  themeId: string;
  setThemeId: (id: string) => void;
}

const STORAGE_KEY = "openslaq-theme";
const CHROME_STORAGE_KEY = "openslaq-chrome-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemMode(): ResolvedMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): ResolvedMode {
  return mode === "system" ? systemMode() : mode;
}

function apply(mode: ThemeMode, themeId: string) {
  const resolved = resolve(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  const variables = getWebCssVariables(resolved);
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
  // The chrome theme goes on last so it wins over the mode's own defaults.
  for (const [name, value] of Object.entries(chromeThemeVariables(getChromeTheme(themeId)))) {
    document.documentElement.style.setProperty(name, value);
  }
}

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // No valid stored value — settle on the system preference and remember it.
  const mode = systemMode();
  localStorage.setItem(STORAGE_KEY, mode);
  return mode;
}

function readStoredTheme(): string {
  return localStorage.getItem(CHROME_STORAGE_KEY) ?? DEFAULT_CHROME_THEME_ID;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(readStoredTheme);
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const m = readStoredMode();
    apply(m, readStoredTheme());
    return m;
  });
  const [resolved, setResolved] = useState<ResolvedMode>(() => resolve(mode));

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setResolved(resolve(next));
      localStorage.setItem(STORAGE_KEY, next);
      apply(next, themeId);
    },
    [themeId],
  );

  const setThemeId = useCallback(
    (next: string) => {
      setThemeIdState(next);
      localStorage.setItem(CHROME_STORAGE_KEY, next);
      apply(mode, next);
    },
    [mode],
  );

  const cycle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = resolve(prev) === "light" ? "dark" : "light";
      setResolved(next);
      localStorage.setItem(STORAGE_KEY, next);
      apply(next, readStoredTheme());
      return next;
    });
  }, []);

  // Following the OS means reacting to it changing while the app is open.
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setResolved(systemMode());
      apply("system", themeId);
    };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [mode, themeId]);

  const value = useMemo(
    () => ({ mode, resolved, setMode, cycle, themeId, setThemeId }),
    [mode, resolved, setMode, cycle, themeId, setThemeId],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
