const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const inputDisplay = document.getElementById('input-display');

// ── Resize ──────────────────────────────────────────────────────────────────
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// ── Virtual canvas dimensions (server simulation resolution) ─────────────────
const VW = 1920, VH = 1080;

function vToScreen(vx, vy) {
  return { x: (vx / VW) * canvas.width, y: (vy / VH) * canvas.height };
}
function vScaleX(v) { return (v / VW) * canvas.width; }
function vScaleY(v) { return (v / VH) * canvas.height; }

// ── Constants ────────────────────────────────────────────────────────────────
const BASE_RADIUS  = 42;           // solo: CSS px
const BASE_RADIUS_V = 50;          // multi: virtual px (matches server)
const COLORS = {
  bg:        '#050510',
  base:      '#00ffcc',
  baseGlow:  '#00ffcc',
  hpHigh:    '#00ff88',
  hpMid:     '#ffcc00',
  hpLow:     '#ff4466',
  wordTyped: '#00ffcc',            // my typed prefix
  wordTarget:'#ff8800',            // my target word
  p2Typed:   '#aaff00',            // partner's typed prefix
  p2Target:  '#aa44ff',            // partner's target word
  particle:  ['#ff44aa','#ff8800','#aa44ff','#ff4466','#ffcc00','#00ffcc'],
};
const WORD_COLORS = ['#ff44aa','#ff8800','#cc44ff','#ff6644','#ffcc00'];

// ── Mode & state ─────────────────────────────────────────────────────────────
// state: 'menu' | 'lobby' | 'waiting' | 'playing' | 'gameover'
// gameMode: 'solo' | 'multi'
let state      = 'menu';
let gameMode   = 'solo';
let myPlayerNum = 0;

// ── Solo state ───────────────────────────────────────────────────────────────
let soloScore        = 0;
let soloWave         = 1;
let soloHp           = 100;
let soloWords        = [];
let soloSpawnTimer   = 0;
let soloWaveSpawned  = 0;
let soloWaveDestroyed= 0;
let soloWaveTarget   = 0;
let soloInWaveClear  = false;
let soloWaveClearTimer = 0;
let soloWaveStartFlash = 0;
let soloUsedWords    = new Set();

// ── Multiplayer state ─────────────────────────────────────────────────────────
let serverState      = null;   // latest broadcast from server
let multiParticles   = [];     // local particle effects

// ── Shared visual state ───────────────────────────────────────────────────────
let particles        = [];     // solo particles
let currentInput     = '';
let targetWord       = null;   // solo only
let baseDamageFlash  = 0;
let lastTime         = 0;

// ── Overlay screen helper ─────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  if (id) document.getElementById(id)?.classList.remove('hidden');
}

// ── Wave config (solo) ────────────────────────────────────────────────────────
function getWaveConfig(w) {
  return {
    wordSpeed:     40 + w * 9,
    spawnInterval: Math.max(500, 2300 - w * 130),
    maxWords:      Math.min(2 + w, 14),
    wordTarget:    7 + w * 3,
    wordLenMin:    Math.min(3 + Math.floor((w - 1) / 3), 7),
    wordLenMax:    Math.min(4 + Math.floor(w / 2), 13),
  };
}

function getSoloWordPool() {
  const { wordLenMin: min, wordLenMax: max } = getWaveConfig(soloWave);
  return WORD_LIST.filter(w =>
    w.length >= min && w.length <= max && !soloUsedWords.has(w)
  );
}

// ── Spawn on edge (solo) ──────────────────────────────────────────────────────
function spawnOnEdge(angle) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const hw = canvas.width / 2 + 30, hh = canvas.height / 2 + 30;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let t = Infinity;
  if (Math.abs(cos) > 0.0001) { const tx = (cos > 0 ? hw : -hw) / cos; if (tx > 0) t = Math.min(t, tx); }
  if (Math.abs(sin) > 0.0001) { const ty = (sin > 0 ? hh : -hh) / sin; if (ty > 0) t = Math.min(t, ty); }
  return { x: cx + cos * t, y: cy + sin * t };
}

// ── Solo Word class ───────────────────────────────────────────────────────────
class SoloWord {
  constructor(text, speed) {
    const angle = Math.random() * Math.PI * 2;
    const edge  = spawnOnEdge(angle);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    this.text    = text;
    this.x       = edge.x;
    this.y       = edge.y;
    this.vx      = Math.cos(Math.atan2(cy - edge.y, cx - edge.x)) * speed;
    this.vy      = Math.sin(Math.atan2(cy - edge.y, cx - edge.x)) * speed;
    this.color   = WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)];
    this.reached = false;
    this.opacity = 0;
  }
  update(dt) {
    this.opacity = Math.min(1, this.opacity + dt * 3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    if (Math.hypot(this.x - cx, this.y - cy) <= BASE_RADIUS + 8) this.reached = true;
  }
  draw(isTarget) {
    const typed     = isTarget ? currentInput : '';
    const remaining = this.text.slice(typed.length);
    ctx.save();
    ctx.globalAlpha  = this.opacity;
    ctx.font         = 'bold 17px "Courier New",monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    const fullW  = ctx.measureText(this.text).width;
    const typedW = ctx.measureText(typed).width;
    const sx     = this.x - fullW / 2;
    ctx.fillStyle = 'rgba(5,5,16,0.65)';
    ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);
    if (isTarget) {
      ctx.strokeStyle = COLORS.wordTarget + '88';
      ctx.lineWidth   = 1;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
    }
    if (typed) {
      ctx.shadowBlur = 12; ctx.shadowColor = COLORS.wordTyped; ctx.fillStyle = COLORS.wordTyped;
      ctx.fillText(typed, sx, this.y);
    }
    ctx.shadowBlur  = isTarget ? 18 : 8;
    ctx.shadowColor = isTarget ? COLORS.wordTarget : this.color;
    ctx.fillStyle   = isTarget ? COLORS.wordTarget : this.color;
    ctx.fillText(remaining, sx + typedW, this.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParticles(store, x, y, color) {
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i / 14) + Math.random() * 0.4;
    const spd   = 60 + Math.random() * 100;
    store.push({ x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
                 life: 1.0, color, size: 2 + Math.random() * 2.5 });
  }
}
function updateParticles(store, dt) {
  for (const p of store) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.93; p.vy *= 0.93; p.life -= dt * 2.2;
  }
  return store.filter(p => p.life > 0);
}
function drawParticles(store) {
  for (const p of store) {
    ctx.save();
    ctx.globalAlpha = p.life; ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── Solo: destroy word ────────────────────────────────────────────────────────
function soloDestroyWord(word) {
  const col = COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)];
  spawnParticles(particles, word.x, word.y, col);
  soloWords        = soloWords.filter(w => w !== word);
  soloScore       += word.text.length * soloWave * 10;
  soloWaveDestroyed++;
  currentInput     = '';
  targetWord       = null;
  inputDisplay.textContent = '';
}

// ── Solo: update target ───────────────────────────────────────────────────────
function soloUpdateTarget() {
  inputDisplay.textContent = currentInput;
  if (!currentInput) { targetWord = null; return; }
  if (targetWord && soloWords.includes(targetWord) && targetWord.text.startsWith(currentInput)) {
    if (currentInput === targetWord.text) soloDestroyWord(targetWord);
    return;
  }
  const cx = canvas.width / 2, cy = canvas.height / 2;
  let best = null, bestDist = Infinity;
  for (const w of soloWords) {
    if (w.text.startsWith(currentInput)) {
      const d = Math.hypot(w.x - cx, w.y - cy);
      if (d < bestDist) { bestDist = d; best = w; }
    }
  }
  targetWord = best;
  if (targetWord && currentInput === targetWord.text) soloDestroyWord(targetWord);
}

// ── Solo: spawn ───────────────────────────────────────────────────────────────
function soloSpawnWord() {
  const cfg  = getWaveConfig(soloWave);
  let   pool = getSoloWordPool();
  if (!pool.length) { soloUsedWords.clear(); pool = getSoloWordPool(); }
  if (!pool.length) return;
  const text = pool[Math.floor(Math.random() * pool.length)];
  soloUsedWords.add(text);
  soloWords.push(new SoloWord(text, cfg.wordSpeed));
  soloWaveSpawned++;
}

// ── Solo game control ─────────────────────────────────────────────────────────
function startSolo() {
  gameMode = 'solo';
  soloScore = 0; soloHp = 100; soloWords = []; particles = [];
  currentInput = ''; targetWord = null; soloUsedWords = new Set();
  inputDisplay.textContent = '';
  showScreen(null);
  state = 'playing';
  soloStartWave(1);
}

function soloStartWave(n) {
  soloWave          = n;
  soloWaveSpawned   = 0;
  soloWaveDestroyed = 0;
  soloWaveTarget    = getWaveConfig(n).wordTarget;
  soloInWaveClear   = false;
  soloWaveClearTimer = 0;
  soloSpawnTimer    = 0;
  soloWaveStartFlash = 2.0;
}

// ── Solo: update ──────────────────────────────────────────────────────────────
function updateSolo(dt) {
  soloSpawnTimer += dt * 1000;
  const cfg = getWaveConfig(soloWave);

  if (!soloInWaveClear) {
    if (soloSpawnTimer >= cfg.spawnInterval &&
        soloWords.length < cfg.maxWords &&
        soloWaveSpawned < soloWaveTarget) {
      soloSpawnWord(); soloSpawnTimer = 0;
    }
    if (soloWaveSpawned >= soloWaveTarget && soloWords.length === 0) {
      soloInWaveClear    = true;
      soloWaveClearTimer = 2.8;
    }
  } else {
    soloWaveClearTimer -= dt;
    if (soloWaveClearTimer <= 0) soloStartWave(soloWave + 1);
  }

  for (const w of soloWords) w.update(dt);
  particles = updateParticles(particles, dt);
  if (baseDamageFlash > 0) baseDamageFlash -= dt * 3;
  if (soloWaveStartFlash > 0) soloWaveStartFlash -= dt;

  const hit = soloWords.filter(w => w.reached);
  for (const w of hit) {
    soloHp = Math.max(0, soloHp - Math.ceil(w.text.length * 1.5));
    baseDamageFlash = 1.0;
    spawnParticles(particles, canvas.width/2, canvas.height/2, '#ff2244');
    soloWords = soloWords.filter(x => x !== w);
    if (w === targetWord) { targetWord = null; currentInput = ''; inputDisplay.textContent = ''; }
    if (soloHp <= 0) { state = 'gameover'; return; }
  }
}

// ── Network: init ─────────────────────────────────────────────────────────────
function initNetwork() {
  Network.connect();

  Network.on('onRoomJoined', ({ playerNum, roomCode }) => {
    myPlayerNum = playerNum;
    if (playerNum === 0) {
      // Creator: show waiting screen
      document.getElementById('waiting-code').textContent = roomCode;
      document.getElementById('waiting-msg').textContent  = 'Waiting for partner...';
      showScreen('screen-waiting');
      state = 'waiting';
    } else {
      // Joiner: game will start via countdown
      document.getElementById('waiting-code').textContent = roomCode;
      document.getElementById('waiting-msg').textContent  = 'Partner found! Starting...';
      showScreen('screen-waiting');
      state = 'waiting';
    }
  });

  Network.on('onRoomError', ({ message }) => {
    document.getElementById('lobby-error').textContent = message;
  });

  Network.on('onPartnerConnected', () => {
    document.getElementById('waiting-msg').textContent = 'Partner connected! Starting...';
  });

  Network.on('onPartnerLeft', () => {
    showScreen('screen-partner-left');
    state = 'menu';
    serverState = null;
    currentInput = ''; inputDisplay.textContent = '';
  });

  Network.on('onGameState', (gs) => {
    if (state === 'waiting' && gs.state === 'starting') {
      showScreen(null);
      state = 'playing';
    } else if (state === 'waiting' && gs.state === 'playing') {
      showScreen(null);
      state = 'playing';
    }
    serverState = gs;
  });

  Network.on('onWordDestroyed', ({ wordId, byPlayer }) => {
    // Spawn particles at word's last known position
    if (!serverState) return;
    const word = serverState.words.find(w => w.id === wordId);
    if (word) {
      const { x, y } = vToScreen(word.x, word.y);
      const col = byPlayer === myPlayerNum ? COLORS.particle[1] : COLORS.particle[2];
      spawnParticles(multiParticles, x, y, col);
    }
    // If it was my word, clear input
    if (serverState) {
      const myTarget = serverState.players[myPlayerNum]?.targetId;
      if (myTarget === wordId) { currentInput = ''; inputDisplay.textContent = ''; }
    }
  });

  Network.on('onBaseHit', ({ hp }) => {
    baseDamageFlash = 1.0;
    const cx = canvas.width/2, cy = canvas.height/2;
    spawnParticles(multiParticles, cx, cy, '#ff2244');
  });

  Network.on('onGameOver', ({ score, wave }) => {
    state = 'gameover';
    currentInput = ''; inputDisplay.textContent = '';
  });
}

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Menu
  if (state === 'menu') {
    if (e.key === 'Enter' || e.key === ' ') startSolo();
    return;
  }
  // Lobby: handled by HTML buttons
  if (state === 'lobby' || state === 'waiting') return;

  // Game over
  if (state === 'gameover') {
    if (e.key === 'Enter') {
      if (gameMode === 'solo') startSolo();
      else { showScreen('screen-lobby'); state = 'lobby'; serverState = null; }
    }
    return;
  }

  // Playing
  if (e.key === 'Backspace') {
    currentInput = currentInput.slice(0, -1);
    if (!currentInput) targetWord = null;
    if (gameMode === 'solo') soloUpdateTarget();
    else Network.sendInput(currentInput);
    inputDisplay.textContent = currentInput;
    return;
  }
  if (e.key === 'Escape') {
    currentInput = ''; targetWord = null;
    inputDisplay.textContent = '';
    if (gameMode === 'multi') Network.sendInput('');
    return;
  }
  if (e.key.length !== 1) return;

  currentInput += e.key;
  if (gameMode === 'solo') soloUpdateTarget();
  else {
    inputDisplay.textContent = currentInput;
    Network.sendInput(currentInput);
  }
});

// ── Lobby button wiring ───────────────────────────────────────────────────────
document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
  gameMode = 'multi';
  initNetwork();
  document.getElementById('lobby-error').textContent = '';
  document.getElementById('room-code-input').value   = '';
  showScreen('screen-lobby');
  state = 'lobby';
});
document.getElementById('btn-singleplayer')?.addEventListener('click', startSolo);
document.getElementById('btn-create-room')?.addEventListener('click', () => {
  document.getElementById('lobby-error').textContent = '';
  Network.createRoom();
});
document.getElementById('btn-join-room')?.addEventListener('click', () => {
  const code = document.getElementById('room-code-input').value.trim();
  if (!code) { document.getElementById('lobby-error').textContent = 'Enter a room code.'; return; }
  document.getElementById('lobby-error').textContent = '';
  Network.joinRoom(code);
});
document.getElementById('btn-lobby-back')?.addEventListener('click', () => {
  showScreen(null); state = 'menu';
});
document.getElementById('btn-partner-left-menu')?.addEventListener('click', () => {
  showScreen(null); state = 'menu';
});

// ── Drawing helpers ────────────────────────────────────────────────────────────
function drawGrid() {
  const spacing = 44;
  ctx.strokeStyle = 'rgba(0,255,204,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width;  x += spacing) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += spacing) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
}

function drawBaseAt(cx, cy, radius, hp, maxHp) {
  if (baseDamageFlash > 0) {
    ctx.save();
    ctx.globalAlpha = baseDamageFlash * 0.5;
    ctx.shadowBlur = 60; ctx.shadowColor = '#ff2244';
    ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, radius + 6, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  ctx.shadowBlur = 28; ctx.shadowColor = COLORS.baseGlow;
  ctx.strokeStyle = COLORS.base; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,20,30,0.9)';
  ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = COLORS.base + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, radius * 0.65, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 10; ctx.shadowColor = COLORS.base; ctx.fillStyle = COLORS.base;
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(hp, cx, cy); ctx.shadowBlur = 0;
}

function hpColor(pct) {
  return pct > 0.5 ? COLORS.hpHigh : pct > 0.25 ? COLORS.hpMid : COLORS.hpLow;
}

function drawHpBarAt(cx, y, hp, maxHp) {
  const barW = 220, barH = 10;
  const x = cx - barW / 2;
  const pct = hp / maxHp;
  const col = hpColor(pct);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x-1, y-1, barW+2, barH+2);
  ctx.shadowBlur = 10; ctx.shadowColor = col; ctx.fillStyle = col;
  ctx.fillRect(x, y, barW * pct, barH); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);
  ctx.font = '11px "Courier New",monospace'; ctx.fillStyle = '#ffffff66';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('BASE HP', cx, y - 4);
}

function drawHUD(score, wave) {
  ctx.font = 'bold 15px "Courier New",monospace'; ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ffcc'; ctx.fillStyle = '#00ffcc';
  ctx.fillText(`SCORE  ${score}`, 18, 18);
  ctx.textAlign = 'right'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff8800'; ctx.fillStyle = '#ff8800';
  ctx.fillText(`WAVE  ${wave}`, canvas.width - 18, 18);
  ctx.shadowBlur = 0;
}

function drawCentered(text, y, font, color, glow = 20) {
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowBlur = glow; ctx.shadowColor = color; ctx.fillStyle = color;
  ctx.fillText(text, canvas.width/2, y); ctx.shadowBlur = 0;
}

function drawWaveFlash(waveNum, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  drawCentered(`WAVE  ${waveNum}`, canvas.height/2 - 110, 'bold 30px "Courier New",monospace', '#ff8800', 20);
  ctx.restore();
}
function drawWaveClearFlash(waveNum, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  drawCentered(`WAVE ${waveNum} CLEAR!`, canvas.height/2 - 110, 'bold 30px "Courier New",monospace', '#ffff00', 22);
  ctx.restore();
}

// ── Draw multi word ───────────────────────────────────────────────────────────
function drawMultiWord(word) {
  const { x, y } = vToScreen(word.x, word.y);
  const isMyTarget      = word.claimedBy === myPlayerNum;
  const isPartnerTarget = word.claimedBy === (1 - myPlayerNum) && word.claimedBy !== null;

  const typed = isMyTarget
    ? (serverState?.players[myPlayerNum]?.input || '')
    : isPartnerTarget
      ? (serverState?.players[1 - myPlayerNum]?.input || '')
      : '';

  const remaining  = word.text.slice(typed.length);
  const typedColor = isMyTarget ? COLORS.wordTyped : COLORS.p2Typed;
  const restColor  = isMyTarget ? COLORS.wordTarget
                   : isPartnerTarget ? COLORS.p2Target
                   : WORD_COLORS[word.id % WORD_COLORS.length];

  ctx.font = 'bold 17px "Courier New",monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const fullW  = ctx.measureText(word.text).width;
  const typedW = ctx.measureText(typed).width;
  const sx     = x - fullW / 2;

  ctx.fillStyle = 'rgba(5,5,16,0.65)';
  ctx.fillRect(sx - 5, y - 13, fullW + 10, 26);

  if (isMyTarget || isPartnerTarget) {
    ctx.strokeStyle = (isMyTarget ? COLORS.wordTarget : COLORS.p2Target) + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 5, y - 13, fullW + 10, 26);
  }

  if (typed) {
    ctx.shadowBlur = 12; ctx.shadowColor = typedColor; ctx.fillStyle = typedColor;
    ctx.fillText(typed, sx, y);
  }
  ctx.shadowBlur  = (isMyTarget || isPartnerTarget) ? 18 : 8;
  ctx.shadowColor = restColor; ctx.fillStyle = restColor;
  ctx.fillText(remaining, sx + typedW, y);
  ctx.shadowBlur = 0;
}

// ── Draw multiplayer player labels ────────────────────────────────────────────
function drawPlayerLabels() {
  if (!serverState) return;
  const p0 = serverState.players[0];
  const p1 = serverState.players[1];

  ctx.font = '13px "Courier New",monospace'; ctx.textBaseline = 'top';

  // P1 label (bottom-left)
  const myCol    = myPlayerNum === 0 ? COLORS.wordTyped : COLORS.p2Typed;
  const myLabel  = myPlayerNum === 0 ? 'P1 (YOU)' : 'P2 (YOU)';
  const ptrLabel = myPlayerNum === 0 ? 'P2'        : 'P1';
  const ptrCol   = myPlayerNum === 0 ? COLORS.p2Typed : COLORS.wordTyped;

  ctx.shadowBlur = 8; ctx.shadowColor = myCol; ctx.fillStyle = myCol;
  ctx.textAlign = 'left';
  ctx.fillText(`● ${myLabel}`, 18, canvas.height - 60);

  ctx.shadowBlur = 8; ctx.shadowColor = ptrCol; ctx.fillStyle = ptrCol;
  ctx.fillText(`● ${ptrLabel}`, 18, canvas.height - 42);

  ctx.shadowBlur = 0;
}

// ── Screens ────────────────────────────────────────────────────────────────────
function drawMenu() {
  drawGrid();
  const cy = canvas.height / 2;
  drawCentered('TYPING DEFENSE', cy - 70, 'bold 52px "Courier New",monospace', '#00ffcc', 40);
  drawCentered('Words assault your base from all directions.', cy - 8, '16px "Courier New",monospace', '#aa88ff', 10);
  drawCentered('Type them to destroy before they reach you.', cy + 18, '16px "Courier New",monospace', '#aa88ff', 10);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(5,5,16,0.78)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const score = gameMode === 'solo' ? soloScore : (serverState?.score ?? 0);
  const wave  = gameMode === 'solo' ? soloWave  : (serverState?.wave  ?? 1);
  const cy    = canvas.height / 2;
  drawCentered('GAME OVER', cy - 80, 'bold 60px "Courier New",monospace', '#ff2244', 40);
  drawCentered(`SCORE   ${score}`, cy - 8, 'bold 26px "Courier New",monospace', '#00ffcc', 18);
  drawCentered(`WAVE    ${wave}`,  cy + 36, 'bold 26px "Courier New",monospace', '#ff8800', 18);
  const hint = gameMode === 'solo' ? 'PRESS ENTER TO RESTART' : 'PRESS ENTER FOR LOBBY';
  drawCentered(hint, cy + 96, 'bold 18px "Courier New",monospace', '#ffff00', 14);
}

// ── Main loop ──────────────────────────────────────────────────────────────────
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state === 'menu') {
    drawMenu();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (state === 'lobby' || state === 'waiting') {
    // Just show animated grid behind the HTML overlay
    drawGrid();
    requestAnimationFrame(gameLoop);
    return;
  }

  drawGrid();

  // ── Solo update + draw ──
  if (state === 'playing' && gameMode === 'solo') {
    updateSolo(dt);
    drawParticles(particles);
    for (const w of soloWords) w.draw(w === targetWord);
    drawBaseAt(canvas.width/2, canvas.height/2, BASE_RADIUS, soloHp, 100);
    drawHpBarAt(canvas.width/2, canvas.height - 28, soloHp, 100);
    drawHUD(soloScore, soloWave);
    if (soloInWaveClear)       drawWaveClearFlash(soloWave, Math.min(1, soloWaveClearTimer * 1.5));
    else if (soloWaveStartFlash > 0) drawWaveFlash(soloWave, Math.min(1, soloWaveStartFlash * 1.5));
  }

  // ── Multi draw ──
  if ((state === 'playing' || state === 'gameover') && gameMode === 'multi') {
    multiParticles = updateParticles(multiParticles, dt);
    if (baseDamageFlash > 0) baseDamageFlash -= dt * 3;

    if (serverState) {
      drawParticles(multiParticles);
      for (const w of serverState.words) drawMultiWord(w);

      const cx = canvas.width/2, cy = canvas.height/2;
      const r  = vScaleX(BASE_RADIUS_V);
      drawBaseAt(cx, cy, Math.min(r, BASE_RADIUS * 1.2), serverState.hp, serverState.maxHp);
      drawHpBarAt(cx, canvas.height - 28, serverState.hp, serverState.maxHp);
      drawHUD(serverState.score, serverState.wave);
      drawPlayerLabels();

      // Countdown
      if (serverState.state === 'starting') {
        drawCentered(serverState.countdown.toString(), cy,
          'bold 120px "Courier New",monospace', '#00ffcc', 60);
      }

      if (serverState.inWaveClear)
        drawWaveClearFlash(serverState.wave, Math.min(1, serverState.waveClearTimer * 1.5));
      else if (serverState.waveStartFlash > 0)
        drawWaveFlash(serverState.wave, Math.min(1, serverState.waveStartFlash * 1.5));
    }
  }

  if (state === 'gameover') drawGameOver();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame((ts) => { lastTime = ts; gameLoop(ts); });
