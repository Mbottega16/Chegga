// Chegga Web — takes away the start-up screen.
//
// The screen itself (markup, animation, safety timeout) is in index.html so it
// paints before this bundle loads. It leaves once the app has said it is ready
// and nothing is holding it, but never before the opening swoosh has landed.

const SWOOSH_MS = 2200; // measured from page start
const CONTINUE_KEY = "chegga-web:splash-continue";

let ready = false;
let holds = 0;

function leaveIfDone(): void {
  if (!ready || holds > 0) return;
  const splash = document.getElementById("splash");
  if (!splash) return;
  const wait = splash.classList.contains("sp-continue") ? 0 : Math.max(0, SWOOSH_MS - performance.now());
  window.setTimeout(() => {
    if (holds > 0) return;
    splash.classList.add("sp-done");
    window.setTimeout(() => splash.remove(), 500);
  }, wait);
}

/** The app has drawn what the visitor came for. Safe to call more than once. */
export function splashReady(): void {
  ready = true;
  leaveIfDone();
}

/** Keeps the screen up, with `message` under the wheel, until the returned
 * release is called. Call before the first `await` of the slow work. */
export function holdSplash(message: string): () => void {
  holds += 1;
  const line = document.getElementById("splash-message");
  if (line) line.textContent = message;
  return () => {
    holds -= 1;
    leaveIfDone();
  };
}

/** Reloads without replaying the swoosh, so it reads as one long load. */
export function reloadBehindSplash(): void {
  try {
    sessionStorage.setItem(CONTINUE_KEY, "1");
  } catch {
    // blocked storage: the swoosh simply plays again
  }
  window.location.reload();
}
