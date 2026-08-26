import clsx from "clsx";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, type ThemeMode } from "../../theme/ThemeProvider";
import { CHROME_THEMES, CHROME_THEME_GROUPS, type ChromeTheme } from "../../theme/chrome-themes";
import { ThemePreview } from "../../theme/ThemePreview";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Laptop },
];

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ChromeTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`chrome-theme-${theme.id}`}
      aria-pressed={selected}
      className={clsx(
        "group flex flex-col gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all",
        selected
          ? "border-slaq-blue bg-surface-selected ring-2 ring-slaq-blue/40"
          : "border-border-default bg-surface hover:bg-surface-hover hover:border-border-strong",
      )}
    >
      <span className="relative block">
        <ThemePreview theme={theme} className="w-full h-auto rounded-md block" />
        {selected && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slaq-blue flex items-center justify-center shadow">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
      </span>
      <span className="text-[13px] text-primary leading-tight px-0.5">{theme.name}</span>
    </button>
  );
}

/**
 * Appearance, laid out the way Slack does it: the colour mode decides the
 * message area, and the theme below it repaints the chrome around it.
 */
export function AppearanceSettings() {
  const { mode, setMode, themeId, setThemeId } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-primary">Color Mode</h3>
        <p className="text-sm text-secondary">
          Choose if OpenSlaq&apos;s appearance should be light or dark, or follow your computer&apos;s
          settings.
        </p>
        <div className="flex gap-2 mt-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              data-testid={`color-mode-${id}`}
              aria-pressed={mode === id}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors",
                mode === id
                  ? "bg-surface-selected text-primary border-slaq-blue"
                  : "bg-surface text-secondary border-border-default hover:bg-surface-hover",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary">Themes</h3>
        {CHROME_THEME_GROUPS.map((group) => {
          const themes = CHROME_THEMES.filter((t) => t.group === group);
          if (themes.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{group}</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    selected={theme.id === themeId}
                    onSelect={() => setThemeId(theme.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
