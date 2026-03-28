export default {
  id: 'shield-regen',
  name: 'Shield Regen',
  icon: '++',
  maxTier: 3,
  description: (tier) => [
    'Regenerate 1 HP every 4 seconds.',
    'Regenerate 1 HP every 2 seconds.',
    'Regenerate 2 HP every 2 seconds.',
  ][tier - 1],
  apply(solo, tier) {
    const amount   = tier < 3 ? 1 : 2;
    const interval = tier === 1 ? 4 : 2;
    let accum = 0;
    solo.registerHook('onUpdate', 'shield-regen', (solo, dt) => {
      accum += dt;
      if (accum >= interval) {
        accum -= interval;
        solo.hp = Math.min(solo.maxHp, solo.hp + amount);
      }
    });
  },
};
