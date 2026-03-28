import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/canvas.js', () => ({
  canvas: { width: 1920, height: 1080 },
  ctx: {},
}));

import { SoloGame } from '../js/SoloGame.js';

function makeWord(text, x = 500, y = 300, hp = null) {
  const h = hp ?? text.length;
  return {
    text, x, y, hp: h, maxHp: h,
    reached: false, frozen: false, hitFlash: 0,
    update: vi.fn(),
  };
}

// ── Hook system ───────────────────────────────────────────────────────────────

describe('hook system', () => {
  let solo;
  beforeEach(() => { solo = new SoloGame(); });

  it('registerHook stores a handler keyed by skillId', () => {
    const fn = vi.fn();
    solo.registerHook('onUpdate', 'my-skill', fn);
    expect(solo.hooks['onUpdate'].get('my-skill')).toBe(fn);
  });

  it('re-registering the same skillId replaces the handler', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    solo.registerHook('onUpdate', 'my-skill', fn1);
    solo.registerHook('onUpdate', 'my-skill', fn2);
    expect(solo.hooks['onUpdate'].size).toBe(1);
    expect(solo.hooks['onUpdate'].get('my-skill')).toBe(fn2);
  });

  it('_runHooks calls all registered handlers with solo + args', () => {
    const fn = vi.fn();
    solo.registerHook('onUpdate', 'test', fn);
    solo._runHooks('onUpdate', 0.016);
    expect(fn).toHaveBeenCalledWith(solo, 0.016);
  });

  it('_runHooks is a no-op when no hooks registered for event', () => {
    expect(() => solo._runHooks('nonexistentEvent')).not.toThrow();
  });

  it('_reduceHooks threads the value through each handler', () => {
    solo.registerHook('onXpCalc', 'a', (s, v) => v * 2);
    solo.registerHook('onXpCalc', 'b', (s, v) => v + 10);
    const result = solo._reduceHooks('onXpCalc', 5);
    expect(result).toBe(20); // (5 * 2) + 10
  });

  it('_reduceHooks returns initial when no hooks registered', () => {
    expect(solo._reduceHooks('onXpCalc', 42)).toBe(42);
  });

  it('reset clears all hooks', () => {
    solo.registerHook('onUpdate', 'test', vi.fn());
    solo.reset();
    expect(solo.hooks).toEqual({});
  });
});

// ── _awardXp ─────────────────────────────────────────────────────────────────

describe('_awardXp', () => {
  let solo;
  beforeEach(() => { solo = new SoloGame(); });

  it('adds XP equal to word length * wave by default', () => {
    solo.wave = 2;
    solo._awardXp(makeWord('hello')); // 5 letters * wave 2 = 10
    expect(solo.xp).toBe(10);
  });

  it('sets pendingLevelUp when XP reaches xpToNext', () => {
    solo.xp = solo.xpToNext - 1;
    solo._awardXp(makeWord('x'));
    expect(solo.pendingLevelUp).toBe(true);
  });

  it('does not double-set pendingLevelUp', () => {
    solo.pendingLevelUp = true;
    solo.xp = solo.xpToNext - 1;
    solo._awardXp(makeWord('x'));
    expect(solo.pendingLevelUp).toBe(true); // still true, no error
  });

  it('applies onXpCalc hooks before flooring', () => {
    solo.registerHook('onXpCalc', 'test', (s, xp) => xp * 2);
    solo.wave = 1;
    solo._awardXp(makeWord('abc')); // 3 * 1 * 2 = 6
    expect(solo.xp).toBe(6);
  });
});

// ── destroyWord ───────────────────────────────────────────────────────────────

describe('destroyWord', () => {
  let solo;
  beforeEach(() => {
    solo = new SoloGame();
    solo.wave = 1;
  });

  it('removes the word from the words array', () => {
    const w = makeWord('test');
    solo.words = [w];
    solo.destroyWord(w, vi.fn());
    expect(solo.words).not.toContain(w);
  });

  it('adds score based on word length and wave', () => {
    const w = makeWord('hello'); // 5 letters, wave 1 → 5*1*10 = 50
    solo.words = [w];
    solo.destroyWord(w, vi.fn());
    expect(solo.score).toBe(50);
  });

  it('increments waveDestroyed', () => {
    const w = makeWord('a');
    solo.words = [w];
    solo.destroyWord(w, vi.fn());
    expect(solo.waveDestroyed).toBe(1);
  });

  it('increments consecutiveKills', () => {
    const w = makeWord('a');
    solo.words = [w];
    solo.destroyWord(w, vi.fn());
    expect(solo.consecutiveKills).toBe(1);
  });

  it('calls onClearInput with the destroyed word', () => {
    const w = makeWord('a');
    solo.words = [w];
    const onClear = vi.fn();
    solo.destroyWord(w, onClear);
    expect(onClear).toHaveBeenCalledWith(w);
  });

  it('runs onWordDestroyed hooks before onClearInput', () => {
    const order = [];
    solo.registerHook('onWordDestroyed', 'test', () => order.push('hook'));
    const onClear = () => order.push('clear');
    const w = makeWord('a');
    solo.words = [w];
    solo.destroyWord(w, onClear, 0);
    expect(order).toEqual(['hook', 'clear']);
  });
});

// ── damageEnemy ───────────────────────────────────────────────────────────────

describe('damageEnemy', () => {
  let solo;
  beforeEach(() => { solo = new SoloGame(); });

  it('reduces enemy HP by damage amount', () => {
    const w = makeWord('test', 500, 300, 5);
    solo.words = [w];
    solo.damageEnemy(w, 2, vi.fn());
    expect(w.hp).toBe(3);
  });

  it('sets hitFlash on the enemy', () => {
    const w = makeWord('test', 500, 300, 5);
    solo.words = [w];
    solo.damageEnemy(w, 1, vi.fn());
    expect(w.hitFlash).toBeGreaterThan(0);
  });

  it('destroys word when HP reaches 0', () => {
    const w = makeWord('a', 500, 300, 1);
    solo.words = [w];
    solo.damageEnemy(w, 1, vi.fn());
    expect(solo.words).not.toContain(w);
  });

  it('applies onDamageCalc hooks to modify damage', () => {
    const w = makeWord('x', 500, 300, 10);
    solo.words = [w];
    solo.registerHook('onDamageCalc', 'test', (s, dmg) => dmg * 3);
    solo.damageEnemy(w, 2, vi.fn()); // 2 * 3 = 6
    expect(w.hp).toBe(4);
  });

  it('HP cannot go below 0', () => {
    const w = makeWord('x', 500, 300, 2);
    solo.words = [w];
    solo.damageEnemy(w, 100, vi.fn());
    expect(w.hp).toBe(0);
  });
});

// ── spawnBullet ───────────────────────────────────────────────────────────────

describe('spawnBullet', () => {
  let solo;
  beforeEach(() => { solo = new SoloGame(); });

  it('creates bulletCount projectiles', () => {
    solo.bulletCount = 3;
    solo.spawnBullet(makeWord('target', 400, 300));
    expect(solo.projectiles).toHaveLength(3);
  });

  it('all projectiles target the same word', () => {
    const target = makeWord('t');
    solo.bulletCount = 2;
    solo.spawnBullet(target);
    expect(solo.projectiles[0].target).toBe(target);
    expect(solo.projectiles[1].target).toBe(target);
  });

  it('projectiles start at SHIELD_X', () => {
    solo.spawnBullet(makeWord('t', 400, 300));
    expect(solo.projectiles[0].x).toBe(32); // SHIELD_X
  });

  it('sets pierceLeft from piercePower', () => {
    solo.piercePower = 2;
    solo.spawnBullet(makeWord('t'));
    expect(solo.projectiles[0].pierceLeft).toBe(2);
  });

  it('multiple bullets are spread vertically', () => {
    solo.bulletCount = 3;
    solo.spawnBullet(makeWord('t', 400, 300));
    const ys = solo.projectiles.map(p => p.y);
    expect(new Set(ys).size).toBe(3); // all different y positions
  });
});

// ── startWave ─────────────────────────────────────────────────────────────────

describe('startWave', () => {
  it('triggers onWaveStart hooks', () => {
    const solo = new SoloGame();
    const fn = vi.fn();
    solo.registerHook('onWaveStart', 'test', fn);
    solo.startWave(2);
    expect(fn).toHaveBeenCalledWith(solo);
  });

  it('resets wave counters', () => {
    const solo = new SoloGame();
    solo.waveSpawned = 5;
    solo.waveDestroyed = 3;
    solo.startWave(2);
    expect(solo.waveSpawned).toBe(0);
    expect(solo.waveDestroyed).toBe(0);
    expect(solo.wave).toBe(2);
  });
});

// ── advanceLevel ──────────────────────────────────────────────────────────────

describe('advanceLevel', () => {
  it('subtracts xpToNext from xp and increments level', () => {
    const solo = new SoloGame();
    solo.xp = 150;
    solo.advanceLevel();
    expect(solo.level).toBe(2);
    expect(solo.xp).toBe(50); // 150 - 100
  });

  it('xp cannot go below 0', () => {
    const solo = new SoloGame();
    solo.xp = 0;
    solo.advanceLevel();
    expect(solo.xp).toBe(0);
  });
});
