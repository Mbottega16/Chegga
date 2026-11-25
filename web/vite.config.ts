import { defineConfig } from "vite";

// Pinned, distinct port from the old Chegga frontend (which defaults to
// Vite's own 5173) -- both apps used to land on the same URL with nothing
// but the browser tab's title to tell them apart, which is the actual
// root cause of "I can't tell which one I'm pulling up." strictPort
// means a stale process squatting on 5174 fails loudly instead of Vite
// silently handing you 5175 next time.
//
// `npm run dev` (with HMR) is for a real external browser. For VS Code's
// Simple Browser use `npm run dev:vscode` instead: it builds and serves
// the static production bundle via `vite preview`, with NO HMR client and
// NO WebSocket.
//
// Two versions come out of this one codebase:
//   - default (`npm run dev`, `npm run build`): no account attached. This is
//     what the public site ships.
//   - playtest (`npm run dev:playtest`, port 5175): seeds the owner's
//     games from web/playtest/games-backup.json.gz on load. The flag is a build-time
//     constant, so the default build never contains the seed code or the file.
export default defineConfig(({ mode }) => {
  const playtest = mode === "playtest";
  return {
    define: {
      __PLAYTEST__: JSON.stringify(playtest),
    },
    server: { port: playtest ? 5175 : 5174, strictPort: true },
    preview: { port: 5174, strictPort: true },
    build: {
      chunkSizeWarningLimit: 650, // Three.js in lazy-loaded board3d.ts is ~550 kB minified
    },
  };
});
