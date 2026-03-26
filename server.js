const express  = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');

const WORD_LIST = require('./js/wordlist.js');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

// ── Virtual canvas (server-side physics resolution: 16:9) ───────────────────
const VW = 1920, VH = 1080;
const VCX = VW / 2, VCY = VH / 2;
const BASE_RADIUS_V = 50;
const SPAWN_MARGIN  = 60;
const TICK_MS       = 50; // 20 TPS

// ── Room storage ────────────────────────────────────────────────────────────
const rooms       = new Map(); // code → room
const socketRoom  = new Map(); // socketId → code

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function getWaveConfig(wave) {
  return {
    wordSpeed:     55 + wave * 10,
    spawnInterval: Math.max(500, 2300 - wave * 130),
    maxWords:      Math.min(2 + wave, 14),
    wordTarget:    7 + wave * 3,
    wordLenMin:    Math.min(3 + Math.floor((wave - 1) / 3), 7),
    wordLenMax:    Math.min(4 + Math.floor(wave / 2), 13),
  };
}

function getWordPool(usedWords, wave) {
  const { wordLenMin: min, wordLenMax: max } = getWaveConfig(wave);
  return WORD_LIST.filter(w =>
    w.length >= min && w.length <= max && !usedWords.has(w)
  );
}

function spawnOnEdge(angle) {
  const hw = VW / 2 + SPAWN_MARGIN;
  const hh = VH / 2 + SPAWN_MARGIN;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let t = Infinity;
  if (Math.abs(cos) > 0.0001) {
    const tx = (cos > 0 ? hw : -hw) / cos;
    if (tx > 0) t = Math.min(t, tx);
  }
  if (Math.abs(sin) > 0.0001) {
    const ty = (sin > 0 ? hh : -hh) / sin;
    if (ty > 0) t = Math.min(t, ty);
  }
  return { x: VCX + cos * t, y: VCY + sin * t };
}

// ── Room factory ────────────────────────────────────────────────────────────
function makeRoom(code) {
  return {
    code,
    sockets:           [],
    state:             'waiting',   // waiting | starting | playing | gameover
    countdown:         3,
    countdownTimer:    1.0,
    hp:                100,
    maxHp:             100,
    score:             0,
    wave:              1,
    words:             [],
    spawnTimer:        0,
    waveWordsSpawned:  0,
    waveWordsDestroyed:0,
    waveWordTarget:    0,
    inWaveClear:       false,
    waveClearTimer:    0,
    waveStartFlash:    0,
    playerInputs:      ['', ''],
    playerTargets:     [null, null], // word id or null
    wordIdCounter:     0,
    usedWords:         new Set(),
    intervalId:        null,
    lastTick:          Date.now(),
  };
}

// ── Wave control ────────────────────────────────────────────────────────────
function startWave(room, n) {
  room.wave               = n;
  room.waveWordsSpawned   = 0;
  room.waveWordsDestroyed = 0;
  room.waveWordTarget     = getWaveConfig(n).wordTarget;
  room.inWaveClear        = false;
  room.waveClearTimer     = 0;
  room.spawnTimer         = 0;
  room.waveStartFlash     = 2.0;
}

// ── Spawn a word ─────────────────────────────────────────────────────────────
function spawnWord(room) {
  const cfg  = getWaveConfig(room.wave);
  let   pool = getWordPool(room.usedWords, room.wave);
  if (!pool.length) { room.usedWords.clear(); pool = getWordPool(room.usedWords, room.wave); }
  if (!pool.length) return;

  const text  = pool[Math.floor(Math.random() * pool.length)];
  room.usedWords.add(text);

  const angle = Math.random() * Math.PI * 2;
  const edge  = spawnOnEdge(angle);
  const dir   = Math.atan2(VCY - edge.y, VCX - edge.x);

  room.words.push({
    id:        room.wordIdCounter++,
    text,
    x:         edge.x,
    y:         edge.y,
    vx:        Math.cos(dir) * cfg.wordSpeed,
    vy:        Math.sin(dir) * cfg.wordSpeed,
    claimedBy: null,
  });
  room.waveWordsSpawned++;
}

// ── Destroy a word (server-authoritative) ────────────────────────────────────
function destroyWord(room, word, byPlayer) {
  room.score             += word.text.length * room.wave * 10;
  room.waveWordsDestroyed++;
  room.words              = room.words.filter(w => w.id !== word.id);

  for (let i = 0; i < 2; i++) {
    if (room.playerTargets[i] === word.id) {
      room.playerTargets[i] = null;
      room.playerInputs[i]  = '';
    }
  }
  io.to(room.code).emit('word_destroyed', { wordId: word.id, byPlayer });
}

// ── Resolve targeting for one player ────────────────────────────────────────
function resolveInput(room, pNum) {
  const input  = room.playerInputs[pNum];
  const other  = 1 - pNum;

  // Clear target if input is empty
  if (!input) {
    const prev = room.words.find(w => w.id === room.playerTargets[pNum]);
    if (prev && prev.claimedBy === pNum) prev.claimedBy = null;
    room.playerTargets[pNum] = null;
    return;
  }

  // Keep current target if still matching
  const curId  = room.playerTargets[pNum];
  const curWord = curId !== null ? room.words.find(w => w.id === curId) : null;

  if (curWord && curWord.text.startsWith(input)) {
    if (input === curWord.text) destroyWord(room, curWord, pNum);
    return;
  }

  // Release old claim
  if (curWord && curWord.claimedBy === pNum) curWord.claimedBy = null;
  room.playerTargets[pNum] = null;

  // Find new target: closest to base, not already claimed by other player
  let best = null, bestDist = Infinity;
  for (const w of room.words) {
    if (w.text.startsWith(input) && w.claimedBy !== other) {
      const d = Math.hypot(w.x - VCX, w.y - VCY);
      if (d < bestDist) { bestDist = d; best = w; }
    }
  }

  if (best) {
    room.playerTargets[pNum] = best.id;
    best.claimedBy           = pNum;
    if (input === best.text) destroyWord(room, best, pNum);
  }
}

// ── Broadcast full game state ────────────────────────────────────────────────
function broadcast(room) {
  io.to(room.code).emit('game_state', {
    state:          room.state,
    countdown:      room.countdown,
    hp:             room.hp,
    maxHp:          room.maxHp,
    score:          room.score,
    wave:           room.wave,
    inWaveClear:    room.inWaveClear,
    waveClearTimer: room.waveClearTimer,
    waveStartFlash: room.waveStartFlash,
    words: room.words.map(w => ({
      id: w.id, text: w.text,
      x: w.x,   y: w.y,
      claimedBy: w.claimedBy,
    })),
    players: [
      { input: room.playerInputs[0], targetId: room.playerTargets[0] },
      { input: room.playerInputs[1], targetId: room.playerTargets[1] },
    ],
  });
}

// ── Game tick ────────────────────────────────────────────────────────────────
function tick(room) {
  const now = Date.now();
  const dt  = Math.min((now - room.lastTick) / 1000, 0.1);
  room.lastTick = now;

  // ── Countdown before game starts ──
  if (room.state === 'starting') {
    room.countdownTimer -= dt;
    if (room.countdownTimer <= 0) {
      room.countdown--;
      if (room.countdown <= 0) {
        room.state = 'playing';
        startWave(room, 1);
      } else {
        room.countdownTimer = 1.0;
      }
    }
    broadcast(room);
    return;
  }

  if (room.state !== 'playing') return;

  // ── Timers ──
  if (room.waveStartFlash > 0) room.waveStartFlash -= dt;
  room.spawnTimer += dt * 1000;

  const cfg = getWaveConfig(room.wave);

  // ── Spawn ──
  if (!room.inWaveClear) {
    if (
      room.spawnTimer >= cfg.spawnInterval &&
      room.words.length < cfg.maxWords &&
      room.waveWordsSpawned < room.waveWordTarget
    ) {
      spawnWord(room);
      room.spawnTimer = 0;
    }
    if (room.waveWordsSpawned >= room.waveWordTarget && room.words.length === 0) {
      room.inWaveClear    = true;
      room.waveClearTimer = 2.8;
    }
  } else {
    room.waveClearTimer -= dt;
    if (room.waveClearTimer <= 0) startWave(room, room.wave + 1);
  }

  // ── Move ──
  for (const w of room.words) {
    w.x += w.vx * dt;
    w.y += w.vy * dt;
  }

  // ── Collision ──
  const hit = room.words.filter(w =>
    Math.hypot(w.x - VCX, w.y - VCY) <= BASE_RADIUS_V + 10
  );
  for (const w of hit) {
    const dmg  = Math.ceil(w.text.length * 1.5);
    room.hp    = Math.max(0, room.hp - dmg);
    for (let i = 0; i < 2; i++) {
      if (room.playerTargets[i] === w.id) {
        room.playerTargets[i] = null;
        room.playerInputs[i]  = '';
      }
    }
    room.words = room.words.filter(x => x.id !== w.id);
    io.to(room.code).emit('base_hit', { damage: dmg, hp: room.hp });

    if (room.hp <= 0) {
      room.state = 'gameover';
      io.to(room.code).emit('game_over', { score: room.score, wave: room.wave });
      clearInterval(room.intervalId);
      room.intervalId = null;
      setTimeout(() => rooms.delete(room.code), 120_000);
      return;
    }
  }

  broadcast(room);
}

// ── Socket.io connections ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ connected:', socket.id);

  socket.on('create_room', () => {
    const code = makeCode();
    const room = makeRoom(code);
    rooms.set(code, room);
    room.sockets.push(socket);
    socketRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('room_joined', { playerNum: 0, roomCode: code });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on('join_room', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) { socket.emit('room_error', { message: 'Room not found.' }); return; }
    if (room.sockets.length >= 2) { socket.emit('room_error', { message: 'Room is full.' }); return; }

    room.sockets.push(socket);
    socketRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('room_joined', { playerNum: 1, roomCode: code });
    room.sockets[0].emit('partner_connected');

    // Start countdown
    room.state          = 'starting';
    room.countdown      = 3;
    room.countdownTimer = 1.0;
    room.lastTick       = Date.now();
    room.intervalId     = setInterval(() => tick(room), TICK_MS);
    console.log(`Room ${code}: player 2 joined, starting countdown`);
  });

  socket.on('player_input', ({ text }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;

    const pNum = room.sockets.indexOf(socket);
    if (pNum === -1) return;

    room.playerInputs[pNum] = text || '';
    resolveInput(room, pNum);
  });

  socket.on('disconnect', () => {
    console.log('- disconnected:', socket.id);
    const code = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.sockets = room.sockets.filter(s => s.id !== socket.id);

    if (room.sockets.length === 0) {
      if (room.intervalId) clearInterval(room.intervalId);
      rooms.delete(code);
      console.log(`Room ${code} deleted (empty)`);
    } else {
      if (room.intervalId) { clearInterval(room.intervalId); room.intervalId = null; }
      room.sockets[0].emit('partner_left');
      console.log(`Room ${code}: partner left`);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () =>
  console.log(`Typing Defense server → http://localhost:${PORT}`)
);
