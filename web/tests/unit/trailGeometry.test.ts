import { describe, it, expect } from "vitest";
import { chooseTrailBend, splitTrail, trailControls, trailFadeStops, trailPath, type Point } from "../../src/trailGeometry";

describe("trailFadeStops", () => {
  it("runs from the floor at the origin to full opacity at the destination", () => {
    const stops = trailFadeStops(5, 0.12);
    expect(stops).toHaveLength(5);
    expect(stops[0]).toEqual({ offset: 0, opacity: 0.12 });
    expect(stops.at(-1)).toEqual({ offset: 1, opacity: 1 });
  });

  it("never gets dimmer toward the destination", () => {
    const stops = trailFadeStops(9);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset);
      expect(stops[i].opacity).toBeGreaterThanOrEqual(stops[i - 1].opacity);
    }
  });

  it("eases: the middle sits at the halfway value and the first step is gentler than a straight ramp", () => {
    const stops = trailFadeStops(5, 0);
    expect(stops[2].opacity).toBe(0.5);
    expect(stops[1].opacity).toBeLessThan(0.25);
  });

  it("always returns at least two stops", () => {
    expect(trailFadeStops(0)).toHaveLength(2);
    expect(trailFadeStops(1)).toHaveLength(2);
  });
});

const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("trailPath", () => {
  it("is one cubic Bezier that starts and ends on the two squares", () => {
    const d = trailPath({ x: 6.25, y: 93.75 }, { x: 6.25, y: 68.75 });
    expect(d).toMatch(/^M[\d. -]+ C[\d. -]+$/);
    const n = nums(d);
    expect(n).toHaveLength(8);
    expect([n[0], n[1]]).toEqual([6.25, 93.75]);
    expect([n[6], n[7]]).toEqual([6.25, 68.75]);
  });

  it("bows to the left of travel: moving up the board bends the control points toward x smaller", () => {
    const n = nums(trailPath({ x: 50, y: 80 }, { x: 50, y: 40 }));
    // travelling up (dy < 0), left of travel is toward smaller x on screen
    expect(n[2]).toBeLessThan(50);
    expect(n[4]).toBeLessThan(50);
  });

  it("puts both control points on the same side of the chord (a smooth arc, no kink)", () => {
    const n = nums(trailPath({ x: 10, y: 10 }, { x: 60, y: 35 }));
    const side = (px: number, py: number) => (60 - 10) * (py - 10) - (35 - 10) * (px - 10);
    expect(Math.sign(side(n[2], n[3]))).toBe(Math.sign(side(n[4], n[5])));
    expect(side(n[2], n[3])).not.toBe(0);
  });

  it("scales the bow with the length of the move", () => {
    const short = nums(trailPath({ x: 0, y: 0 }, { x: 10, y: 0 }));
    const long = nums(trailPath({ x: 0, y: 0 }, { x: 40, y: 0 }));
    expect(Math.abs(long[3])).toBeCloseTo(Math.abs(short[3]) * 4, 1);
  });

  it("gives a straight line when the bend is zero", () => {
    const n = nums(trailPath({ x: 0, y: 0 }, { x: 40, y: 0 }, 0));
    expect(n[3]).toBe(0);
    expect(n[5]).toBe(0);
  });

  it("gives a single point for a zero-length move", () => {
    expect(trailPath({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe("M5 5");
  });
});

// Square centers in the board's 0-100 viewBox: files and ranks at 6.25, 18.75, ... 93.75.
const CENTERS = Array.from({ length: 8 }, (_, i) => 6.25 + i * 12.5);
const SQUARES: Point[] = CENTERS.flatMap((x) => CENTERS.map((y) => ({ x, y })));

/** A point on the cubic Bezier `from..to` with the given bend, at parameter t. */
function curveAt(from: Point, to: Point, bend: number, t: number): Point {
  const [c1, c2] = trailControls(from, to, bend);
  const u = 1 - t;
  return {
    x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
    y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
  };
}

describe("chooseTrailBend", () => {
  it("keeps one-square moves straight, orthogonal and diagonal", () => {
    expect(chooseTrailBend({ x: 43.75, y: 56.25 }, { x: 43.75, y: 43.75 })).toBe(0);
    expect(chooseTrailBend({ x: 43.75, y: 56.25 }, { x: 56.25, y: 43.75 })).toBe(0);
  });

  it("keeps moves along an outer file or rank straight", () => {
    expect(chooseTrailBend({ x: 6.25, y: 93.75 }, { x: 6.25, y: 18.75 })).toBe(0); // up the a-file
    expect(chooseTrailBend({ x: 93.75, y: 6.25 }, { x: 93.75, y: 81.25 })).toBe(0); // down the h-file
    expect(chooseTrailBend({ x: 18.75, y: 6.25 }, { x: 81.25, y: 6.25 })).toBe(0); // along the top rank
    expect(chooseTrailBend({ x: 81.25, y: 93.75 }, { x: 18.75, y: 93.75 })).toBe(0); // along the bottom rank
  });

  it("gives a long move through the middle a gentle bow", () => {
    expect(Math.abs(chooseTrailBend({ x: 18.75, y: 81.25 }, { x: 68.75, y: 31.25 }))).toBe(0.09);
  });

  it("flips the bow inward when the usual side would leave the board", () => {
    // a1 to b8 runs close to the left edge; its usual (left-of-travel) bow points off the board.
    expect(chooseTrailBend({ x: 6.25, y: 93.75 }, { x: 18.75, y: 6.25 })).toBe(-0.09);
  });

  // About 340,000 checks: ~3 s alone, past the 5 s default when the PC is
  // busy (it timed out twice in full runs on 2026-11-27), so it gets 30 s.
  it("never bows a trail off the board, for any move from any square, in either orientation", () => {
    for (const from of SQUARES) {
      for (const to of SQUARES) {
        if (from.x === to.x && from.y === to.y) continue;
        const bend = chooseTrailBend(from, to);
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const p = curveAt(from, to, bend, t);
          // 2 units of margin: the trail's stroke stays on the board too
          expect(p.x).toBeGreaterThanOrEqual(2);
          expect(p.x).toBeLessThanOrEqual(98);
          expect(p.y).toBeGreaterThanOrEqual(2);
          expect(p.y).toBeLessThanOrEqual(98);
        }
      }
    }
  }, 30_000);
});

describe("splitTrail", () => {
  const unit = (x: number, y: number) => {
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  };

  it("on a straight trail: the shaft stops at the head's base and the head points along the move", () => {
    const from = { x: 6.25, y: 93.75 };
    const to = { x: 6.25, y: 43.75 };
    const s = splitTrail(from, to, 4, 0);
    expect(s.shaft).toMatch(/^M[\d. -]+ L[\d. -]+$/);
    const n = nums(s.shaft);
    expect([n[0], n[1]]).toEqual([6.25, 93.75]);
    expect(n[2]).toBeCloseTo(s.base.x, 1);
    expect(n[3]).toBeCloseTo(s.base.y, 1);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(-1, 6);
    expect(Math.hypot(s.tip.x - s.base.x, s.tip.y - s.base.y)).toBeCloseTo(4, 6);
    expect(Math.hypot(s.tip.x - to.x, s.tip.y - to.y)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it("never makes a head longer than most of a very short move", () => {
    const s = splitTrail({ x: 50, y: 50 }, { x: 50, y: 45 }, 10, 0);
    expect(Math.hypot(s.tip.x - s.base.x, s.tip.y - s.base.y)).toBeLessThanOrEqual(5 * 0.65 + 1e-9);
  });

  it("on a curved trail: the base sits on the curve and the shaft starts at the origin", () => {
    const from = { x: 18.75, y: 81.25 };
    const to = { x: 68.75, y: 31.25 };
    const s = splitTrail(from, to, 4, 0.09);
    expect(s.shaft).toMatch(/^M[\d. -]+ C[\d. -]+$/);
    const n = nums(s.shaft);
    expect([n[0], n[1]]).toEqual([18.75, 81.25]);
    expect(n[6]).toBeCloseTo(s.base.x, 1);
    expect(n[7]).toBeCloseTo(s.base.y, 1);
    // the base is a point of the full curve
    let nearest = Infinity;
    for (let t = 0; t <= 1; t += 0.0005) {
      const p = curveAt(from, to, 0.09, t);
      nearest = Math.min(nearest, Math.hypot(p.x - s.base.x, p.y - s.base.y));
    }
    expect(nearest).toBeLessThan(0.05);
  });

  it("on a curved trail: the head is collinear with the shaft's last tangent (no kink)", () => {
    const from = { x: 18.75, y: 81.25 };
    const to = { x: 68.75, y: 31.25 };
    const s = splitTrail(from, to, 4, 0.09);
    const n = nums(s.shaft);
    const shaftEnd = unit(n[6] - n[4], n[7] - n[5]); // last control point -> end point
    const head = unit(s.tip.x - s.base.x, s.tip.y - s.base.y);
    expect(shaftEnd.x).toBeCloseTo(head.x, 1);
    expect(shaftEnd.y).toBeCloseTo(head.y, 1);
    expect(head.x).toBeCloseTo(s.dx, 6);
    expect(head.y).toBeCloseTo(s.dy, 6);
    // and the tip lands close to the destination square's center
    expect(Math.hypot(s.tip.x - to.x, s.tip.y - to.y)).toBeLessThan(1.5);
  });

  it("picks the board-safe bend by default", () => {
    const from = { x: 6.25, y: 93.75 };
    const to = { x: 18.75, y: 6.25 };
    expect(splitTrail(from, to, 4)).toEqual(splitTrail(from, to, 4, chooseTrailBend(from, to)));
  });
});
