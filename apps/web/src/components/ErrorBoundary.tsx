import * as Sentry from "@sentry/react";
import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  eventId: string | null;
}

/**
 * App-wide crash screen. Shown to end users, so it deliberately keeps things
 * calm and minimal: a short message, a way forward, and a support reference —
 * never a raw stack trace. Full technical detail is surfaced only in dev.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, eventId: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = Sentry.captureException(error);
    this.setState({ eventId });
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    const { error, eventId } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={styles.wrap} role="alert" aria-live="assertive">
        <div style={styles.card}>
          <svg
            style={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <h1 style={styles.heading}>Something went wrong</h1>
          <p style={styles.body}>
            The page ran into an unexpected problem. Reloading usually fixes it. If it keeps
            happening, please contact support.
          </p>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Back to home
            </button>
          </div>

          {eventId && (
            <p style={styles.reference}>
              Reference <code style={styles.code}>{eventId}</code>
            </p>
          )}

          {import.meta.env.DEV && (
            <details style={styles.details}>
              <summary style={styles.summary}>Developer details</summary>
              <pre style={styles.pre}>
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0c",
    color: "#e4e4e7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: "2rem",
  },
  card: {
    maxWidth: 380,
    width: "100%",
    textAlign: "center",
  },
  icon: {
    width: 30,
    height: 30,
    color: "#8b8b93",
    marginBottom: "1rem",
  },
  heading: {
    fontSize: "1.375rem",
    fontWeight: 600,
    margin: "0 0 0.5rem",
  },
  body: {
    color: "#9ca3af",
    fontSize: "0.9rem",
    lineHeight: 1.6,
    margin: "0 0 1.5rem",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryBtn: {
    backgroundColor: "#1264a3",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "0.55rem 1.15rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    color: "#a1a1aa",
    border: "1px solid #2a2a2e",
    borderRadius: 6,
    padding: "0.55rem 1.15rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  reference: {
    color: "#6b7280",
    fontSize: "0.8rem",
    margin: "1.5rem 0 0",
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    backgroundColor: "#18181b",
    borderRadius: 4,
    padding: "0.1rem 0.35rem",
    color: "#a1a1aa",
    userSelect: "all",
  },
  details: {
    textAlign: "left",
    backgroundColor: "#151517",
    borderRadius: 8,
    padding: "0.85rem 1rem",
    marginTop: "1.5rem",
    border: "1px solid #232326",
  },
  summary: {
    cursor: "pointer",
    color: "#8b8b93",
    fontSize: "0.8rem",
  },
  pre: {
    fontSize: "0.75rem",
    color: "#f87171",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: "0.5rem 0 0",
    maxHeight: 240,
    overflow: "auto",
  },
};
