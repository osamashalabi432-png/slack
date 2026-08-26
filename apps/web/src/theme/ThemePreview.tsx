import type { ChromeTheme } from "./chrome-themes";

/**
 * A miniature of the app in a theme: rail, channel list with a selected row, a
 * top bar and the message area. It shows what actually changes, which a plain
 * colour swatch does not — the message area follows the current colour mode,
 * so light and dark previews differ for the same theme.
 */
export function ThemePreview({ theme, className }: { theme: ChromeTheme; className?: string }) {
  return (
    <svg
      viewBox="0 0 72 48"
      className={className}
      role="img"
      aria-label={`${theme.name} preview`}
      data-testid={`theme-preview-${theme.id}`}
    >
      <defs>
        <clipPath id={`clip-${theme.id}`}>
          <rect x="0" y="0" width="72" height="48" rx="5" />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${theme.id})`}>
        {/* Message area, in whatever colour mode is active. */}
        <rect x="0" y="0" width="72" height="48" fill="var(--surface)" />

        {/* Icon rail. */}
        <rect x="0" y="0" width="11" height="48" fill={theme.rail} />
        <circle cx="5.5" cy="8" r="3" fill={theme.text} opacity="0.9" />
        <circle cx="5.5" cy="17" r="2" fill={theme.muted} opacity="0.65" />
        <circle cx="5.5" cy="25" r="2" fill={theme.muted} opacity="0.65" />

        {/* Channel list. */}
        <rect x="11" y="0" width="26" height="48" fill={theme.sidebar} />
        <rect x="14" y="5" width="15" height="3" rx="1.5" fill={theme.text} opacity="0.95" />
        <rect x="11" y="13" width="26" height="7" fill={theme.active} />
        <rect x="14" y="15.5" width="14" height="2.5" rx="1.25" fill={theme.text} opacity="0.95" />
        <rect x="14" y="24" width="17" height="2.5" rx="1.25" fill={theme.muted} opacity="0.8" />
        <rect x="14" y="30" width="12" height="2.5" rx="1.25" fill={theme.muted} opacity="0.8" />
        <rect x="14" y="36" width="15" height="2.5" rx="1.25" fill={theme.muted} opacity="0.8" />
        {/* Mention badge, in the theme's accent. */}
        <circle cx="33.5" cy="25.2" r="2.2" fill={theme.accent} />

        {/* Top bar with its search field. */}
        <rect x="37" y="0" width="35" height="9" fill={theme.topbar} />
        <rect x="42" y="2.5" width="25" height="4" rx="2" fill={theme.text} opacity="0.18" />

        {/* A couple of messages. */}
        <circle cx="43" cy="16" r="3" fill={theme.active} opacity="0.85" />
        <rect x="48" y="13" width="19" height="2.5" rx="1.25" fill="var(--text-muted)" opacity="0.9" />
        <rect x="48" y="17.5" width="13" height="2.5" rx="1.25" fill="var(--text-faint)" opacity="0.7" />
        <circle cx="43" cy="28" r="3" fill={theme.accent} opacity="0.8" />
        <rect x="48" y="25" width="16" height="2.5" rx="1.25" fill="var(--text-muted)" opacity="0.9" />
        <rect x="48" y="29.5" width="20" height="2.5" rx="1.25" fill="var(--text-faint)" opacity="0.7" />

        {/* Composer. */}
        <rect
          x="41"
          y="38"
          width="27"
          height="7"
          rx="2"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="1"
        />
      </g>

      <rect
        x="0.5"
        y="0.5"
        width="71"
        height="47"
        rx="4.5"
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1"
      />
    </svg>
  );
}
