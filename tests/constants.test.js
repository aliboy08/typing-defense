import { describe, it, expect } from 'vitest';
import { xpForLevel, getWaveConfig } from '../js/constants.js';

describe('xpForLevel', () => {
  it('returns 100 at level 1', () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it('scales by ~1.4x each level', () => {
    expect(xpForLevel(2)).toBe(140);
    expect(xpForLevel(3)).toBe(195); // floor(100 * 1.4^2) = floor(195.999…) = 195
  });

  it('grows significantly by high levels', () => {
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(9));
    expect(xpForLevel(10) / xpForLevel(9)).toBeCloseTo(1.4, 1);
  });
});

describe('getWaveConfig', () => {
  it('wave 1 has correct base values', () => {
    const c = getWaveConfig(1);
    expect(c.wordSpeed).toBe(49);       // 40 + 1*9
    expect(c.wordTarget).toBe(10);      // 7 + 1*3
    expect(c.maxWords).toBe(3);         // min(2+1, 14)
    expect(c.wordLenMin).toBe(3);       // min(3 + floor(0.5), 12)
    expect(c.wordLenMax).toBe(6);       // min(5+1, 20)
    expect(c.spawnInterval).toBe(2170); // max(500, 2300-130)
  });

  it('word speed increases each wave', () => {
    expect(getWaveConfig(2).wordSpeed).toBeGreaterThan(getWaveConfig(1).wordSpeed);
    expect(getWaveConfig(5).wordSpeed).toBe(85); // 40 + 5*9
  });

  it('spawnInterval decreases each wave but not below 500ms', () => {
    expect(getWaveConfig(1).spawnInterval).toBe(2170);
    expect(getWaveConfig(10).spawnInterval).toBe(1000); // 2300 - 10*130
    expect(getWaveConfig(15).spawnInterval).toBe(500);  // capped
    expect(getWaveConfig(20).spawnInterval).toBe(500);  // still capped
  });

  it('maxWords is capped at 14', () => {
    expect(getWaveConfig(1).maxWords).toBe(3);
    expect(getWaveConfig(12).maxWords).toBe(14);
    expect(getWaveConfig(20).maxWords).toBe(14);
  });

  it('wordLenMin grows with waves but caps at 12', () => {
    expect(getWaveConfig(1).wordLenMin).toBe(3);
    expect(getWaveConfig(6).wordLenMin).toBe(6);  // 3 + floor(6/2)
    expect(getWaveConfig(20).wordLenMin).toBe(12); // capped
  });

  it('wordLenMax grows with waves but caps at 20', () => {
    expect(getWaveConfig(1).wordLenMax).toBe(6);
    expect(getWaveConfig(5).wordLenMax).toBe(10);
    expect(getWaveConfig(20).wordLenMax).toBe(20); // min(25, 20) = 20 → actually capped
  });

  it('wordTarget grows with waves', () => {
    expect(getWaveConfig(1).wordTarget).toBe(10);
    expect(getWaveConfig(5).wordTarget).toBe(22);
    expect(getWaveConfig(10).wordTarget).toBe(37);
  });
});
