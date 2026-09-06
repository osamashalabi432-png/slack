#!/usr/bin/env node
/**
 * Put HTTPS in front of the stack, using the certificate Tailscale issues for
 * this machine's tailnet name.
 *
 *   node scripts/tailscale-serve.mjs            # set it up
 *   node scripts/tailscale-serve.mjs --status   # show what is served
 *   node scripts/tailscale-serve.mjs --off      # take it all down
 *
 * Why bother: browsers only expose Web Crypto on a secure origin, and signing
 * in needs it. Over plain HTTP that works on localhost and nowhere else, so
 * everyone but the host machine hits "Cannot read properties of undefined
 * (reading 'digest')" on the sign-in page.
 *
 * Media is untouched — LiveKit's audio and video are direct UDP, and only the
 * signalling websocket goes through here.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const CANDIDATES = [
  "C:/Program Files/Tailscale/tailscale.exe",
  "/usr/bin/tailscale",
  "/usr/local/bin/tailscale",
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
];

const cli = CANDIDATES.find((p) => existsSync(p)) ?? "tailscale";

function run(args, { quiet = false } = {}) {
  return execFileSync(cli, args, { encoding: "utf8", stdio: quiet ? "pipe" : ["pipe", "pipe", "inherit"] });
}

const status = JSON.parse(run(["status", "--json"], { quiet: true }));
const name = status.Self.DNSName.replace(/\.$/, "");

if (process.argv.includes("--status")) {
  console.log(run(["serve", "status"], { quiet: true }) || "nothing served");
  process.exit(0);
}

if (process.argv.includes("--off")) {
  run(["serve", "reset"]);
  console.log(`Stopped serving ${name}. Re-run without --off to bring it back.`);
  console.log("Point the stack back at plain HTTP: node scripts/set-host.mjs --detect");
  process.exit(0);
}

// HTTPS certificates are a tailnet-wide setting, and nothing here works
// without them.
if (!status.CertDomains || status.CertDomains.length === 0) {
  console.error("This tailnet has no HTTPS certificates enabled.");
  console.error("Turn them on at https://login.tailscale.com/admin/dns (HTTPS Certificates), then re-run.");
  process.exit(1);
}

const prefix = "30";
// The web dev server moves when its usual port is taken, so it can be named:
//   OPENSLAQ_WEB_PORT=3005 node scripts/tailscale-serve.mjs
const webPort = process.env.OPENSLAQ_WEB_PORT ?? `${prefix}00`;
const routes = [
  ["443", webPort, "web app"],
  [`${prefix}01`, `${prefix}01`, "API and Socket.IO"],
  [`${prefix}03`, `${prefix}03`, "file storage"],
  [`${prefix}04`, `${prefix}04`, "LiveKit signalling"],
];

for (const [external, internal, what] of routes) {
  run(["serve", "--bg", `--https=${external}`, `http://127.0.0.1:${internal}`]);
  console.log(`  https://${name}${external === "443" ? "" : `:${external}`}  →  ${what}`);
}

console.log("");
console.log("Now point the stack at it:");
console.log(`  node scripts/set-host.mjs --https ${name}`);
console.log("");
console.log(`Then add https://${name} as a trusted domain in the Stack Auth dashboard,`);
console.log("restart LiveKit, the API and the web dev server, and sign in from anywhere.");
