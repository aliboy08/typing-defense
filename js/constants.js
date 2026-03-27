export const BASE_RADIUS            = 42;
export const SHIELD_X               = 32;
export const BASE_RADIUS_V          = 50;
export const VW                     = 1920;
export const VH                     = 1080;
export const CHAIN_LIGHTNING_DURATION = 12;
export const SLOW_DURATION            = 8;
export const SLOW_MULTIPLIER          = 0.35;

export const COLORS = {
  bg:        '#050510',
  base:      '#00ffcc',
  baseGlow:  '#00ffcc',
  hpHigh:    '#00ff88',
  hpMid:     '#ffcc00',
  hpLow:     '#ff4466',
  wordTyped: '#00ffcc',
  wordTarget:'#ff8800',
  p2Typed:   '#aaff00',
  p2Target:  '#aa44ff',
  particle:  ['#ff44aa','#ff8800','#aa44ff','#ff4466','#ffcc00','#00ffcc'],
};

export const WORD_COLORS = ['#ff44aa','#ff8800','#cc44ff','#ff6644','#ffcc00'];

export function getWaveConfig(w) {
  return {
    wordSpeed:     40 + w * 9,
    spawnInterval: Math.max(500, 2300 - w * 130),
    maxWords:      Math.min(2 + w, 14),
    wordTarget:    7 + w * 3,
    wordLenMin:    Math.min(3 + Math.floor(w / 2), 12),
    wordLenMax:    Math.min(5 + w, 20),
  };
}
