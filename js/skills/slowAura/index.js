export default {
  id: 'slow-aura',
  name: 'Slow Aura',
  icon: '~~',
  maxTier: 3,
  description: (tier) => `Enemies permanently move ${tier * 10}% slower.`,
  apply(solo, tier) {
    const reduction = tier * 0.1;
    solo.registerHook('onSpeedMult', 'slow-aura', (solo, speedMult) => {
      return speedMult * (1 - reduction);
    });
  },
};
