export default {
  id: 'greed',
  name: 'Greed',
  icon: '$$',
  maxTier: 3,
  description: (tier) => `Gain ${tier * 25}% bonus XP from all kills.`,
  apply(solo, tier) {
    solo.xpMult = 1 + tier * 0.25;
  },
};
