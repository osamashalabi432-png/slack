/**
 * A small favicon for a URL, via Google's public s2 service. Returns "" when the
 * URL can't be parsed (caller should fall back to a generic glyph).
 */
export function faviconUrl(url: string, size = 32): string {
  try {
    const { hostname } = new URL(url);
    if (!hostname) return "";
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
  } catch {
    return "";
  }
}
