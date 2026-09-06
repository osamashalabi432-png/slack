import { defineConfig, loadEnv } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import istanbul from "vite-plugin-istanbul";

const portPrefix = process.env.PORT_PREFIX || "30";

function aasaJson(): string {
  const teamId = process.env.VITE_APPLE_TEAM_ID;
  if (!teamId) return "";
  return JSON.stringify({
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${teamId}.com.openslaq.mobile`],
          components: [
            { "/": "/invite/*" },
            { "/": "/w/*/c/*/t/*" },
            { "/": "/w/*/c/*" },
            { "/": "/w/*/dm/*" },
          ],
        },
      ],
    },
  });
}

export default defineConfig(({ mode }) => {
  // vite.config sees only the shell environment, so .env is read explicitly.
  const rootEnv = loadEnv(mode, join(process.cwd(), "../../"), "VITE_");

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(process.env.VITE_COVERAGE === "true"
        ? [istanbul({ include: "src/**/*", extension: [".ts", ".tsx"] })]
        : []),
      {
        name: "apple-app-site-association",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === "/.well-known/apple-app-site-association") {
              const body = aasaJson();
              if (!body) { res.statusCode = 404; res.end(); return; }
              res.setHeader("Content-Type", "application/json");
              res.end(body);
              return;
            }
            next();
          });
        },
        writeBundle(options) {
          const body = aasaJson();
          if (!body) return;
          const dir = join(options.dir!, ".well-known");
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, "apple-app-site-association"), body);
        },
      },
    ],
    envDir: "../../",
    // @stackframe/stack references process.env (designed for Next.js).
    // Shim it so those references don't crash in the browser.
    define: {
      "process.env": "{}",
    },
    resolve: {
      // yjs breaks if instantiated from two module copies. Force every import
      // (ours + the tiptap collab extensions') onto one instance. See yjs/yjs#438.
      dedupe: ["yjs", "y-protocols"],
    },
    optimizeDeps: {
      // Bundle yjs and every one of its consumers into a single optimized
      // chunk so they can't end up with separate copies.
      include: [
        "yjs",
        "y-protocols/awareness",
        "@tiptap/y-tiptap",
        "@tiptap/extension-collaboration > yjs",
        "@tiptap/extension-collaboration-caret > yjs",
      ],
    },
    server: {
      port: parseInt(`${portPrefix}00`),
      strictPort: true,
      // Bind every interface so other machines on the network can load the app.
      host: true,
      // Vite answers only to Host headers it knows. Anything reaching the dev
      // server by name rather than by address — a TLS front like `tailscale
      // serve`, say — has to be named here; set-host.mjs fills it in.
      allowedHosts: (rootEnv.VITE_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    },
    build: {
      rollupOptions: {
        // @tauri-apps packages must NOT be externalized — the localhost plugin
        // serves assets over plain HTTP so dynamic imports need to be bundled.
        // The code already guards all Tauri calls behind isTauri() checks so
        // these modules are tree-shaken in regular web builds.
      },
    },
  };
});
