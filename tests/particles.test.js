import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/canvas.js', () => ({
  canvas: { width: 1920, height: 1080 },
  ctx: {},
}));

import { spawnParticles, updateParticles } from '../js/particles.js';

describe('spawnParticles', () => {
  it('adds exactly 14 particles to the store', () => {
    const store = [];
    spawnParticles(store, 100, 200, '#ff0000');
    expect(store).toHaveLength(14);
  });

  it('each particle has required properties', () => {
    const store = [];
    spawnParticles(store, 100, 200, '#ff0000');
    for (const p of store) {
      expect(p).toHaveProperty('x', 100);
      expect(p).toHaveProperty('y', 200);
      expect(p).toHaveProperty('color', '#ff0000');
      expect(p).toHaveProperty('life', 1.0);
      expect(p.vx).toBeTypeOf('number');
      expect(p.vy).toBeTypeOf('number');
      expect(p.size).toBeGreaterThan(0);
    }
  });

  it('particles spread in different directions', () => {
    const store = [];
    spawnParticles(store, 0, 0, '#fff');
    const angles = store.map(p => Math.atan2(p.vy, p.vx));
    const unique = new Set(angles.map(a => Math.round(a * 10)));
    expect(unique.size).toBeGreaterThan(8); // at least 8 distinct directions
  });

  it('appends to existing store without clearing it', () => {
    const store = [{ x: 0, y: 0, life: 1, color: '#fff', vx: 0, vy: 0, size: 1 }];
    spawnParticles(store, 50, 50, '#00f');
    expect(store).toHaveLength(15);
  });
});

describe('updateParticles', () => {
  it('moves particles according to velocity', () => {
    const store = [{ x: 0, y: 0, vx: 100, vy: 50, life: 1.0, color: '#f00', size: 2 }];
    updateParticles(store, 0.1);
    expect(store[0].x).toBeCloseTo(10);
    expect(store[0].y).toBeCloseTo(5);
  });

  it('applies friction (0.93 multiplier each frame)', () => {
    const store = [{ x: 0, y: 0, vx: 100, vy: 0, life: 1.0, color: '#f00', size: 2 }];
    updateParticles(store, 0.001); // tiny dt so position change is negligible
    expect(store[0].vx).toBeCloseTo(93);
  });

  it('decreases particle life over time', () => {
    const store = [{ x: 0, y: 0, vx: 0, vy: 0, life: 1.0, color: '#f00', size: 2 }];
    updateParticles(store, 0.1);
    expect(store[0].life).toBeCloseTo(1.0 - 0.1 * 2.2);
  });

  it('removes particles with life <= 0', () => {
    const store = [
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.05, color: '#f00', size: 2 },
      { x: 0, y: 0, vx: 0, vy: 0, life: 1.0,  color: '#0f0', size: 2 },
    ];
    const result = updateParticles(store, 0.1);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('#0f0');
  });

  it('returns an array (filter creates a new reference)', () => {
    const store = [];
    const result = updateParticles(store, 0.1);
    expect(Array.isArray(result)).toBe(true);
  });
});
