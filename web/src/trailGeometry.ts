// Chegga Web — the shape of a candidate-move trail
//
// A trail runs from a piece's square to the square it should go to. A
// straight line looks like an arrow; a gentle curve reads as a path the piece
// travels, and keeps trails that start on the same square from lying on top
// of each other. Pure geometry in the board's 0-100 viewBox units, so the
// renderer stays small and this can be tested without a DOM.

export interface Point {
  x: number;
  y: number;
}

/** How far the curve bows away from the straight line, as a share of the
 * line's length. Small enough that a short move stays tidy. */
export const TRAIL_BEND = 0.2;

const round = (n: number) => Math.round(n * 100) / 100;

export interface FadeStop {
  offset: number; // 0 = origin square, 1 = destination square
  opacity: number; // share of the trail's own opacity, floor..1
}

/** Opacity along a trail: faint at the origin, full at the destination, with
 * a smoothstep ease so the tail dissolves instead of fading in a straight
 * ramp. `floor` keeps the origin end faintly visible. */
export function trailFadeStops(count = 5, floor = 0.35): FadeStop[] {
  const n = Math.max(2, Math.floor(count));
  const stops: FadeStop[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const eased = t * t * (3 - 2 * t);
    stops.push({ offset: round(t), opacity: round(floor + (1 - floor) * eased) });
  }
  return stops;
}

/** The two control points of the bowed curve from `from` to `to`. Both sit to
 * the left of the direction of travel (on screen, y grows downward). */
export function trailControls(from: Point, to: Point, bend: number = TRAIL_BEND): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal pointing left of travel.
  const nx = dy / length;
  const ny = -dx / length;
  const offset = Math.hypot(dx, dy) * bend;
  return [
    { x: from.x + dx * 0.25 + nx * offset, y: from.y + dy * 0.25 + ny * offset },
    { x: from.x + dx * 0.75 + nx * offset, y: from.y + dy * 0.75 + ny * offset },
  ];
}

/** An SVG path `d` string: one cubic Bezier from `from` to `to`, a smooth arc
 * with no kink. A zero-length move gives a single point. */
export function trailPath(from: Point, to: Point, bend: number = TRAIL_BEND): string {
  const start = `M${round(from.x)} ${round(from.y)}`;
  if (from.x === to.x && from.y === to.y) return start;
  const [c1, c2] = trailControls(from, to, bend);
  return `${start} C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Chooses a gentle curve that stays inside the board regardless of orientation,
 * keeping 1-square and edge-hugging moves straight so arrows never bow off-board. */
export function chooseTrailBend(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len <= 18) return 0; // 1-square orthogonal/diagonal moves read cleanest straight
  const onLeftOrRightEdge = from.x === to.x && (from.x < 10 || from.x > 90);
  const onTopOrBottomEdge = from.y === to.y && (from.y < 10 || from.y > 90);
  if (onLeftOrRightEdge || onTopOrBottomEdge) return 0;

  const nx = dy / len;
  const ny = -dx / len;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const inside = (b: number) => {
    const px = midX + nx * len * b;
    const py = midY + ny * len * b;
    return px >= 6 && px <= 94 && py >= 6 && py <= 94;
  };
  const gentle = 0.09;
  if (inside(gentle)) return gentle;
  if (inside(-gentle)) return -gentle;
  return 0;
}

export interface SplitTrail {
  shaft: string;
  base: Point;
  tip: Point;
  dx: number;
  dy: number;
}

/** Subdivides the exact curve `(from..to)` via de Casteljau so the arrowhead is
 * collinear with the shaft's tangent at `base` — zero kink or crooked heads. */
export function splitTrail(from: Point, to: Point, headLen: number, bend: number = chooseTrailBend(from, to)): SplitTrail {
  const chord = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  if (bend === 0) {
    const dx = (to.x - from.x) / chord;
    const dy = (to.y - from.y) / chord;
    const tip = { x: to.x + dx * 0.5, y: to.y + dy * 0.5 };
    const actualHead = Math.min(headLen, chord * 0.65);
    const base = { x: tip.x - dx * actualHead, y: tip.y - dy * actualHead };
    return {
      shaft: `M${round(from.x)} ${round(from.y)} L${round(base.x)} ${round(base.y)}`,
      base,
      tip,
      dx,
      dy,
    };
  }
  const [c1, c2] = trailControls(from, to, bend);
  const t = Math.max(0.25, Math.min(0.92, 1 - Math.max(0.5, headLen - 0.5) / chord));
  const q0 = lerp(from, c1, t);
  const q1 = lerp(c1, c2, t);
  const q2 = lerp(c2, to, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const base = lerp(r0, r1, t);
  const tLen = Math.hypot(base.x - r0.x, base.y - r0.y) || 1;
  const dx = (base.x - r0.x) / tLen;
  const dy = (base.y - r0.y) / tLen;
  const tip = { x: base.x + dx * headLen, y: base.y + dy * headLen };
  return {
    shaft: `M${round(from.x)} ${round(from.y)} C${round(q0.x)} ${round(q0.y)} ${round(r0.x)} ${round(r0.y)} ${round(base.x)} ${round(base.y)}`,
    base,
    tip,
    dx,
    dy,
  };
}
