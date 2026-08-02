import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getThemePreference,
  initializeTheme,
  resolveTheme,
  setThemePreference,
} from "../src/services/theme-service";

const originalMatchMedia = window.matchMedia;

function mockSystemTheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
  } satisfies MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => media),
  });
  return { media, notify: () => listeners.forEach((listener) => listener()) };
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = "system";
  document.documentElement.style.colorScheme = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("theme preference", () => {
  it("defaults invalid or missing preferences to system", () => {
    expect(getThemePreference()).toBe("system");
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(getThemePreference()).toBe("system");
  });

  it("persists and applies explicit themes", () => {
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.append(themeColor);
    setThemePreference("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#171a18",
    );
    themeColor.remove();
  });

  it("resolves and tracks system theme changes", () => {
    const system = mockSystemTheme(true);
    expect(resolveTheme("system")).toBe("dark");
    const dispose = initializeTheme();
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    system.media.matches = false;
    system.notify();
    expect(document.documentElement.style.colorScheme).toBe("light");
    dispose();
    expect(system.media.removeEventListener).toHaveBeenCalledOnce();
  });

  it("applies a light system fallback without matchMedia", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    applyTheme("system");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
