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
  },
};
