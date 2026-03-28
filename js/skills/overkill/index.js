import { spawnParticles } from '../../particles.js';
import { COLORS } from '../../constants.js';

export default {
  id: 'overkill',
  name: 'Overkill',
  icon: 'XX',
  maxTier: 3,
  description: (tier) => [
    'Excess kill damage carries to the nearest enemy.',
    'Excess kill damage carries to 2 nearby enemies.',
    'Excess kill damage carries to 3 nearby enemies.',
  ][tier - 1],
  apply(solo, tier) {
    const chains = tier;
    solo.registerHook('onWordDestroyed', 'overkill', (solo, word, excess, onClearInput) => {
      if (excess <= 0) return;
      const targets = [...solo.words]
        .sort((a, b) => Math.hypot(a.x - word.x, a.y - word.y) - Math.hypot(b.x - word.x, b.y - word.y))
        .slice(0, chains);
      for (const t of targets) {
        t.hp = Math.max(0, t.hp - excess);
        t.hitFlash = 0.5;
        if (t.hp <= 0) {
          spawnParticles(solo.particles, t.x, t.y, COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)]);
          solo.words     = solo.words.filter(w => w !== t);
          solo.score    += t.text.length * solo.wave * 10;
          solo.waveDestroyed++;
          solo._awardXp(t);
          onClearInput(t);
        }
      }
    });
  },
};
