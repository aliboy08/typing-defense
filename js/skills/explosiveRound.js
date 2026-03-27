export default {
  id: 'explosive-round',
  name: 'Explosive Round',
  icon: '[*]',
  maxTier: 3,
  description: (tier) => [
    'Bullets deal 1 splash dmg to enemies within 80px.',
    'Bullets deal 2 splash dmg to enemies within 100px.',
    'Bullets deal 3 splash dmg to enemies within 120px.',
  ][tier - 1],
  apply(solo, tier) {
    solo.explosiveDamage = tier;
    solo.explosiveRadius = 60 + tier * 20; // 80, 100, 120
  },
};
