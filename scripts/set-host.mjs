#!/usr/bin/env node
/**
 * Point the stack at a given host so other machines can reach it.
 *
 *   node scripts/set-host.mjs 192.168.1.106   # serve to the LAN
 *   node scripts/set-host.mjs localhost       # back to this machine only
 *   node scripts/set-host.mjs --https my-machine.tailnet-name.ts.net
 *
 * The --https form is for a TLS front like `tailscale serve`. Browsers only
 * hand out Web Crypto on a secure origin, and signing in needs it, so plain
 * HTTP works on localhost and nowhere else.
 *
 * Rewrites the client-facing URLs in .env and the IP LiveKit puts in its ICE
 * candidates. Everything the server talks to itself about (the database, the
 * LiveKit control API, S3 signing) keeps pointing at localhost.
 *
 * Re-run it whenever DHCP hands this machine a different address.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { networkInterfaces } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const livekitPath = join(root, "livekit.yaml");

function detectLanIp() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      // Skip the virtual adapters VMware/Hyper-V/WSL add.
      if (/^(172\.(1[6-9]|2\d|3[01])|169\.254|100\.)/.test(addr.address)) continue;
      if (/^(192\.168|10\.)/.test(addr.address)) return addr.address;
    }
  }
  return null;
}

const args = process.argv.slice(2);
const https = args.includes("--https");
const arg = args.find((a) => !a.startsWith("--")) ?? (args.includes("--detect") ? "--detect" : undefined);
if (!arg) {
  const guess = detectLanIp();
  console.error("Usage: node scripts/set-host.mjs [--https] <ip|hostname|localhost>");
  if (guess) console.error(`This machine looks like ${guess}`);
  process.exit(1);
}
const host = arg === "--detect" ? detectLanIp() : arg;
if (!host) {
  console.error("Could not work out a LAN address; pass one explicitly.");
  process.exit(1);
}

// Behind TLS the web app is on 443, so it carries no port; everything else
// keeps its own port, fronted by the same certificate.
const scheme = https ? "https" : "http";
const ws = https ? "wss" : "ws";
const webOrigin = https ? `https://${host}` : null;

let env = readFileSync(envPath, "utf8");
const eol = env.includes("\r\n") ? "\r\n" : "\n";
const prefix = /^PORT_PREFIX=(\d+)/m.exec(env)?.[1] ?? "30";
const port = (n) => `${prefix}0${n}`;

/** Replace KEY=..., or append the line when the key is missing. */
function setKey(key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    env = env.replace(/\s*$/, "") + eol + line + eol;
  }
}

// Origins the browser and the packaged desktop app send. The LAN address stays
// allowed even when serving over something else, so a browser on the same
// network keeps working.
const lanIp = detectLanIp();
setKey(
  "CORS_ORIGIN",
  [
    `http://localhost:${port(0)}`,
    "http://tauri.localhost",
    "https://tauri.localhost",
    `http://localhost:${port(7)}`,
    // The packaged desktop app serves its frontend from tauri-plugin-localhost,
    // so its Origin is this port — see LOCALHOST_PORT in desktop/src-tauri/src/main.rs.
    "http://localhost:3334",
    "http://127.0.0.1:3334",
    webOrigin ?? `http://${host}:${port(0)}`,
    ...(lanIp && lanIp !== host ? [`http://${lanIp}:${port(0)}`] : []),
  ].join(","),
);

// Handed to clients, so they must resolve from another machine.
const webUrl = webOrigin ?? `http://${host}:${port(0)}`;
setKey("VITE_API_URL", `${scheme}://${host}:${port(1)}`);
setKey("OPENSLAQ_WEB_URL", webUrl);
// The desktop app serves itself from localhost, so it is told where the web
// app actually lives rather than reading its own origin.
setKey("VITE_WEB_URL", webUrl);
setKey("VITE_LIVEKIT_WS_URL", `${ws}://${host}:${port(4)}`);
setKey("LIVEKIT_PUBLIC_WS_URL", `${ws}://${host}:${port(4)}`);
setKey("S3_PUBLIC_ENDPOINT", `${scheme}://${host}:${port(3)}`);
setKey("EXPO_PUBLIC_API_URL", `${scheme}://${host}:${port(1)}`);
setKey("EXPO_PUBLIC_WEB_URL", webUrl);
// Vite refuses requests carrying a Host header it does not know.
setKey("VITE_ALLOWED_HOSTS", host);
// Behind TLS the proxy is the only thing that should reach the API, and on
// Windows a wildcard bind would collide with the proxy holding this port on
// the tailnet address anyway.
setKey("API_HOST", https ? "127.0.0.1" : "0.0.0.0");

writeFileSync(envPath, env);

// LiveKit stamps this address into every ICE candidate. Point it at the
// container's own loopback only when we are not serving anyone else.
// LiveKit stamps a literal address, and its media is direct UDP that no TLS
// front proxies — so a hostname has to be resolved to the address peers use.
const nodeIp =
  host === "localhost"
    ? "127.0.0.1"
    : /^[d.]+$/.test(host)
      ? host
      : (await lookup(host, { family: 4 })).address;
const livekit = readFileSync(livekitPath, "utf8").replace(
  /^(\s*node_ip:\s*).*$/m,
  (_m, indent) => `${indent}${nodeIp}`,
);
writeFileSync(livekitPath, livekit);

console.log(`Host set to ${host}`);
console.log(`  web       ${webUrl}`);
console.log(`  api       ${scheme}://${host}:${port(1)}`);
console.log(`  livekit   ${ws}://${host}:${port(4)}  (node_ip ${nodeIp})`);
console.log("");
if (https) {
  console.log("Put a TLS front on those ports first: node scripts/tailscale-serve.mjs");
  console.log("");
}
console.log("Restart to apply: docker compose restart livekit, then the API and the app.");
