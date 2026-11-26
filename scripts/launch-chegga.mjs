// Cross-platform launcher for Chegga's two local editions:
//   default  -> http://localhost:5174/ (public/unseeded build)
//   playtest -> http://localhost:5175/ (MichaelBottega seeded build)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODES = {
  default: { port: 5174, script: "dev", label: "Default" },
  playtest: { port: 5175, script: "dev:playtest", label: "Mbottega16" },
};

const modeKey = process.argv[2];
const noOpen = process.argv.includes("--no-open");
const mode = MODES[modeKey];
if (!mode) {
  console.error("Usage: node scripts/launch-chegga.mjs <default|playtest> [--no-open]");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repoRoot, "web");
const url = `http://localhost:${mode.port}/`;

if (modeKey === "playtest") {
  const seedPath = path.join(webDir, "playtest", "games-backup.json.gz");
  if (!existsSync(seedPath)) {
    console.warn("Note: web/playtest/games-backup.json.gz not found yet; opening unseeded playtest server.");
  }
}

function canConnect(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(300);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    const onFail = () => {
      socket.destroy();
      reject(new Error("closed"));
    };
    socket.once("error", onFail);
    socket.once("timeout", onFail);
  });
}

// Vite binds ::1 (IPv6 localhost) by default on Windows, so probe both loopbacks.
function isPortOpen(port) {
  return Promise.any([canConnect("::1", port), canConnect("127.0.0.1", port)]).catch(() => false);
}

function startDevServer() {
  if (process.platform === "win32") {
    const title = `Chegga - ${mode.label} (${mode.port})`;
    spawn("cmd.exe", ["/c", "start", title, "/min", "cmd", "/k", "npm", "run", mode.script], {
      cwd: webDir,
      stdio: "ignore",
      detached: true,
    }).unref();
    return;
  }
  const cmd = `cd "${webDir}" && nohup npm run ${mode.script} >/tmp/chegga-${mode.port}.log 2>&1 &`;
  spawn("sh", ["-c", cmd], { cwd: webDir, stdio: "ignore", detached: true }).unref();
}

function openBrowser() {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  } else {
    spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  }
}

if (!(await isPortOpen(mode.port))) {
  console.log(`Starting Chegga (${mode.label}) on ${url}...`);
  startDevServer();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await isPortOpen(mode.port)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!(await isPortOpen(mode.port))) {
    console.error(`Timed out waiting for ${url} to listen.`);
    process.exit(1);
  }
}

if (!noOpen) openBrowser();
