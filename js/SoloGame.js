import { canvas } from './canvas.js';
import { COLORS, SHIELD_X, CHAIN_LIGHTNING_DURATION, SLOW_DURATION, SLOW_MULTIPLIER, FREEZE_DURATION, getWaveConfig, xpForLevel } from './constants.js';
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

    // ── Skill-derived properties (set by skill apply()) ──────────────────────
    this.maxHp               = 100;
    this.bulletCount         = 1;
    this.critChance          = 0;
    this.piercePower         = 0;
    this.xpMult              = 1.0;
    this.scholarThreshold    = 0;   // 0 = disabled
    this.focusThreshold      = 0;   // 0 = disabled
    this.consecutiveKills    = 0;
    this.overkillChains      = 0;
    this.explosiveRadius     = 0;
    this.explosiveDamage     = 0;
    this.slowAuraReduction   = 0;
    this.regenInterval       = 0;   // 0 = disabled
    this.regenAmount         = 0;
    this.regenAccum          = 0;
    this.lastStandTier       = 0;   // 0 = no skill
    this.lastStandAvailable  = false;
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
    this.maxHp               = 100;
    this.bulletCount         = 1;
    this.critChance          = 0;
    this.piercePower         = 0;
    this.xpMult              = 1.0;
    this.scholarThreshold    = 0;
    this.focusThreshold      = 0;
    this.consecutiveKills    = 0;
    this.overkillChains      = 0;
    this.explosiveRadius     = 0;
    this.explosiveDamage     = 0;
    this.slowAuraReduction   = 0;
    this.regenInterval       = 0;
    this.regenAmount         = 0;
    this.regenAccum          = 0;
    this.lastStandTier       = 0;
    this.lastStandAvailable  = false;
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
    // Recharge last stand each wave
    if (this.lastStandTier > 0) this.lastStandAvailable = true;
  }

  // ── XP helpers ─────────────────────────────────────────────────────────────

  _awardXp(word) {
    let xpGain = word.text.length * this.wave;
    if (this.scholarThreshold > 0 && word.text.length >= this.scholarThreshold) {
      xpGain *= 2;
    }
    xpGain = Math.floor(xpGain * this.xpMult);
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
    const text = pool[Math.floor(Math.random() * pool.length)];
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

    // Focus: consecutive kill streak fires a free bonus bullet
    this.consecutiveKills++;
    if (this.focusThreshold > 0 && this.consecutiveKills % this.focusThreshold === 0) {
      const closest = this._nearestWord(SHIELD_X, canvas.height / 2, null);
      if (closest) {
        this.projectiles.push({ x: SHIELD_X, y: canvas.height / 2, target: closest, speed: 700, pierceLeft: this.piercePower });
      }
    }

    // Overkill: spread excess damage to nearby enemies (no recursion)
    if (this.overkillChains > 0 && excess > 0) {
      const targets = [...this.words]
        .sort((a, b) => Math.hypot(a.x - word.x, a.y - word.y) - Math.hypot(b.x - word.x, b.y - word.y))
        .slice(0, this.overkillChains);
      for (const t of targets) {
        t.hp = Math.max(0, t.hp - excess);
        t.hitFlash = 0.5;
        if (t.hp <= 0) {
          spawnParticles(this.particles, t.x, t.y, COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)]);
          this.words     = this.words.filter(w => w !== t);
          this.score    += t.text.length * this.wave * 10;
          this.waveDestroyed++;
          this._awardXp(t);
          onClearInput(t);
        }
      }
    }

    onClearInput(word);
  }

  damageEnemy(word, dmg, onClearInput, fromChain = false, fromOverkill = false) {
    // Critical strike: only on primary bullet hits, not chain or overkill
    if (!fromChain && !fromOverkill && this.critChance > 0 && Math.random() < this.critChance) {
      dmg = word.hp; // instant kill
    }

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
      // If target was destroyed, try to pierce to a new one
      if (!this.words.includes(p.target)) {
        if (p.pierceLeft > 0 && this.words.length > 0) {
          const next = this._nearestWord(p.x, p.y, null);
          if (next) { p.target = next; p.pierceLeft--; return true; }
        }
        return false;
      }

      const dx   = p.target.x - p.x;
      const dy   = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 6) {
        this.damageEnemy(p.target, 1, onClearInput);

        // Explosive round: splash nearby enemies
        if (this.explosiveDamage > 0) {
          const hitX = p.target.x, hitY = p.target.y;
          for (const w of [...this.words]) {
            if (w !== p.target && Math.hypot(w.x - hitX, w.y - hitY) <= this.explosiveRadius) {
              this.damageEnemy(w, this.explosiveDamage, onClearInput, false, true);
            }
          }
        }

        // Pierce: redirect bullet to next nearest enemy
        if (p.pierceLeft > 0 && this.words.length > 0) {
          const next = this._nearestWord(p.x, p.y, p.target);
          if (next) { p.target = next; p.pierceLeft--; return true; }
        }
        return false;
      }

      const move = Math.min(p.speed * dt, dist);
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
      return true;
    });
  }

  // ── Power-ups ──────────────────────────────────────────────────────────────

  activateChainLightning(pu, onClearInput) {
    if (pu) {
      this.powerUps = this.powerUps.filter(p => p !== pu);
      spawnParticles(this.particles, pu.x, pu.y, '#ffdd00');
    }
    const startX   = pu ? pu.x : SHIELD_X;
    const startY   = pu ? pu.y : canvas.height / 2;
    const maxChain = 4;
    const hit      = new Set();
    let chainX = startX, chainY = startY;

    for (let i = 0; i < maxChain; i++) {
      let nearest = null, nearestDist = Infinity;
      for (const w of this.words) {
        if (hit.has(w)) continue;
        const d = Math.hypot(w.x - chainX, w.y - chainY);
        if (d < nearestDist) { nearestDist = d; nearest = w; }
      }
      if (!nearest) break;
      this.lightningArcs.push(createLightningPoints(chainX, chainY, nearest.x, nearest.y));
      spawnParticles(this.particles, nearest.x, nearest.y, '#aaff00');
      this.damageEnemy(nearest, Math.ceil(nearest.maxHp * 0.75), onClearInput, true);
      hit.add(nearest);
      chainX = nearest.x;
      chainY = nearest.y;
    }
    this.activeChainLightning = true;
    this.chainLightningTimer  = CHAIN_LIGHTNING_DURATION;
  }

  activateSlow(pu, onClearInput) {
    if (pu) {
      this.powerUps = this.powerUps.filter(p => p !== pu);
      spawnParticles(this.particles, pu.x, pu.y, '#44ccff');
    }
    this.activeSlow = true;
    this.slowTimer  = SLOW_DURATION;
  }

  activateFreeze(pu, onClearInput) {
    if (pu) {
      this.powerUps = this.powerUps.filter(p => p !== pu);
      spawnParticles(this.particles, pu.x, pu.y, '#b4f0ff');
    }
    for (const w of this.words) w.frozen = true;
    this.activeFreeze = true;
    this.freezeTimer  = FREEZE_DURATION;
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

    // Speed multiplier: slow aura stacks multiplicatively with power-up slow
    const baseMult  = debugSlowEnemies ? 0.1 : (this.activeSlow ? SLOW_MULTIPLIER : 1);
    const speedMult = baseMult * (1 - this.slowAuraReduction);
    for (const w of this.words) w.update(dt, speedMult);

    // Shield regen
    if (this.regenInterval > 0) {
      this.regenAccum += dt;
      if (this.regenAccum >= this.regenInterval) {
        this.regenAccum -= this.regenInterval;
        this.hp = Math.min(this.maxHp, this.hp + this.regenAmount);
      }
    }

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

      // Last stand: intercept lethal hit
      if (newHp <= 0 && !debugGodMode && this.lastStandTier > 0 && this.lastStandAvailable) {
        newHp = this.lastStandTier;
        this.lastStandAvailable = false;
        spawnParticles(this.particles, SHIELD_X, w.y, '#ffffff');
      }

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
