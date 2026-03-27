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
    solo.overkillChains = tier;
  },
};
