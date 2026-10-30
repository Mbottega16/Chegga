// Chegga Web — Tactics Lab & Analytics Suite Bento Grid
//
// 15 deep-dive modules structured into a high-density, purposeful Bento Grid
// that fills the container completely and provides instant visual hierarchy.

import { svgIcon } from "./icons";

export interface LabToolItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  badge: string;
  targetId: string;
}

export const LAB_TOOLS: LabToolItem[] = [
  {
    id: "puzzle",
    name: "Own-Blunder Puzzles",
    desc: "Drill real positions right before your mistakes.",
    icon: `<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>`,
    badge: "Interactive",
    targetId: "puzzle-section",
  },
  {
    id: "lichess-puzzle",
    name: "99k Tactics Library",
    desc: "Curated puzzles from Lichess open CC0 library.",
    icon: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10M6 10h10M6 14h6"></path>`,
    badge: "Library",
    targetId: "lichess-puzzle-section",
  },
  {
    id: "vision",
    name: "Vision Trainer",
    desc: "Rapid-fire hanging piece detection drills.",
    icon: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`,
    badge: "Speed Drill",
    targetId: "vision-section",
  },
  {
    id: "motifs",
    name: "Tactical Motif Engine",
    desc: "Classifies pins, forks, skewers, and discoveries.",
    icon: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`,
    badge: "Live Engine",
    targetId: "blunder-rate-section",
  },
  {
    id: "blunder-dna",
    name: "Blunder DNA",
    desc: "Find your recurring mistake profiles and habits.",
    icon: `<path d="M2 12h20M7 5l5 7-5 7M17 5l-5 7 5 7"></path>`,
    badge: "Diagnostics",
    targetId: "insights-section",
  },
  {
    id: "opening",
    name: "Opening Heatmap",
    desc: "Interactive tree of opening lines and win rates.",
    icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 3v18"></path>`,
    badge: "Repertoire",
    targetId: "opening-section",
  },
  {
    id: "depth",
    name: "Move Explorer",
    desc: "Stacked game library branching by move frequency.",
    icon: `<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>`,
    badge: "Explorer",
    targetId: "depth-section",
  },
  {
    id: "practice",
    name: "Endgame Drills",
    desc: "Replay critical endgame converting positions.",
    icon: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
    badge: "Practice",
    targetId: "practice-section",
  },
  {
    id: "consistency",
    name: "Tilt & Consistency",
    desc: "Accuracy variance and fatigue across long sessions.",
    icon: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>`,
    badge: "Analytics",
    targetId: "consistency-section",
  },
  {
    id: "time-pressure",
    name: "Time Trouble Leaks",
    desc: "Correlates move quality with remaining clock.",
    icon: `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`,
    badge: "Clock Leak",
    targetId: "insights-section",
  },
  {
    id: "convert",
    name: "Unconverted Wins",
    desc: "Positions where winning leads were squandered.",
    icon: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`,
    badge: "Review",
    targetId: "convert-section",
  },
  {
    id: "rivals",
    name: "Rivals Tracker",
    desc: "Head-to-head records against repeat opponents.",
    icon: `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line>`,
    badge: "Head-to-Head",
    targetId: "rivals-section",
  },
  {
    id: "road",
    name: "Rating Road",
    desc: "Skill milestone roadmap towards your rating goals.",
    icon: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>`,
    badge: "Roadmap",
    targetId: "road-section",
  },
  {
    id: "weekly-plan",
    name: "Weekly Plan",
    desc: "Curated daily curriculum targeting your leaks.",
    icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`,
    badge: "Curriculum",
    targetId: "weekly-plan-section",
  },
  {
    id: "achievements",
    name: "22 Achievements",
    desc: "Earn milestone badges for tactical mastery.",
    icon: `<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>`,
    badge: "Milestones",
    targetId: "achievements-section",
  },
];

export function renderLabBentoGrid(): string {
  return LAB_TOOLS.map(
    (t) => `
    <div class="lab-tile" data-target="${t.targetId}" data-name="${t.name}" data-desc="${t.desc}" role="button" tabindex="0">
      <div class="lab-tile-inner">
        <span class="lab-tile-icon">${svgIcon(t.icon, "lab-svg-icon", 24)}</span>
        <span class="lab-tile-title">${t.name}</span>
      </div>
      <div class="lab-tile-caption-drawer" role="tooltip">
        <p class="lab-drawer-desc">${t.desc}</p>
        <span class="lab-drawer-action">Click to launch ↗</span>
      </div>
    </div>
  `
  ).join("");
}
