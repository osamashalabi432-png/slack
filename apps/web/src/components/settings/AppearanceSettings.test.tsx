import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { AppearanceSettings } from "./AppearanceSettings";
import { CHROME_THEMES, getChromeTheme } from "../../theme/chrome-themes";

function renderSettings() {
  return render(
    <ThemeProvider>
      <AppearanceSettings />
    </ThemeProvider>,
  );
}

describe("AppearanceSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = "";
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      configurable: true,
    });
  });

  afterEach(cleanup);

  test("offers light, dark and following the computer", () => {
    renderSettings();
    for (const mode of ["light", "dark", "system"]) {
      expect(screen.getByTestId(`color-mode-${mode}`)).toBeTruthy();
    }
  });

  test("every theme in the catalogue is selectable", () => {
    renderSettings();
    for (const theme of CHROME_THEMES) {
      expect(screen.getByTestId(`chrome-theme-${theme.id}`)).toBeTruthy();
    }
  });

  test("picking a theme repaints the chrome and remembers the choice", () => {
    renderSettings();

    fireEvent.click(screen.getByTestId("chrome-theme-jade"));

    const jade = getChromeTheme("jade");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--sidebar-bg")).toBe(jade.sidebar);
    expect(style.getPropertyValue("--rail-bg")).toBe(jade.rail);
    expect(style.getPropertyValue("--sidebar-active")).toBe(jade.active);
    expect(localStorage.getItem("openslaq-chrome-theme")).toBe("jade");
    expect(screen.getByTestId("chrome-theme-jade").getAttribute("aria-pressed")).toBe("true");
  });

  test("the theme survives a change of colour mode", () => {
    renderSettings();
    fireEvent.click(screen.getByTestId("chrome-theme-lagoon"));
    fireEvent.click(screen.getByTestId("color-mode-dark"));

    const lagoon = getChromeTheme("lagoon");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--sidebar-bg")).toBe(lagoon.sidebar);
  });

  test("system mode follows the computer rather than a fixed choice", () => {
    renderSettings();
    fireEvent.click(screen.getByTestId("color-mode-system"));

    expect(localStorage.getItem("openslaq-theme")).toBe("system");
    // matchMedia is stubbed to light, so the dark class must be off.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
