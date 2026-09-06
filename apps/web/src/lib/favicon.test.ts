import { describe, test, expect } from "vitest";
import { faviconUrl } from "./favicon";

describe("faviconUrl", () => {
  test("builds a Google s2 URL for the host", () => {
    expect(faviconUrl("https://youtube.com/watch?v=x")).toBe(
      "https://www.google.com/s2/favicons?domain=youtube.com&sz=32",
    );
  });

  test("honours a custom size", () => {
    expect(faviconUrl("https://fortinet.com", 16)).toContain("&sz=16");
  });

  test("encodes the hostname", () => {
    expect(faviconUrl("https://xn--80ak6aa92e.com")).toContain("domain=xn--80ak6aa92e.com");
  });

  test("returns empty for an unparseable URL", () => {
    expect(faviconUrl("not a url")).toBe("");
    expect(faviconUrl("")).toBe("");
  });
});
