export default {
  id: 'critical-strike',
  name: 'Critical Strike',
  icon: '!!',
  maxTier: 3,
  description: (tier) => [
    '15% chance to instantly destroy an enemy.',
    '25% chance to instantly destroy an enemy.',
    '35% chance to instantly destroy an enemy.',
  ][tier - 1],
  apply(solo, tier) {
    solo.critChance = [0.15, 0.25, 0.35][tier - 1];
  },
};
