// Chegga Web — wraps every card's `.tagline` paragraph with a small
// "What's this?" button + popover holding the same text. `mobile.css`
// hides the paragraph and shows the button below its breakpoint; above
// it, the button/popover stay hidden and the paragraph reads as before
// (a pure CSS switch — this module just builds the extra markup once).
//
// Requested after the first real phone test: a dozen-plus cards each
// showing a full explanatory paragraph before any real content reads as
// a wall of text stacked down a phone screen. Scoped to `section.card`
// taglines only — the in-context help line inside the full-screen 3D
// view (`.play-fullscreen-side .tagline`) stays visible as-is, since
// that's instruction shown exactly when it's needed, not front-page
// busyness.

interface Pair {
  btn: HTMLButtonElement;
  popover: HTMLElement;
}

const pairs: Pair[] = [];

function closeAll(): void {
  for (const { btn, popover } of pairs) {
    popover.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
}

function wire(p: HTMLParagraphElement): void {
  if (p.dataset.taglineWired) return;
  p.dataset.taglineWired = "1";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tagline-info-btn";
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "ⓘ What's this?";

  const popover = document.createElement("div");
  popover.className = "tagline-popover";
  popover.setAttribute("role", "note");
  popover.hidden = true;
  for (const node of Array.from(p.childNodes)) popover.appendChild(node.cloneNode(true));

  btn.addEventListener("click", (e) => {
    // Cards toggle collapsed/expanded on a click anywhere in the heading
    // area; this button sits in the card body, not the heading, so it
    // wouldn't hit that listener either way, but stopping here keeps the
    // one open popover invariant simple regardless of where else a click
    // handler might get attached later.
    e.stopPropagation();
    const willOpen = popover.hidden;
    closeAll();
    popover.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
  });

  p.before(btn);
  p.after(popover);
  pairs.push({ btn, popover });
}

/** Call once at startup, after the page's static template is in the DOM. */
export function setupMobileTaglines(): void {
  document.querySelectorAll<HTMLParagraphElement>("section.card .tagline").forEach(wire);
  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}
