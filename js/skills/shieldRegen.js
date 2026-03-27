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
    solo.regenAmount   = tier < 3 ? 1 : 2;
    solo.regenInterval = tier === 1 ? 4 : 2;
  },
};
