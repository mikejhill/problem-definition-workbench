export const THEME_STORAGE_KEY = "pdw-theme";

export const themeOptions = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themeOptions)[number];

export function getThemePreference(): ThemePreference {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return "system";
  }
  return themeOptions.includes(stored as ThemePreference) ? (stored as ThemePreference) : "system";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#171a18" : "#f4f1e8");
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Theme selection still applies for this page when storage is unavailable.
  }
  applyTheme(preference);
}

export function initializeTheme(): () => void {
  const preference = getThemePreference();
  applyTheme(preference);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const update = () => {
    if (getThemePreference() === "system") applyTheme("system");
  };
  media?.addEventListener("change", update);
  return () => media?.removeEventListener("change", update);
}
