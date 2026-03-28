import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/canvas.js', () => ({
  canvas: { width: 1920, height: 1080 },
  ctx: {},
}));

import doubleShot     from '../js/skills/doubleShot/index.js';
import criticalStrike from '../js/skills/criticalStrike/index.js';
import explosiveRound from '../js/skills/explosiveRound/index.js';
import piercingShot   from '../js/skills/piercingShot/index.js';
import overkill       from '../js/skills/overkill/index.js';
import focus          from '../js/skills/focus/index.js';
import slowAura       from '../js/skills/slowAura/index.js';
import shieldRegen    from '../js/skills/shieldRegen/index.js';
import lastStand      from '../js/skills/lastStand/index.js';
import scholar        from '../js/skills/scholar/index.js';
import greed          from '../js/skills/greed/index.js';
import fortify        from '../js/skills/fortify/index.js';

// Minimal mock solo that replicates SoloGame's hook system
function createMockSolo(overrides = {}) {
  const hooks = {};
  const solo = {
    hooks,
    registerHook(event, skillId, fn) {
      if (!hooks[event]) hooks[event] = new Map();
      hooks[event].set(skillId, fn);
    },
    _runHooks(event, ...args) {
      for (const fn of (hooks[event]?.values() ?? [])) fn(this, ...args);
    },
    _reduceHooks(event, initial, ...args) {
      let value = initial;
      for (const fn of (hooks[event]?.values() ?? [])) value = fn(this, value, ...args);
      return value;
    },
    maxHp: 100,
    hp: 100,
    bulletCount: 1,
    piercePower: 0,
    consecutiveKills: 0,
    words: [],
    projectiles: [],
    particles: [],
    wave: 1,
    score: 0,
    waveDestroyed: 0,
    _awardXp: vi.fn(),
    _nearestWord: vi.fn(),
    damageEnemy: vi.fn(),
    ...overrides,
  };
  return solo;
}

function makeWord(text, x = 500, y = 300, hp = null) {
  const h = hp ?? text.length;
  return { text, x, y, hp: h, maxHp: h, hitFlash: 0 };
}

// ── Double Shot ───────────────────────────────────────────────────────────────

describe('doubleShot', () => {
  it('sets bulletCount to 1+tier for each tier', () => {
    [1, 2, 3].forEach(tier => {
      const solo = createMockSolo();
      doubleShot.apply(solo, tier);
      expect(solo.bulletCount).toBe(1 + tier);
    });
  });

  it('registers no hooks', () => {
    const solo = createMockSolo();
    doubleShot.apply(solo, 1);
    expect(Object.keys(solo.hooks)).toHaveLength(0);
  });
});

// ── Fortify ───────────────────────────────────────────────────────────────────

describe('fortify', () => {
  it('increases maxHp by 15 on each apply', () => {
    const solo = createMockSolo();
    fortify.apply(solo, 1);
    expect(solo.maxHp).toBe(115);
    fortify.apply(solo, 2);
    expect(solo.maxHp).toBe(130);
  });

  it('restores 10 HP up to new maxHp', () => {
    const solo = createMockSolo({ hp: 80, maxHp: 100 });
    fortify.apply(solo, 1);
    expect(solo.hp).toBe(90); // 80+10 = 90, capped at 115
  });

  it('does not overheal beyond maxHp', () => {
    const solo = createMockSolo({ hp: 100, maxHp: 100 });
    fortify.apply(solo, 1);
    expect(solo.hp).toBe(110); // min(100+10, 115)
  });
});

// ── Critical Strike ───────────────────────────────────────────────────────────

describe('criticalStrike', () => {
  it('registers onDamageCalc hook', () => {
    const solo = createMockSolo();
    criticalStrike.apply(solo, 1);
    expect(solo.hooks['onDamageCalc']).toBeDefined();
  });

  it('crits instantly kill the word when random is below threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const solo = createMockSolo();
    criticalStrike.apply(solo, 1); // 15% chance
    const word = makeWord('test', 500, 300, 5);
    const result = solo._reduceHooks('onDamageCalc', 1, word, false, false);
    expect(result).toBe(word.hp); // instant kill
    vi.restoreAllMocks();
  });

  it('does not crit when random is above threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const solo = createMockSolo();
    criticalStrike.apply(solo, 1);
    const word = makeWord('test', 500, 300, 5);
    const result = solo._reduceHooks('onDamageCalc', 1, word, false, false);
    expect(result).toBe(1); // unchanged
    vi.restoreAllMocks();
  });

  it('never crits on chain hits (fromChain=true)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // would always crit otherwise
    const solo = createMockSolo();
    criticalStrike.apply(solo, 3); // 35% chance
    const word = makeWord('test', 500, 300, 5);
    const result = solo._reduceHooks('onDamageCalc', 1, word, true, false);
    expect(result).toBe(1);
    vi.restoreAllMocks();
  });

  it('never crits on overkill hits (fromOverkill=true)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const solo = createMockSolo();
    criticalStrike.apply(solo, 3);
    const word = makeWord('test', 500, 300, 5);
    const result = solo._reduceHooks('onDamageCalc', 1, word, false, true);
    expect(result).toBe(1);
    vi.restoreAllMocks();
  });

  it('crit chance increases with tier (35% at tier 3)', () => {
    let critCount = 0;
    const solo = createMockSolo();
    criticalStrike.apply(solo, 3); // 35% chance
    const word = makeWord('x', 0, 0, 10);
    // Run 1000 times with real random to check approximate rate
    for (let i = 0; i < 1000; i++) {
      const r = solo._reduceHooks('onDamageCalc', 1, word, false, false);
      if (r === word.hp) critCount++;
    }
    expect(critCount).toBeGreaterThan(200);
    expect(critCount).toBeLessThan(500);
  });
});

// ── Explosive Round ───────────────────────────────────────────────────────────

describe('explosiveRound', () => {
  it('registers onBulletHit hook', () => {
    const solo = createMockSolo();
    explosiveRound.apply(solo, 1);
    expect(solo.hooks['onBulletHit']).toBeDefined();
  });

  it('damages enemies within explosion radius', () => {
    const target  = makeWord('target', 300, 300);
    const nearby  = makeWord('near',   340, 300); // 40px away — within 80px
    const farWord = makeWord('far',    500, 300); // 200px away — outside
    const solo = createMockSolo({ words: [nearby, farWord] });
    explosiveRound.apply(solo, 1); // radius 80
    const bullet = { target };
    const onClear = vi.fn();
    solo._runHooks('onBulletHit', bullet, onClear);
    expect(solo.damageEnemy).toHaveBeenCalledWith(nearby, 1, onClear, false, true);
    expect(solo.damageEnemy).not.toHaveBeenCalledWith(farWord, expect.anything(), expect.anything(), expect.anything(), expect.anything());
  });

  it('does not damage the primary target', () => {
    const target = makeWord('target', 300, 300);
    const solo = createMockSolo({ words: [target] });
    explosiveRound.apply(solo, 1);
    solo._runHooks('onBulletHit', { target }, vi.fn());
    expect(solo.damageEnemy).not.toHaveBeenCalled();
  });

  it('damage and radius scale with tier', () => {
    // Tier 2: 2 damage, 100px radius. Enemy at 90px should be hit.
    const target = makeWord('t', 300, 300);
    const nearby = makeWord('n', 390, 300); // 90px
    const solo = createMockSolo({ words: [nearby] });
    explosiveRound.apply(solo, 2);
    solo._runHooks('onBulletHit', { target }, vi.fn());
    expect(solo.damageEnemy).toHaveBeenCalledWith(nearby, 2, expect.anything(), false, true);
  });
});

// ── Piercing Shot ─────────────────────────────────────────────────────────────

describe('piercingShot', () => {
  it('sets piercePower on solo', () => {
    [1, 2, 3].forEach(tier => {
      const solo = createMockSolo();
      piercingShot.apply(solo, tier);
      expect(solo.piercePower).toBe(tier);
    });
  });

  it('registers onBulletRedirect hook', () => {
    const solo = createMockSolo();
    piercingShot.apply(solo, 1);
    expect(solo.hooks['onBulletRedirect']).toBeDefined();
  });

  it('redirects bullet to next enemy when pierceLeft > 0', () => {
    const next = makeWord('next', 200, 200);
    const solo = createMockSolo({ words: [next] });
    solo._nearestWord.mockReturnValue(next);
    piercingShot.apply(solo, 1);
    const bullet = { x: 100, y: 100, target: makeWord('dead'), pierceLeft: 1 };
    const keepAlive = solo._reduceHooks('onBulletRedirect', false, bullet, null);
    expect(keepAlive).toBe(true);
    expect(bullet.target).toBe(next);
    expect(bullet.pierceLeft).toBe(0);
  });

  it('does not redirect when pierceLeft is 0', () => {
    const solo = createMockSolo({ words: [makeWord('w')] });
    piercingShot.apply(solo, 1);
    const bullet = { x: 0, y: 0, target: makeWord('t'), pierceLeft: 0 };
    const keepAlive = solo._reduceHooks('onBulletRedirect', false, bullet, null);
    expect(keepAlive).toBe(false);
  });

  it('does not redirect when no words remain', () => {
    const solo = createMockSolo({ words: [] });
    piercingShot.apply(solo, 1);
    const bullet = { x: 0, y: 0, target: makeWord('t'), pierceLeft: 2 };
    const keepAlive = solo._reduceHooks('onBulletRedirect', false, bullet, null);
    expect(keepAlive).toBe(false);
  });
});

// ── Overkill ──────────────────────────────────────────────────────────────────

describe('overkill', () => {
  it('registers onWordDestroyed hook', () => {
    const solo = createMockSolo();
    overkill.apply(solo, 1);
    expect(solo.hooks['onWordDestroyed']).toBeDefined();
  });

  it('does nothing when excess is 0', () => {
    const w = makeWord('foo', 200, 200, 3);
    const solo = createMockSolo({ words: [w] });
    overkill.apply(solo, 1);
    solo._runHooks('onWordDestroyed', makeWord('dead'), 0, vi.fn());
    expect(w.hp).toBe(3); // unchanged
  });

  it('deals excess damage to nearest enemy', () => {
    const dead   = makeWord('dead',   300, 300);
    const target = makeWord('target', 320, 300, 5);
    const solo = createMockSolo({ words: [target] });
    overkill.apply(solo, 1);
    const onClear = vi.fn();
    solo._runHooks('onWordDestroyed', dead, 3, onClear);
    expect(target.hp).toBe(2); // 5 - 3
    expect(target.hitFlash).toBeGreaterThan(0);
  });

  it('kills enemy and calls onClearInput when overkill damage exceeds HP', () => {
    const dead   = makeWord('dead',   300, 300);
    const target = makeWord('target', 320, 300, 2);
    const solo   = createMockSolo({ words: [target] });
    overkill.apply(solo, 1);
    const onClear = vi.fn();
    solo._runHooks('onWordDestroyed', dead, 5, onClear);
    expect(target.hp).toBe(0);
    expect(onClear).toHaveBeenCalledWith(target);
    expect(solo.words).not.toContain(target);
  });

  it('chains grow with tier', () => {
    const dead = makeWord('dead', 300, 300);
    const w1   = makeWord('a', 310, 300, 10);
    const w2   = makeWord('b', 320, 300, 10);
    const w3   = makeWord('c', 330, 300, 10);
    const solo = createMockSolo({ words: [w1, w2, w3] });
    overkill.apply(solo, 3); // chains = 3
    solo._runHooks('onWordDestroyed', dead, 2, vi.fn());
    expect(w1.hp).toBe(8);
    expect(w2.hp).toBe(8);
    expect(w3.hp).toBe(8);
  });
});

// ── Focus ─────────────────────────────────────────────────────────────────────

describe('focus', () => {
  it('registers onWordDestroyed hook', () => {
    const solo = createMockSolo();
    focus.apply(solo, 1);
    expect(solo.hooks['onWordDestroyed']).toBeDefined();
  });

  it('fires a bonus bullet at the kill threshold', () => {
    const closest = makeWord('closest', 100, 200);
    const solo = createMockSolo({ consecutiveKills: 5 }); // threshold for tier 1 is 5
    solo._nearestWord.mockReturnValue(closest);
    focus.apply(solo, 1);
    solo._runHooks('onWordDestroyed', makeWord('dead'), 0, vi.fn());
    expect(solo.projectiles).toHaveLength(1);
    expect(solo.projectiles[0].target).toBe(closest);
  });

  it('does not fire between thresholds', () => {
    const solo = createMockSolo({ consecutiveKills: 3 }); // not at threshold (5)
    focus.apply(solo, 1);
    solo._runHooks('onWordDestroyed', makeWord('dead'), 0, vi.fn());
    expect(solo.projectiles).toHaveLength(0);
  });

  it('threshold decreases with tier', () => {
    // Tier 3 threshold is 3
    const closest = makeWord('c');
    const solo = createMockSolo({ consecutiveKills: 3 });
    solo._nearestWord.mockReturnValue(closest);
    focus.apply(solo, 3);
    solo._runHooks('onWordDestroyed', makeWord('dead'), 0, vi.fn());
    expect(solo.projectiles).toHaveLength(1);
  });
});

// ── Slow Aura ─────────────────────────────────────────────────────────────────

describe('slowAura', () => {
  it('registers onSpeedMult hook', () => {
    const solo = createMockSolo();
    slowAura.apply(solo, 1);
    expect(solo.hooks['onSpeedMult']).toBeDefined();
  });

  it('reduces speed multiplier by 10%/20%/30% per tier', () => {
    [1, 2, 3].forEach(tier => {
      const solo = createMockSolo();
      slowAura.apply(solo, tier);
      const result = solo._reduceHooks('onSpeedMult', 1.0);
      expect(result).toBeCloseTo(1.0 * (1 - tier * 0.1));
    });
  });

  it('stacks multiplicatively with existing speed modifier', () => {
    const solo = createMockSolo();
    slowAura.apply(solo, 1); // -10%
    const result = solo._reduceHooks('onSpeedMult', 0.35); // slow power-up active
    expect(result).toBeCloseTo(0.35 * 0.9);
  });

  it('replaces hook on upgrade without stacking', () => {
    const solo = createMockSolo();
    slowAura.apply(solo, 1);
    slowAura.apply(solo, 2); // upgrade — should replace, not stack
    const result = solo._reduceHooks('onSpeedMult', 1.0);
    expect(result).toBeCloseTo(0.8); // only 20%, not 10%*20%
  });
});

// ── Shield Regen ──────────────────────────────────────────────────────────────

describe('shieldRegen', () => {
  it('registers onUpdate hook', () => {
    const solo = createMockSolo();
    shieldRegen.apply(solo, 1);
    expect(solo.hooks['onUpdate']).toBeDefined();
  });

  it('heals after the interval has elapsed', () => {
    const solo = createMockSolo({ hp: 80, maxHp: 100 });
    shieldRegen.apply(solo, 1); // 1 HP every 4 seconds
    solo._runHooks('onUpdate', 4.0);
    expect(solo.hp).toBe(81);
  });

  it('does not heal before the interval', () => {
    const solo = createMockSolo({ hp: 80, maxHp: 100 });
    shieldRegen.apply(solo, 1);
    solo._runHooks('onUpdate', 1.0);
    expect(solo.hp).toBe(80);
  });

  it('does not overheal beyond maxHp', () => {
    const solo = createMockSolo({ hp: 100, maxHp: 100 });
    shieldRegen.apply(solo, 1);
    solo._runHooks('onUpdate', 4.0);
    expect(solo.hp).toBe(100);
  });

  it('tier 3 heals 2 HP every 2 seconds', () => {
    const solo = createMockSolo({ hp: 50, maxHp: 100 });
    shieldRegen.apply(solo, 3);
    solo._runHooks('onUpdate', 2.0);
    expect(solo.hp).toBe(52);
  });
});

// ── Last Stand ────────────────────────────────────────────────────────────────

describe('lastStand', () => {
  it('registers onLethalHit and onWaveStart hooks', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1);
    expect(solo.hooks['onLethalHit']).toBeDefined();
    expect(solo.hooks['onWaveStart']).toBeDefined();
  });

  it('intercepts lethal damage and returns surviveHp', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1); // survive with 1 HP
    const word = makeWord('hit');
    const newHp = solo._reduceHooks('onLethalHit', -5, word, false);
    expect(newHp).toBe(1);
  });

  it('does not trigger on non-lethal damage', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1);
    const word = makeWord('hit');
    const newHp = solo._reduceHooks('onLethalHit', 10, word, false);
    expect(newHp).toBe(10); // unchanged
  });

  it('only triggers once per wave', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1);
    const word = makeWord('hit');
    solo._reduceHooks('onLethalHit', -5, word, false); // first hit — activates
    const second = solo._reduceHooks('onLethalHit', -5, word, false);
    expect(second).toBe(-5); // second hit — not intercepted
  });

  it('recharges on wave start', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1);
    const word = makeWord('hit');
    solo._reduceHooks('onLethalHit', -5, word, false); // uses it up
    solo._runHooks('onWaveStart'); // new wave
    const newHp = solo._reduceHooks('onLethalHit', -5, word, false);
    expect(newHp).toBe(1); // works again
  });

  it('surviveHp scales with tier', () => {
    [1, 2, 3].forEach((tier, i) => {
      const solo = createMockSolo();
      lastStand.apply(solo, tier);
      const result = solo._reduceHooks('onLethalHit', -99, makeWord('x'), false);
      expect(result).toBe([1, 3, 6][i]);
    });
  });

  it('does not trigger in god mode', () => {
    const solo = createMockSolo();
    lastStand.apply(solo, 1);
    const result = solo._reduceHooks('onLethalHit', -5, makeWord('x'), true /* debugGodMode */);
    expect(result).toBe(-5); // unchanged
  });
});

// ── Scholar ───────────────────────────────────────────────────────────────────

describe('scholar', () => {
  it('registers onXpCalc hook', () => {
    const solo = createMockSolo();
    scholar.apply(solo, 1);
    expect(solo.hooks['onXpCalc']).toBeDefined();
  });

  it('doubles XP for words meeting the length threshold', () => {
    const solo = createMockSolo();
    scholar.apply(solo, 1); // threshold: 6 letters
    const word = makeWord('abcdef'); // exactly 6
    const xp = solo._reduceHooks('onXpCalc', 10, word);
    expect(xp).toBe(20);
  });

  it('does not double XP for short words', () => {
    const solo = createMockSolo();
    scholar.apply(solo, 1);
    const word = makeWord('abc'); // 3 letters
    const xp = solo._reduceHooks('onXpCalc', 10, word);
    expect(xp).toBe(10);
  });

  it('threshold lowers with tier', () => {
    const solo = createMockSolo();
    scholar.apply(solo, 3); // threshold: 4 letters
    const word = makeWord('four'); // exactly 4
    const xp = solo._reduceHooks('onXpCalc', 10, word);
    expect(xp).toBe(20);
  });
});

// ── Greed ─────────────────────────────────────────────────────────────────────

describe('greed', () => {
  it('registers onXpCalc hook', () => {
    const solo = createMockSolo();
    greed.apply(solo, 1);
    expect(solo.hooks['onXpCalc']).toBeDefined();
  });

  it('multiplies XP by 1.25/1.50/1.75 per tier', () => {
    [[1, 1.25], [2, 1.50], [3, 1.75]].forEach(([tier, mult]) => {
      const solo = createMockSolo();
      greed.apply(solo, tier);
      const xp = solo._reduceHooks('onXpCalc', 100, makeWord('x'));
      expect(xp).toBeCloseTo(100 * mult);
    });
  });

  it('stacks with scholar when both registered', () => {
    const solo = createMockSolo();
    scholar.apply(solo, 1); // doubles for long words
    greed.apply(solo, 1);   // +25% all words
    const word = makeWord('abcdef'); // 6 letters — triggers scholar
    const xp = solo._reduceHooks('onXpCalc', 10, word);
    expect(xp).toBeCloseTo(10 * 2 * 1.25); // scholar first, then greed
  });
});
