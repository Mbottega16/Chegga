import { describe, it, expect } from "vitest";
import { trailPath } from "../../src/trailGeometry";

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
