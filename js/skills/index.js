import doubleShot     from './doubleShot/index.js';
import explosiveRound from './explosiveRound/index.js';
import criticalStrike from './criticalStrike/index.js';
import overkill       from './overkill/index.js';
import piercingShot   from './piercingShot/index.js';
import fortify        from './fortify/index.js';
import shieldRegen    from './shieldRegen/index.js';
import lastStand      from './lastStand/index.js';
import greed          from './greed/index.js';
import scholar        from './scholar/index.js';
import focus          from './focus/index.js';
import slowAura       from './slowAura/index.js';

export const ALL_SKILLS = [
  doubleShot, explosiveRound, criticalStrike, overkill, piercingShot,
  fortify, shieldRegen, lastStand, greed, scholar, focus, slowAura,
];

export function getSkillById(id) {
  return ALL_SKILLS.find(s => s.id === id);
}

// Returns up to `count` random skills that are not yet maxed.
// Skills the player already owns appear as upgrade options.
export function pickRandomSkills(playerSkills, count = 3) {
  const available = ALL_SKILLS.filter(s => (playerSkills[s.id] || 0) < s.maxTier);
  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, Math.min(count, available.length));
}
