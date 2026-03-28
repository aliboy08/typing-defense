import { COLORS, SHIELD_X, SLOW_MULTIPLIER, getWaveConfig, xpForLevel } from './constants.js';
import { SoloWord } from './entities.js';
import { SoloPowerUp, SoloSlowPowerUp, SoloFreezePowerUp } from './power_ups/index.js';
import { spawnParticles, updateParticles } from './particles.js';
import { createLightningPoints, updateLightningArcs } from './lightning.js';

export class SoloGame {
  constructor() {
    this.score              = 0;
    this.wave               = 1;
    this.hp                 = 100;
    this.words              = [];
    this.powerUps           = [];
    this.particles          = [];
    this.projectiles        = [];
    this.lightningArcs      = [];
    this.spawnTimer         = 0;
    this.waveSpawned        = 0;
    this.waveDestroyed      = 0;
    this.waveTarget         = 0;
    this.inWaveClear        = false;
    this.waveClearTimer     = 0;
    this.waveStartFlash     = 0;
    this.usedWords          = new Set();
    this.powerUpTimer       = 0;
    this.activeChainLightning = false;
    this.chainLightningTimer  = 0;
    this.activeSlow           = false;
    this.slowTimer            = 0;
    this.activeFreeze         = false;
    this.freezeTimer          = 0;
    this.baseDamageFlash      = 0;

    // ── XP & leveling ────────────────────────────────────────────────────────
    this.xp             = 0;
    this.level          = 1;
    this.xpToNext       = xpForLevel(1);
    this.pendingLevelUp = false;
    this.skills         = {};  // { skillId: tier }

    // ── Skill-derived properties ─────────────────────────────────────────────
    this.maxHp        = 100;
    this.bulletCount  = 1;
    this.piercePower  = 0;  // used by spawnBullet and focus hook
    this.consecutiveKills = 0;

    // ── Hook registry ────────────────────────────────────────────────────────
    this.hooks = {};
  }

  // Register a skill hook. Re-registering with the same skillId replaces the handler (for upgrades).
  registerHook(event, skillId, fn) {
    if (!this.hooks[event]) this.hooks[event] = new Map();
    this.hooks[event].set(skillId, fn);
  }

  // Run all handlers for an event (side-effect hooks).
  _runHooks(event, ...args) {
    for (const fn of (this.hooks[event]?.values() ?? [])) fn(this, ...args);
  }

  // Run all handlers for an event, threading a value through each (reducer hooks).
  _reduceHooks(event, initial, ...args) {
    let value = initial;
    for (const fn of (this.hooks[event]?.values() ?? [])) value = fn(this, value, ...args);
    return value;
  }

  reset() {
    this.score              = 0;
    this.hp                 = 100;
    this.words              = [];
    this.powerUps           = [];
    this.particles          = [];
    this.projectiles        = [];
    this.lightningArcs      = [];
    this.spawnTimer         = 0;
    this.waveSpawned        = 0;
    this.waveDestroyed      = 0;
    this.waveTarget         = 0;
    this.inWaveClear        = false;
    this.waveClearTimer     = 0;
    this.waveStartFlash     = 0;
    this.usedWords          = new Set();
    this.powerUpTimer       = 0;
    this.activeChainLightning = false;
    this.chainLightningTimer  = 0;
    this.activeSlow           = false;
    this.slowTimer            = 0;
    this.activeFreeze         = false;
    this.freezeTimer          = 0;
    this.baseDamageFlash      = 0;

    // XP & leveling
    this.xp             = 0;
    this.level          = 1;
    this.xpToNext       = xpForLevel(1);
    this.pendingLevelUp = false;
    this.skills         = {};

    // Skill properties
    this.maxHp            = 100;
    this.bulletCount      = 1;
    this.piercePower      = 0;
    this.consecutiveKills = 0;

    // Clear all skill hooks
    this.hooks = {};
  }

  startWave(n) {
    this.wave           = n;
    this.waveSpawned    = 0;
    this.waveDestroyed  = 0;
    this.waveTarget     = getWaveConfig(n).wordTarget;
    this.inWaveClear    = false;
    this.waveClearTimer = 0;
    this.spawnTimer     = 0;
    this.waveStartFlash = 2.0;
    this._runHooks('onWaveStart');
  }

  // ── XP helpers ─────────────────────────────────────────────────────────────

  _awardXp(word) {
    let xpGain = word.text.length * this.wave;
    xpGain = this._reduceHooks('onXpCalc', xpGain, word);
    xpGain = Math.floor(xpGain);
    this.xp += xpGain;
    if (this.xp >= this.xpToNext && !this.pendingLevelUp) {
      this.pendingLevelUp = true;
    }
  }

  // Called by game.js after the player picks a skill.
  advanceLevel() {
    this.xp       = Math.max(0, this.xp - this.xpToNext);
    this.level++;
    this.xpToNext = xpForLevel(this.level);
  }

  // ── Nearest word helper ────────────────────────────────────────────────────

  _nearestWord(x, y, exclude) {
    let nearest = null, nearestDist = Infinity;
    for (const w of this.words) {
      if (w === exclude) continue;
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < nearestDist) { nearestDist = d; nearest = w; }
    }
    return nearest;
  }

  // ── Word pool / spawning ───────────────────────────────────────────────────

  getWordPool(wordList) {
    const { wordLenMin: min, wordLenMax: max } = getWaveConfig(this.wave);
    return wordList.filter(w => w.length >= min && w.length <= max && !this.usedWords.has(w));
  }

  spawnWord(wordList) {
    const cfg  = getWaveConfig(this.wave);
    let   pool = this.getWordPool(wordList);
    if (!pool.length) { this.usedWords.clear(); pool = this.getWordPool(wordList); }
    if (!pool.length) return;

    // On higher waves, occasionally mix in a short word (3-5 letters) for variety.
    // Probability caps at 12% so short words stay rare on hard stages.
    let text;
    if (this.wave >= 6 && Math.random() < Math.min(0.12, this.wave * 0.008)) {
      const shortPool = wordList.filter(w => w.length >= 3 && w.length <= 5 && !this.usedWords.has(w));
      if (shortPool.length) text = shortPool[Math.floor(Math.random() * shortPool.length)];
    }
    if (!text) text = pool[Math.floor(Math.random() * pool.length)];

    this.usedWords.add(text);
    this.words.push(new SoloWord(text, cfg.wordSpeed, text.length));
    this.waveSpawned++;
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  destroyWord(word, onClearInput, excess = 0) {
    const col = COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)];
    spawnParticles(this.particles, word.x, word.y, col);
    this.words = this.words.filter(w => w !== word);
    this.score += word.text.length * this.wave * 10;
    this.waveDestroyed++;
    this._awardXp(word);
    this.consecutiveKills++;
    this._runHooks('onWordDestroyed', word, excess, onClearInput);
    onClearInput(word);
  }

  damageEnemy(word, dmg, onClearInput, fromChain = false, fromOverkill = false) {
    dmg = this._reduceHooks('onDamageCalc', dmg, word, fromChain, fromOverkill);

    const hpBefore = word.hp;
    word.hp        = Math.max(0, word.hp - dmg);
    word.hitFlash  = 0.5;

    if (word.hp <= 0) {
      const excess = fromOverkill ? 0 : Math.max(0, dmg - hpBefore);
      this.destroyWord(word, onClearInput, excess);
    }

    // Chain lightning: only procs if the word survived the hit
    if (this.activeChainLightning && !fromChain && this.words.includes(word)) {
      const nearby = this.words
        .filter(w => w !== word)
        .sort((a, b) => Math.hypot(a.x - word.x, a.y - word.y) - Math.hypot(b.x - word.x, b.y - word.y))
        .slice(0, 2);
      for (const t of nearby) {
        this.lightningArcs.push(createLightningPoints(word.x, word.y, t.x, t.y));
        this.damageEnemy(t, 1, onClearInput, true);
      }
    }
  }

  spawnBullet(target) {
    const count = this.bulletCount;
    for (let i = 0; i < count; i++) {
      const offsetY = (i - (count - 1) / 2) * 10;
      this.projectiles.push({
        x: SHIELD_X,
        y: target.y + offsetY,
        target,
        speed: 700,
        pierceLeft: this.piercePower,
      });
    }
  }

  updateProjectiles(dt, onClearInput) {
    this.projectiles = this.projectiles.filter(p => {
      // If target was destroyed, try to redirect (e.g. piercing shot)
      if (!this.words.includes(p.target)) {
        return this._reduceHooks('onBulletRedirect', false, p, null);
      }

      const dx   = p.target.x - p.x;
      const dy   = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 6) {
        this.damageEnemy(p.target, 1, onClearInput);
        this._runHooks('onBulletHit', p, onClearInput);
        return this._reduceHooks('onBulletRedirect', false, p, p.target);
      }

      const move = Math.min(p.speed * dt, dist);
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
      return true;
    });
  }

  // ── Power-ups ──────────────────────────────────────────────────────────────

  activatePowerUp(pu, onClearInput) {
    pu.activate(this, onClearInput);
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(dt, wordList, debugSlowEnemies, debugGodMode, onClearInput, onGameOver) {
    this.spawnTimer += dt * 1000;
    const cfg = getWaveConfig(this.wave);

    if (!this.inWaveClear) {
      if (this.spawnTimer >= cfg.spawnInterval &&
          this.words.length < cfg.maxWords &&
          this.waveSpawned < this.waveTarget) {
        this.spawnWord(wordList);
        this.spawnTimer = 0;
      }
      if (this.waveSpawned >= this.waveTarget && this.words.length === 0) {
        this.inWaveClear    = true;
        this.waveClearTimer = 2.8;
      }
    } else {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) this.startWave(this.wave + 1);
    }

    // Speed multiplier: slow aura hook stacks multiplicatively with power-up slow
    const baseMult  = debugSlowEnemies ? 0.1 : (this.activeSlow ? SLOW_MULTIPLIER : 1);
    const speedMult = this._reduceHooks('onSpeedMult', baseMult);
    for (const w of this.words) w.update(dt, speedMult);

    // Per-frame skill hooks (e.g. shield regen)
    this._runHooks('onUpdate', dt);

    // Power-up spawn + update
    this.powerUpTimer += dt;
    if (this.powerUpTimer >= 12 && this.powerUps.length < 2) {
      this.powerUpTimer = 0;
      const pool = wordList.filter(w => w.length >= 3 && w.length <= 5);
      if (pool.length) {
        const text = pool[Math.floor(Math.random() * pool.length)];
        const r = Math.random();
        this.powerUps.push(
          r < 0.33 ? new SoloPowerUp(text) :
          r < 0.66 ? new SoloSlowPowerUp(text) :
                     new SoloFreezePowerUp(text)
        );
      }
    }
    for (const pu of this.powerUps) pu.update(dt, speedMult);

    // Remove missed power-ups
    this.powerUps = this.powerUps.filter(pu => !pu.reached);

    if (this.activeChainLightning) {
      this.chainLightningTimer -= dt;
      if (this.chainLightningTimer <= 0) {
        this.activeChainLightning = false;
        this.chainLightningTimer  = 0;
      }
    }
    if (this.activeSlow) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) { this.activeSlow = false; this.slowTimer = 0; }
    }
    if (this.activeFreeze) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        for (const w of this.words) w.frozen = false;
        this.activeFreeze = false;
        this.freezeTimer  = 0;
      }
    }

    this.lightningArcs = updateLightningArcs(this.lightningArcs, dt);
    this.particles     = updateParticles(this.particles, dt);
    if (this.baseDamageFlash > 0) this.baseDamageFlash -= dt * 3;
    if (this.waveStartFlash  > 0) this.waveStartFlash  -= dt;

    // Words reaching the base
    const hit = this.words.filter(w => w.reached);
    for (const w of hit) {
      let newHp = this.hp - Math.ceil(w.text.length * 1.5);
      newHp = this._reduceHooks('onLethalHit', newHp, w, debugGodMode);

      const minHp = debugGodMode ? 1 : 0;
      this.hp = Math.max(minHp, newHp);
      this.baseDamageFlash = 1.0;
      spawnParticles(this.particles, SHIELD_X, w.y, '#ff2244');
      this.words = this.words.filter(x => x !== w);
      this.consecutiveKills = 0; // miss resets the focus streak
      onClearInput(w);
      if (this.hp <= 0) { onGameOver(); return; }
    }

    this.updateProjectiles(dt, onClearInput);
  }

  /** Jump to a specific wave (used by debug panel) */
  jumpToWave(n) {
    this.words = [];
    this.startWave(n);
  }
}
