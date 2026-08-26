import { env } from "../env";

/**
 * Browsers hand out Web Crypto only on a secure origin — HTTPS, or localhost —
 * and signing in needs it. Reached by bare address over plain HTTP, the app
 * would load and then die on the sign-in page with "Cannot read properties of
 * undefined (reading 'digest')", which says nothing about the real cause.
 *
 * So send those visitors to the address that works, keeping whatever page they
 * asked for.
 */
export function redirectToSecureOrigin(): boolean {
  if (window.isSecureContext) return false;

  const target = env.VITE_WEB_URL;
  if (!target?.startsWith("https://")) return false;
  if (window.location.origin === target) return false;

  window.location.replace(target + window.location.pathname + window.location.search + window.location.hash);
  return true;
}
