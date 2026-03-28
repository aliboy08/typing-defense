import { BasePowerUp } from '../BasePowerUp.js';
import { spawnParticles } from '../../particles.js';
import { FREEZE_DURATION } from '../../constants.js';

export class SoloFreezePowerUp extends BasePowerUp {
  constructor(text) {
    super(text);
    this.label     = '❄ FREEZE';
    this.color     = '#b4f0ff';
    this.dimColor  = '#88ccdd';
    this.borderRgb = '180,240,255';
  }

  activate(solo, onClearInput) {
    solo.powerUps = solo.powerUps.filter(p => p !== this);
    spawnParticles(solo.particles, this.x, this.y, '#b4f0ff');
    for (const w of solo.words) w.frozen = true;
    solo.activeFreeze = true;
    solo.freezeTimer  = FREEZE_DURATION;
  }
}
