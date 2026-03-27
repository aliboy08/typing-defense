import { canvas } from './canvas.js';
import { COLORS, SHIELD_X, CHAIN_LIGHTNING_DURATION, SLOW_DURATION, SLOW_MULTIPLIER, FREEZE_DURATION, getWaveConfig } from './constants.js';
import { SoloWord, SoloPowerUp, SoloSlowPowerUp, SoloFreezePowerUp } from './entities.js';
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
  }

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

  destroyWord(word, onClearInput) {
    const col = COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)];
    spawnParticles(this.particles, word.x, word.y, col);
    this.words = this.words.filter(w => w !== word);
    this.score += word.text.length * this.wave * 10;
    this.waveDestroyed++;
    onClearInput();
  }

  damageEnemy(word, dmg, onClearInput, fromChain = false) {
    word.hp = Math.max(0, word.hp - dmg);
    word.hitFlash = 0.5;
    if (word.hp <= 0) this.destroyWord(word, onClearInput);

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
    this.projectiles.push({ x: SHIELD_X, y: target.y, target, speed: 700 });
  }

  updateProjectiles(dt, onClearInput) {
    this.projectiles = this.projectiles.filter(p => {
      if (!this.words.includes(p.target)) return false;
      const dx   = p.target.x - p.x;
      const dy   = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        this.damageEnemy(p.target, 1, onClearInput);
        return false;
      }
      const move = Math.min(p.speed * dt, dist);
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
      return true;
    });
  }

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
    // Only freeze words currently on screen
    for (const w of this.words) w.frozen = true;
    this.activeFreeze = true;
    this.freezeTimer  = FREEZE_DURATION;
  }

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

    // Speed multiplier: debug overrides power-up slow
    const speedMult = debugSlowEnemies ? 0.1 : (this.activeSlow ? SLOW_MULTIPLIER : 1);
    for (const w of this.words) w.update(dt, speedMult);

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
    const missedPu = this.powerUps.filter(pu => pu.reached);
    for (const pu of missedPu) {
      this.powerUps = this.powerUps.filter(p => p !== pu);
    }

    if (this.activeChainLightning) {
      this.chainLightningTimer -= dt;
      if (this.chainLightningTimer <= 0) {
        this.activeChainLightning = false;
        this.chainLightningTimer  = 0;
      }
    }
    if (this.activeSlow) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.activeSlow = false;
        this.slowTimer  = 0;
      }
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
      const minHp = debugGodMode ? 1 : 0;
      this.hp = Math.max(minHp, this.hp - Math.ceil(w.text.length * 1.5));
      this.baseDamageFlash = 1.0;
      spawnParticles(this.particles, SHIELD_X, w.y, '#ff2244');
      this.words = this.words.filter(x => x !== w);
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
