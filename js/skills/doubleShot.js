export default {
  id: 'double-shot',
  name: 'Double Shot',
  icon: '>>',
  maxTier: 3,
  description: (tier) => [
    'Fire 2 bullets per keystroke.',
    'Fire 3 bullets per keystroke.',
    'Fire 4 bullets per keystroke.',
  ][tier - 1],
  apply(solo, tier) {
    solo.bulletCount = 1 + tier;
  },
};
