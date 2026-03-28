export default {
  id: 'explosive-round',
  name: 'Explosive Round',
  icon: '[*]',
  maxTier: 3,
  description: (tier) => [
    'Bullets deal 1 splash dmg to enemies within 80px.',
    'Bullets deal 2 splash dmg to enemies within 100px.',
    'Bullets deal 3 splash dmg to enemies within 120px.',
  ][tier - 1],
  apply(solo, tier) {
    const damage = tier;
    const radius = 60 + tier * 20;
    solo.registerHook('onBulletHit', 'explosive-round', (solo, bullet, onClearInput) => {
      const hitX = bullet.target.x;
      const hitY = bullet.target.y;
      for (const w of [...solo.words]) {
        if (w !== bullet.target && Math.hypot(w.x - hitX, w.y - hitY) <= radius) {
          solo.damageEnemy(w, damage, onClearInput, false, true);
        }
      }
    });
  },
};
