# Hosting OpenSlaq on one PC

One machine runs everything; everyone else connects to it. The host is
currently the Windows box `my-machine`, serving on its Tailscale address
`100.100.100.100`.

## What runs where

| Piece | Port | Who needs to reach it |
| --- | --- | --- |
| API + Socket.IO | 3001 | every client |
| LiveKit signalling | 3004 | every client (huddles) |
| LiveKit media | 7881/tcp, 7882/udp | every client (huddles) |
| TURN fallback | 3478/udp, 30000-30002/udp | clients behind awkward NAT |
| File storage (S3 mock) | 3003 | every client (uploads) |
| Postgres | 3002 | the host only |
| Web dev server | 3000 | browser users, and anyone accepting an invite link |

The desktop app ships its own copy of the frontend, so installed clients only
need 3000 for invite links.

## Start the server

```bash
docker compose up -d postgres s3mock livekit
```

```bash
cd apps/api && bun --env-file=../../.env run --hot src/index.ts
```

To also serve the browser version, run `bun run --filter @openslaq/web dev` —
Vite binds every interface, so it answers on the LAN and tailnet addresses too.

## Open the firewall (once, as Administrator)

Windows blocks these inbound by default, on the Tailscale interface as well as
the LAN one. In an **Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "OpenSlaq TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,3001,3003,3004,7881 -Profile Private
```

```powershell
New-NetFirewallRule -DisplayName "OpenSlaq UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 7882,3478,30000-30002 -Profile Private
```

Both the Ethernet and Tailscale adapters are on the Private profile
(`Get-NetConnectionProfile` to confirm), so these rules cover both.

## Connecting from anywhere (Tailscale)

Tailscale puts every device on one private network, so remote clients reach the
host without exposing anything to the internet, without router configuration,
and regardless of carrier NAT. **Every client needs it**, including machines on
the same LAN as the host, because the media path uses the tailnet address.

For each person:

1. Install Tailscale from <https://tailscale.com/download> and sign in.
2. Invite them to the tailnet from the admin console (Users → Invite), or add
   the device with a shared auth key.
3. Install OpenSlaq (below) and sign in.

Confirm they are connected with `tailscale status` — the host should list their
device.

## Signing in needs HTTPS

Browsers hand out Web Crypto only on a *secure origin*: HTTPS, or `localhost`.
Stack Auth hashes with it, so on a plain `http://<address>:3000` page the
sign-in screen dies with **"Cannot read properties of undefined (reading
'digest')"**. That is why signing in works on the host and nowhere else — the
host is the only machine reaching the app over `localhost`. It catches the
desktop app too, whose first sign-in opens that same page in the browser.

The fix is a certificate, which Tailscale issues for the machine's tailnet
name.

1. Turn on **HTTPS Certificates** once, at
   <https://login.tailscale.com/admin/dns>. It is tailnet-wide.
2. Put TLS in front of the four ports clients touch:

   ```bash
   node scripts/tailscale-serve.mjs
   ```

   That maps `https://<machine>.<tailnet>.ts.net` to the web app, and the same
   name on 3001, 3003 and 3004 to the API, file storage and LiveKit
   signalling. Huddle audio and video are untouched: they are direct UDP and do
   not pass through it.
3. Point the stack at the new name:

   ```bash
   node scripts/set-host.mjs --https my-machine.tailnet-name.ts.net
   ```

4. Add `https://my-machine.tailnet-name.ts.net` to the trusted domains of the Stack
   Auth project, or it will refuse the sign-in redirect.
5. Restart LiveKit (`docker compose restart livekit`), the API and the web dev
   server.

### Whenever the address changes

Sign-in goes through Stack Auth, which only redirects back to addresses on its
list. After pointing the stack at a new address, add it at
<https://app.stack-auth.com> → the OpenSlaq project → **Project Settings →
Trusted Domains**, handler path `/handler`. Without it, Google signs you in and
then the callback fails with `REDIRECT_URL_NOT_WHITELISTED`.

`localhost` is exempt — "Allow all localhost callbacks for development" covers
it — which is why the host machine keeps working while nothing else does.

`node scripts/tailscale-serve.mjs --status` shows what is being served, and
`--off` takes it down again.

Everything stays inside the tailnet — this is not Funnel, so nothing is
published to the internet.

## Installing the app

Build the installer on the host:

```bash
cd apps/desktop && bun run build
```

It lands in `apps/desktop/src-tauri/target/release/bundle/nsis/` as
`OpenSlaq_<version>_x64-setup.exe`. Copy that to the other machine and run it.

The server address is baked in at build time. Tailscale addresses are stable
per device, so this only has to be rebuilt if the host itself changes.

Everyone signs in with their own account, then joins through an invite link
from the workspace's **Invite teammates** button. Once two people share a
channel, either can start a huddle from the headphones icon in the channel
header or the mic/camera buttons in the composer.

## Controlling someone else's screen

While a huddle is running, whoever is sharing can hand the mouse and keyboard
to another participant.

1. The sharer shares **an entire screen** (not a window or a tab).
2. Anyone watching clicks **Request control** on the shared picture.
3. The sharer gets a prompt naming who asked, and chooses Allow or Decline.
4. While control is live, the sharer sees a green banner with a **Stop** button.
   The controller sees a matching banner and can release with **Esc**.

Control ends the instant the sharer stops sharing, revokes, or the controller
leaves the call — input injection is disarmed on the Rust side, so messages
still in flight do nothing.

Limits worth knowing:

- **The machine being controlled must run the desktop app.** A browser cannot
  have input injected into it; the button explains this rather than failing
  silently.
- **Only a full screen can be controlled.** A window or tab is captured at an
  offset the other side cannot know, so clicks would land in the wrong place.
- Windows will not deliver injected input to windows running as Administrator
  unless OpenSlaq is elevated too.
- One controller at a time; further requests are ignored until control ends.

## Changing the address

One command rewrites every place the host address appears:

```bash
node scripts/set-host.mjs 100.100.100.100   # the tailnet
node scripts/set-host.mjs 192.168.1.106    # this LAN only
node scripts/set-host.mjs localhost        # this machine only
```

Add `--https` when a TLS front is in place, and pass the name the certificate
is for rather than an address:

```bash
node scripts/set-host.mjs --https my-machine.tailnet-name.ts.net
```

Then restart LiveKit (`docker compose restart livekit`) and the API, and
rebuild the desktop app. The LAN address stays allowed in `CORS_ORIGIN`
whichever mode you pick, so a browser on the same network keeps working even
while the app is pointed at the tailnet.

The one setting that must be an IP rather than a name is `node_ip` in
`livekit.yaml` — LiveKit stamps it into every ICE candidate, and a name there
would make every call fail to connect.

## The other option: opening the router

Port-forwarding 3001/3003/3004/7881 (tcp) and 7882/3478/30000-30002 (udp) makes
the server reachable with no client-side install. It needs a public IP that
does not change (this line is ADSL, so a dynamic DNS name), and it should not
be done without TLS in front — logins and message content are plain HTTP
otherwise. Caddy as a reverse proxy with a real domain is the sane version of
this. Tailscale avoids all of it.

## Before you widen access

- `E2E_TEST_SECRET` must stay out of `.env` on a machine other people can
  reach. It enables an HMAC bypass in `apps/api/src/auth/jwt.ts` that mints a
  session for any user id, and the value the test suite uses is a constant in
  this repo. Add it back only while running the browser test suites, or let
  Playwright start its own API (stop the long-running one first — the config
  reuses an existing server when it finds one).
- The same applies to `EXPO_PUBLIC_E2E_TEST_SECRET` for the mobile suites.
- Traffic inside the tailnet is encrypted by Tailscale. The same services over
  a plain LAN or a forwarded port are not.
