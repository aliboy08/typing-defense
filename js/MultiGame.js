import { canvas } from './canvas.js';
import { COLORS } from './constants.js';
import { spawnParticles, updateParticles } from './particles.js';

export class MultiGame {
  constructor() {
    this.particles      = [];
    this.serverState    = null;
    this.baseDamageFlash = 0;
  }

  reset() {
    this.particles       = [];
    this.serverState     = null;
    this.baseDamageFlash = 0;
  }

  onWordDestroyed(wordId, byPlayer, myPlayerNum) {
    if (!this.serverState) return;
    const word = this.serverState.words.find(w => w.id === wordId);
    if (word) {
      const scaleX = canvas.width  / 1920;
      const scaleY = canvas.height / 1080;
      const x = word.x * scaleX;
      const y = word.y * scaleY;
      const col = byPlayer === myPlayerNum ? COLORS.particle[1] : COLORS.particle[2];
      spawnParticles(this.particles, x, y, col);
    }
  }

  onBaseHit() {
    this.baseDamageFlash = 1.0;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    spawnParticles(this.particles, cx, cy, '#ff2244');
  }

  update(dt) {
    this.particles = updateParticles(this.particles, dt);
    if (this.baseDamageFlash > 0) this.baseDamageFlash -= dt * 3;
  }
}
