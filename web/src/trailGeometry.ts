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

/** An SVG path `d` string: one cubic Bezier from `from` to `to`, bowed to the
 * left of the direction of travel (on screen, y grows downward). Both control
 * points sit on the same side, so the curve is a smooth arc with no kink. A
 * zero-length move gives a single point. */
export function trailPath(from: Point, to: Point, bend: number = TRAIL_BEND): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const start = `M${round(from.x)} ${round(from.y)}`;
  if (length === 0) return start;
  // Unit normal pointing left of travel.
  const nx = dy / length;
  const ny = -dx / length;
  const offset = length * bend;
  const c1 = { x: from.x + dx * 0.25 + nx * offset, y: from.y + dy * 0.25 + ny * offset };
  const c2 = { x: from.x + dx * 0.75 + nx * offset, y: from.y + dy * 0.75 + ny * offset };
  return `${start} C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
}
