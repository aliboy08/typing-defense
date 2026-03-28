import { BasePowerUp } from '../BasePowerUp.js';
import { spawnParticles } from '../../particles.js';
import { createLightningPoints } from '../../lightning.js';
import { CHAIN_LIGHTNING_DURATION } from '../../constants.js';

export class SoloPowerUp extends BasePowerUp {
  constructor(text) {
    super(text);
    this.type      = 'chain-lightning';
    this.label     = '⚡ CHAIN LIGHTNING';
    this.color     = '#ffdd00';
    this.dimColor  = '#ffaa00';
    this.borderRgb = '255,220,0';
  }

  activate(solo, onClearInput) {
    solo.powerUps = solo.powerUps.filter(p => p !== this);
    spawnParticles(solo.particles, this.x, this.y, '#ffdd00');

    const maxChain = 4;
    const hit      = new Set();
    let chainX = this.x, chainY = this.y;

    for (let i = 0; i < maxChain; i++) {
      let nearest = null, nearestDist = Infinity;
      for (const w of solo.words) {
        if (hit.has(w)) continue;
        const d = Math.hypot(w.x - chainX, w.y - chainY);
        if (d < nearestDist) { nearestDist = d; nearest = w; }
      }
      if (!nearest) break;
      solo.lightningArcs.push(createLightningPoints(chainX, chainY, nearest.x, nearest.y));
      spawnParticles(solo.particles, nearest.x, nearest.y, '#aaff00');
      solo.damageEnemy(nearest, Math.ceil(nearest.maxHp * 0.75), onClearInput, true);
      hit.add(nearest);
      chainX = nearest.x;
      chainY = nearest.y;
    }
    solo.activeChainLightning = true;
    solo.chainLightningTimer  = CHAIN_LIGHTNING_DURATION;
  }
}
