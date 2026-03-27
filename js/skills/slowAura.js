export default {
  id: 'slow-aura',
  name: 'Slow Aura',
  icon: '~~',
  maxTier: 3,
  description: (tier) => `Enemies permanently move ${tier * 10}% slower.`,
  apply(solo, tier) {
    solo.slowAuraReduction = tier * 0.1; // 0.1, 0.2, 0.3
  },
};
