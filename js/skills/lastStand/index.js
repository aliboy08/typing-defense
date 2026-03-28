import { spawnParticles } from '../../particles.js';
import { SHIELD_X } from '../../constants.js';

export default {
  id: 'last-stand',
  name: 'Last Stand',
  icon: '**',
  maxTier: 3,
  description: (tier) => [
    'Once per wave, survive a lethal hit with 1 HP.',
    'Once per wave, survive a lethal hit with 3 HP.',
    'Once per wave, survive a lethal hit with 6 HP.',
  ][tier - 1],
  apply(solo, tier) {
    const surviveHp = [1, 3, 6][tier - 1];
    let available = true;  // available immediately on pickup for the current wave
    solo.registerHook('onWaveStart', 'last-stand', () => {
      available = true;
    });
    solo.registerHook('onLethalHit', 'last-stand', (solo, newHp, word, debugGodMode) => {
      if (newHp <= 0 && !debugGodMode && available) {
        available = false;
        spawnParticles(solo.particles, SHIELD_X, word.y, '#ffffff');
        return surviveHp;
      }
      return newHp;
    });
  },
};
