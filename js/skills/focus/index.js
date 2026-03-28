import { canvas } from '../../canvas.js';
import { SHIELD_X } from '../../constants.js';

export default {
  id: 'focus',
  name: 'Focus',
  icon: '@@',
  maxTier: 3,
  description: (tier) => [
    'Every 5 kills in a row fires a free bonus bullet.',
    'Every 4 kills in a row fires a free bonus bullet.',
    'Every 3 kills in a row fires a free bonus bullet.',
  ][tier - 1],
  apply(solo, tier) {
    const threshold = [5, 4, 3][tier - 1];
    solo.registerHook('onWordDestroyed', 'focus', (solo) => {
      if (solo.consecutiveKills % threshold === 0) {
        const closest = solo._nearestWord(SHIELD_X, canvas.height / 2, null);
        if (closest) {
          solo.projectiles.push({ x: SHIELD_X, y: canvas.height / 2, target: closest, speed: 700, pierceLeft: solo.piercePower });
        }
      }
    });
  },
};
