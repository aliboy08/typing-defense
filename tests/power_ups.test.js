import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/canvas.js', () => ({
  canvas: { width: 1920, height: 1080 },
  ctx: {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  },
}));

import { BasePowerUp } from '../js/power_ups/BasePowerUp.js';
import { SoloPowerUp }      from '../js/power_ups/chainLightning/index.js';
import { SoloSlowPowerUp }  from '../js/power_ups/slow/index.js';
import { SoloFreezePowerUp } from '../js/power_ups/freeze/index.js';

function makeWord(text, x = 200, y = 200, hp = null) {
  const h = hp ?? text.length;
  return {
    text, x, y, hp: h, maxHp: h,
    frozen: false, hitFlash: 0, reached: false,
    update: vi.fn(),
  };
}

function createMockSolo(overrides = {}) {
  return {
    words: [],
    powerUps: [],
    particles: [],
    lightningArcs: [],
    projectiles: [],
    activeSlow: false, slowTimer: 0,
    activeFreeze: false, freezeTimer: 0,
    activeChainLightning: false, chainLightningTimer: 0,
    damageEnemy: vi.fn(),
    ...overrides,
  };
}

// ── BasePowerUp ───────────────────────────────────────────────────────────────

describe('BasePowerUp.update', () => {
  it('fades in via opacity', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    pu.opacity = 0;
    pu.update(0.1); // small dt so opacity doesn't hit the cap
    expect(pu.opacity).toBeCloseTo(0.3); // 0.1 * 3
  });

  it('opacity is capped at 1', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    pu.update(5); // large dt
    expect(pu.opacity).toBe(1);
  });

  it('moves left at baseVx * speedMult * dt', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    const startX = pu.x;
    pu.update(1, 1); // dt=1, speedMult=1
    expect(pu.x).toBeCloseTo(startX - 45); // baseVx = -45
  });

  it('respects speedMult', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    const startX = pu.x;
    pu.update(1, 2); // speedMult=2
    expect(pu.x).toBeCloseTo(startX - 90);
  });

  it('sets reached=true when x reaches SHIELD_X (32)', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    pu.x = 33;
    pu.update(1, 1);
    expect(pu.reached).toBe(true);
  });

  it('increments pulse each frame', () => {
    class TestPU extends BasePowerUp {}
    const pu = new TestPU('abc');
    pu.pulse = 0;
    pu.update(0.1);
    expect(pu.pulse).toBeGreaterThan(0);
  });
});

// ── Theme properties ──────────────────────────────────────────────────────────

describe('SoloPowerUp (chain lightning) theme', () => {
  it('has correct theme properties', () => {
    const pu = new SoloPowerUp('test');
    expect(pu.label).toBe('⚡ CHAIN LIGHTNING');
    expect(pu.color).toBe('#ffdd00');
    expect(pu.dimColor).toBe('#ffaa00');
    expect(pu.borderRgb).toBe('255,220,0');
    expect(pu.type).toBe('chain-lightning');
  });
});

describe('SoloSlowPowerUp theme', () => {
  it('has correct theme properties', () => {
    const pu = new SoloSlowPowerUp('test');
    expect(pu.label).toBe('◎ SLOW');
    expect(pu.color).toBe('#44ccff');
    expect(pu.dimColor).toBe('#22aadd');
    expect(pu.borderRgb).toBe('68,204,255');
  });
});

describe('SoloFreezePowerUp theme', () => {
  it('has correct theme properties', () => {
    const pu = new SoloFreezePowerUp('test');
    expect(pu.label).toBe('❄ FREEZE');
    expect(pu.color).toBe('#b4f0ff');
    expect(pu.dimColor).toBe('#88ccdd');
    expect(pu.borderRgb).toBe('180,240,255');
  });
});

// ── activate methods ──────────────────────────────────────────────────────────

describe('SoloSlowPowerUp.activate', () => {
  it('removes itself from solo.powerUps', () => {
    const pu   = new SoloSlowPowerUp('slow');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.powerUps).not.toContain(pu);
  });

  it('sets activeSlow=true and slowTimer', () => {
    const pu   = new SoloSlowPowerUp('slow');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.activeSlow).toBe(true);
    expect(solo.slowTimer).toBeGreaterThan(0);
  });
});

describe('SoloFreezePowerUp.activate', () => {
  it('removes itself from solo.powerUps', () => {
    const pu   = new SoloFreezePowerUp('freeze');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.powerUps).not.toContain(pu);
  });

  it('sets activeFreeze=true and freezeTimer', () => {
    const pu   = new SoloFreezePowerUp('freeze');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.activeFreeze).toBe(true);
    expect(solo.freezeTimer).toBeGreaterThan(0);
  });

  it('freezes all active words', () => {
    const pu   = new SoloFreezePowerUp('freeze');
    const w1   = makeWord('aaa');
    const w2   = makeWord('bbb');
    const solo = createMockSolo({ powerUps: [pu], words: [w1, w2] });
    pu.activate(solo, vi.fn());
    expect(w1.frozen).toBe(true);
    expect(w2.frozen).toBe(true);
  });
});

describe('SoloPowerUp (chain lightning).activate', () => {
  it('removes itself from solo.powerUps', () => {
    const pu   = new SoloPowerUp('bolt');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.powerUps).not.toContain(pu);
  });

  it('sets activeChainLightning=true and chainLightningTimer', () => {
    const pu   = new SoloPowerUp('bolt');
    const solo = createMockSolo({ powerUps: [pu] });
    pu.activate(solo, vi.fn());
    expect(solo.activeChainLightning).toBe(true);
    expect(solo.chainLightningTimer).toBeGreaterThan(0);
  });

  it('chains lightning through up to 4 enemies', () => {
    const pu = new SoloPowerUp('bolt');
    pu.x = 800; pu.y = 300;
    const words = [
      makeWord('a', 820, 300),
      makeWord('b', 840, 300),
      makeWord('c', 860, 300),
      makeWord('d', 880, 300),
      makeWord('e', 900, 300), // 5th — should NOT be hit
    ];
    const solo = createMockSolo({ powerUps: [pu], words });
    pu.activate(solo, vi.fn());
    expect(solo.damageEnemy).toHaveBeenCalledTimes(4);
  });

  it('deals 75% of max HP to each chained enemy', () => {
    const pu = new SoloPowerUp('bolt');
    pu.x = 800; pu.y = 300;
    const w  = makeWord('aaaa', 820, 300, 8); // maxHp = 8
    const solo = createMockSolo({ powerUps: [pu], words: [w] });
    pu.activate(solo, vi.fn());
    expect(solo.damageEnemy).toHaveBeenCalledWith(w, Math.ceil(8 * 0.75), expect.any(Function), true);
  });
});
