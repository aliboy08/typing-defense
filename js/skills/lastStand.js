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
    solo.lastStandTier      = [1, 3, 6][tier - 1];
    solo.lastStandAvailable = true;
  },
};
