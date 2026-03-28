export default {
  id: 'scholar',
  name: 'Scholar',
  icon: '==',
  maxTier: 3,
  description: (tier) => [
    'Words with 6+ letters give double XP.',
    'Words with 5+ letters give double XP.',
    'Words with 4+ letters give double XP.',
  ][tier - 1],
  apply(solo, tier) {
    const threshold = [6, 5, 4][tier - 1];
    solo.registerHook('onXpCalc', 'scholar', (solo, xpGain, word) => {
      return word.text.length >= threshold ? xpGain * 2 : xpGain;
    });
  },
};
