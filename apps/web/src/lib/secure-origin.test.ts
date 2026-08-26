import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const envValue: { VITE_WEB_URL?: string } = {};
vi.mock("../env", () => ({ env: envValue }));

const { redirectToSecureOrigin } = await import("./secure-origin");

const replace = vi.fn();

/** Stands in for the browser's view of where the page is and how it got there. */
function at(href: string, secure: boolean) {
  const url = new URL(href);
  vi.stubGlobal("window", {
    isSecureContext: secure,
    location: {
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      replace,
    },
  });
}

beforeEach(() => {
  replace.mockClear();
  envValue.VITE_WEB_URL = "https://my-machine.tailnet-name.ts.net";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("redirectToSecureOrigin", () => {
  test("sends a plain-HTTP visitor to the address that can sign them in", () => {
    at("http://100.100.100.100:3000/handler/sign-in?next=%2Fw%2Fteam", false);
    expect(redirectToSecureOrigin()).toBe(true);
    // The page they asked for survives the move.
    expect(replace).toHaveBeenCalledWith(
      "https://my-machine.tailnet-name.ts.net/handler/sign-in?next=%2Fw%2Fteam",
    );
  });

  test("leaves localhost alone — it is already a secure context", () => {
    at("http://localhost:3000/handler/sign-in", true);
    expect(redirectToSecureOrigin()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  test("does not bounce a page already on the secure address", () => {
    at("https://my-machine.tailnet-name.ts.net/handler/sign-in", true);
    expect(redirectToSecureOrigin()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  test("stays put when there is no HTTPS address to go to", () => {
    envValue.VITE_WEB_URL = "http://100.100.100.100:3000";
    at("http://100.100.100.100:3000/", false);
    expect(redirectToSecureOrigin()).toBe(false);

    envValue.VITE_WEB_URL = undefined;
    expect(redirectToSecureOrigin()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
