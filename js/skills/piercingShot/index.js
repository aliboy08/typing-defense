export default {
  id: 'piercing-shot',
  name: 'Piercing Shot',
  icon: '->',
  maxTier: 3,
  description: (tier) => [
    'Bullets pierce the target and hit 1 more enemy.',
    'Bullets pierce through 2 additional enemies.',
    'Bullets pierce through 3 additional enemies.',
  ][tier - 1],
  apply(solo, tier) {
    solo.piercePower = tier;
    // excludeTarget is null when the original target was destroyed, or the hit target when redirecting after a hit
    solo.registerHook('onBulletRedirect', 'piercing-shot', (solo, keepAlive, bullet, excludeTarget) => {
      if (bullet.pierceLeft > 0 && solo.words.length > 0) {
        const next = solo._nearestWord(bullet.x, bullet.y, excludeTarget);
        if (next) { bullet.target = next; bullet.pierceLeft--; return true; }
      }
      return keepAlive;
    });
  },
};
