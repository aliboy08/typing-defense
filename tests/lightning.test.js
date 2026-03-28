import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/canvas.js', () => ({
  canvas: { width: 1920, height: 1080 },
  ctx: {},
}));

import { createLightningPoints, updateLightningArcs } from '../js/lightning.js';

describe('createLightningPoints', () => {
  it('returns an arc object with pts array and life of 1', () => {
    const arc = createLightningPoints(0, 0, 100, 0);
    expect(arc).toHaveProperty('life', 1.0);
    expect(Array.isArray(arc.pts)).toBe(true);
  });

  it('has 9 points (start + 7 intermediate + end)', () => {
    // segs=8: pts starts with x1/y1, adds 7 intermediate (i=1..7), then pushes x2/y2
    const arc = createLightningPoints(0, 0, 100, 0);
    expect(arc.pts).toHaveLength(9);
  });

  it('first point matches start coordinates', () => {
    const arc = createLightningPoints(50, 75, 200, 300);
    expect(arc.pts[0]).toEqual({ x: 50, y: 75 });
  });

  it('last point matches end coordinates', () => {
    const arc = createLightningPoints(50, 75, 200, 300);
    const last = arc.pts[arc.pts.length - 1];
    expect(last).toEqual({ x: 200, y: 300 });
  });

  it('intermediate points are displaced perpendicularly from the line', () => {
    const arc = createLightningPoints(0, 0, 100, 0);
    // Along horizontal line — x should progress, y should vary
    const mid = arc.pts[4];
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(100);
  });
});

describe('updateLightningArcs', () => {
  it('decreases life of each arc', () => {
    const arcs = [{ pts: [], life: 1.0 }, { pts: [], life: 0.8 }];
    updateLightningArcs(arcs, 0.1);
    expect(arcs[0].life).toBeCloseTo(1.0 - 0.1 * 2.5);
    expect(arcs[1].life).toBeCloseTo(0.8 - 0.1 * 2.5);
  });

  it('removes arcs with life <= 0', () => {
    const arcs = [
      { pts: [], life: 0.05 },
      { pts: [], life: 0.8  },
    ];
    const result = updateLightningArcs(arcs, 0.1);
    expect(result).toHaveLength(1);
    expect(result[0].life).toBeGreaterThan(0);
  });

  it('returns the filtered array', () => {
    const arcs = [{ pts: [], life: 1.0 }];
    const result = updateLightningArcs(arcs, 0.1);
    expect(Array.isArray(result)).toBe(true);
  });
});
