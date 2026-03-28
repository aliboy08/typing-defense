export default {
  id: 'fortify',
  name: 'Fortify',
  icon: '##',
  maxTier: 3,
  description: (tier) => `+15 max HP and restore 10 HP. (Tier ${tier})`,
  apply(solo, tier) {
    solo.maxHp += 15;
    solo.hp = Math.min(solo.hp + 10, solo.maxHp);
  },
};
