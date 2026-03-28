import { BasePowerUp } from '../BasePowerUp.js';
import { spawnParticles } from '../../particles.js';
import { SLOW_DURATION } from '../../constants.js';

export class SoloSlowPowerUp extends BasePowerUp {
  constructor(text) {
    super(text);
    this.label     = '◎ SLOW';
    this.color     = '#44ccff';
    this.dimColor  = '#22aadd';
    this.borderRgb = '68,204,255';
  }

  activate(solo, onClearInput) {
    solo.powerUps = solo.powerUps.filter(p => p !== this);
    spawnParticles(solo.particles, this.x, this.y, '#44ccff');
    solo.activeSlow = true;
    solo.slowTimer  = SLOW_DURATION;
  }
}
