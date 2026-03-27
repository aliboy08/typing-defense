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
    solo.focusThreshold = [5, 4, 3][tier - 1];
  },
};
