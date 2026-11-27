// Chegga Web — the Studio Lab's tool list
//
// One entry per tool: the card it opens, its name (the same words as that
// card's <h2>), the group it sits in, one line that says what it does, and
// what it needs before it has anything to show. labView.ts draws the tool
// list from this and opens one tool at a time; main.ts fills the cards.
//
// No DOM here, so the list and the URL helper are unit-tested.

export type LabGroupId = "train" | "leaks" | "moves" | "progress";

/** What a tool needs before it can show anything: nothing at all, synced
 * games (results only), or games the engine has analyzed. */
export type LabNeeds = "nothing" | "synced" | "analyzed";

export interface LabGroup {
  id: LabGroupId;
  name: string;
  blurb: string;
}

export interface LabTool {
  id: string;
  cardId: string;
  name: string;
  group: LabGroupId;
  blurb: string;
  needs: LabNeeds;
  /** Inner markup of a 24x24 stroke icon (see icons.ts's svgIcon). */
  icon: string;
}

export const LAB_GROUPS: LabGroup[] = [
  { id: "train", name: "Train", blurb: "Practice on real positions." },
  { id: "leaks", name: "Find your leaks", blurb: "What costs you points, and why." },
  { id: "moves", name: "Openings and moves", blurb: "What you play, move by move." },
  { id: "progress", name: "Track your progress", blurb: "How your results change over time." },
];

export const LAB_TOOLS: LabTool[] = [
  {
    id: "puzzles",
    cardId: "puzzle-section",
    name: "Blunder puzzles",
    group: "train",
    blurb: "Find the move you missed in your own games.",
    needs: "analyzed",
    icon: `<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>`,
  },
  {
    id: "themed",
    cardId: "lichess-puzzle-section",
    name: "Themed puzzles",
    group: "train",
    blurb: "About 99,000 rated puzzles, sorted by tactic.",
    needs: "nothing",
    icon: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M8 7h8M8 11h8M8 15h5"></path>`,
  },
  {
    id: "vision",
    cardId: "vision-section",
    name: "Vision trainer",
    group: "train",
    blurb: "Is anything hanging? Quick yes or no on your own positions.",
    needs: "analyzed",
    icon: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`,
  },
  {
    id: "endgames",
    cardId: "practice-section",
    name: "Endgame drills",
    group: "train",
    blurb: "Play standard endgames against the bot.",
    needs: "nothing",
    icon: `<path d="M9 21h6M10 17h4l1-6h-6l1 6zM12 3v3M10.5 4.5h3"></path><circle cx="12" cy="8.5" r="2.5"></circle>`,
  },
  {
    id: "redeem",
    cardId: "redemption-section",
    name: "Redeem a loss",
    group: "train",
    blurb: "Replay your worst blunders and win them back.",
    needs: "analyzed",
    icon: `<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 8v4l3 2"></path>`,
  },
  {
    id: "insights",
    cardId: "insights-section",
    name: "Insights",
    group: "leaks",
    blurb: "Your accuracy, biggest leak and weakest opening.",
    needs: "analyzed",
    icon: `<path d="M9 18h6M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"></path>`,
  },
  {
    id: "motifs",
    cardId: "motifs-section",
    name: "Tactical motifs",
    group: "leaks",
    blurb: "The forks, pins and mates you missed or allowed.",
    needs: "analyzed",
    icon: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`,
  },
  {
    id: "dna",
    cardId: "dna-section",
    name: "Blunder DNA",
    group: "leaks",
    blurb: "When and how your mistakes happen.",
    needs: "analyzed",
    icon: `<path d="M7 3c0 6 10 6 10 12s-10 6-10 6"></path><path d="M17 3c0 6-10 6-10 12s10 6 10 6"></path><path d="M8.5 7h7M8.5 17h7"></path>`,
  },
  {
    id: "time",
    cardId: "time-section",
    name: "Time trouble",
    group: "leaks",
    blurb: "How your clock changes the quality of your moves.",
    needs: "analyzed",
    icon: `<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"></path>`,
  },
  {
    id: "convert",
    cardId: "convert-section",
    name: "Games you didn't convert",
    group: "leaks",
    blurb: "Winning positions that slipped to a draw or a loss.",
    needs: "analyzed",
    icon: `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`,
  },
  {
    id: "explorer",
    cardId: "opening-section",
    name: "Move explorer",
    group: "moves",
    blurb: "Every move you play, drawn as arrows on one board.",
    needs: "analyzed",
    icon: `<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>`,
  },
  {
    id: "heatmap",
    cardId: "depth-section",
    name: "Move-by-move heatmap",
    group: "moves",
    blurb: "Your 1st move, then your 2nd, across all your games.",
    needs: "analyzed",
    icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18M15 3v18"></path>`,
  },
  {
    id: "blunder-rate",
    cardId: "blunder-rate-section",
    name: "Blunder rate over time",
    group: "progress",
    blurb: "One-move oversights per 100 moves, month by month.",
    needs: "analyzed",
    icon: `<path d="M3 3v18h18"></path><polyline points="7 9 11 13 14 10 20 16"></polyline>`,
  },
  {
    id: "consistency",
    cardId: "consistency-section",
    name: "Consistency and tilt",
    group: "progress",
    blurb: "How you play after a loss and late in a session.",
    needs: "synced",
    icon: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>`,
  },
  {
    id: "patterns",
    cardId: "patterns-section",
    name: "Game patterns",
    group: "progress",
    blurb: "How your games end, your rating trend and your opponents.",
    needs: "synced",
    icon: `<path d="M18 20V10M12 20V4M6 20v-6"></path>`,
  },
  {
    id: "rivals",
    cardId: "rivals-section",
    name: "Rivals",
    group: "progress",
    blurb: "Your record against players you meet again.",
    needs: "synced",
    icon: `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line>`,
  },
  {
    id: "road",
    cardId: "road-section",
    name: "Road to a target rating",
    group: "progress",
    blurb: "What to fix to reach the rating you want.",
    needs: "analyzed",
    icon: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>`,
  },
  {
    id: "plan",
    cardId: "weekly-plan-section",
    name: "This week's plan",
    group: "progress",
    blurb: "A day-by-day plan aimed at your weakest area.",
    needs: "analyzed",
    icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`,
  },
  {
    id: "achievements",
    cardId: "achievements-section",
    name: "Achievements",
    group: "progress",
    blurb: "22 milestones to unlock as you train.",
    needs: "nothing",
    icon: `<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>`,
  },
];

export function labToolById(id: string): LabTool | undefined {
  return LAB_TOOLS.find((t) => t.id === id);
}

export function labToolByCard(cardId: string): LabTool | undefined {
  return LAB_TOOLS.find((t) => t.cardId === cardId);
}

export function labGroup(id: LabGroupId): LabGroup {
  return LAB_GROUPS.find((g) => g.id === id)!;
}

/** What the player has so far, which decides what a tool still needs. */
export interface LabDataState {
  synced: number;
  analyzed: number;
}

/** The short line on a tile whose tool has nothing to show yet. */
export function needsLine(needs: LabNeeds, state: LabDataState): string {
  if (needs === "synced") return state.synced > 0 ? "Not enough games yet" : "Needs your games";
  if (needs === "analyzed") {
    if (state.analyzed > 0) return "Not enough data yet";
    return state.synced > 0 ? "Needs analyzed games" : "Needs your games";
  }
  return "Ready";
}

/** The message shown in place of a tool that has nothing to show yet. */
export interface NeedsMessage {
  text: string;
  /** Which buttons go under the text. */
  actions: ("connect" | "demo" | "analyze" | "games")[];
}

export function needsMessage(tool: LabTool, state: LabDataState): NeedsMessage {
  if (state.synced === 0) {
    return {
      text: "This tool reads your own games. Connect your Chess.com or Lichess account, or try it on the sample games.",
      actions: ["connect", "demo"],
    };
  }
  if (tool.needs === "analyzed" && state.analyzed === 0) {
    return {
      text: "Your games are synced, but the engine has not analyzed any of them yet. Analyze them in the background, or open one game to analyze it now.",
      actions: ["analyze", "games"],
    };
  }
  return {
    text: "There is not enough data for this tool yet. It fills in as you sync and analyze more games.",
    actions: ["analyze", "games"],
  };
}

/** The address with this tool open (or with no tool open), keeping the
 * username and site the address already carries. A plain "#section" anchor
 * is dropped: it names a place, not state. */
export function hashWithOpen(hash: string, open?: string): string {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams(raw.includes("=") ? raw : "");
  if (open) params.set("open", open);
  else params.delete("open");
  const next = params.toString();
  return next ? `#${next}` : "";
}

/** The card id in an address's `open=` part, if any. */
export function openFromHash(hash: string): string | undefined {
  const raw = hash.replace(/^#/, "");
  if (!raw.includes("=")) return undefined;
  return new URLSearchParams(raw).get("open") || undefined;
}
