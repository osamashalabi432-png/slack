import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "../test-utils";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(() => "abc123eventid"),
}));

import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom secret internals");
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ErrorBoundary", () => {
  test("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeDefined();
  });

  test("shows a calm message and a support reference, without a raw stack trace", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Back to home" })).toBeDefined();
    expect(screen.getByText("abc123eventid")).toBeDefined();
    // The user-facing screen must never leak the error message or stack.
    expect(screen.queryByText(/kaboom secret internals/)).toBeNull();

    spy.mockRestore();
  });
});
