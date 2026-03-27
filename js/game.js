import { canvas, ctx } from './canvas.js';
import { COLORS, BASE_RADIUS, BASE_RADIUS_V } from './constants.js';
import { WORD_LIST } from './wordlist.js';
import { Network } from './network.js';
import { SoloGame } from './SoloGame.js';
import { SoloPowerUp, SoloSlowPowerUp, SoloFreezePowerUp } from './entities.js';
import { MultiGame } from './MultiGame.js';
import { drawParticles } from './particles.js';
import { drawLightningArcs } from './lightning.js';
import {
  drawGrid, drawShield, drawHUD, drawMenu, drawGameOver,
  drawActivePowerUps, drawWaveFlash, drawWaveClearFlash,
  drawBaseAt, drawHpBarAt, drawCentered,
  drawMultiWord, drawPlayerLabels,
} from './renderer.js';

export class Game {
  constructor() {
    // ── State ──────────────────────────────────────────────────────────────────
    this.state       = 'menu'; // 'menu' | 'lobby' | 'waiting' | 'playing' | 'gameover'
    this.gameMode    = 'solo'; // 'solo' | 'multi'
    this.myPlayerNum = 0;

    // ── Input ──────────────────────────────────────────────────────────────────
    this.currentInput = '';
    this.targetWord   = null;

    // ── Debug ──────────────────────────────────────────────────────────────────
    this.debugGodMode     = false;
    this.debugSlowEnemies = false;

    // ── Sub-systems ────────────────────────────────────────────────────────────
    this.solo    = new SoloGame();
    this.multi   = new MultiGame();
    this.network = new Network();

    this.lastTime = 0;

    this._bindButtons();
    this._bindInput();
    this._bindDebug();
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  startSolo() {
    this.gameMode     = 'solo';
    this.currentInput = '';
    this.targetWord   = null;
    this.solo.reset();
    this._showScreen(null);
    this.state = 'playing';
    this.solo.startWave(1);
  }

  // ── Screen helper ─────────────────────────────────────────────────────────────
  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    if (id) document.getElementById(id)?.classList.remove('hidden');
  }

  // ── Solo targeting ────────────────────────────────────────────────────────────
  // Each key press is validated letter-by-letter; wrong keys are silently ignored.
  _soloHandleKey(key) {
    const allTargets = [...this.solo.words, ...this.solo.powerUps];

    if (!this.targetWord || !allTargets.includes(this.targetWord)) {
      // No target — lock onto the closest word whose first letter matches
      let best = null, bestX = Infinity;
      for (const w of allTargets) {
        if (w.text[0] === key && w.x < bestX) { bestX = w.x; best = w; }
      }
      if (!best) return;
      this.targetWord   = best;
      this.currentInput = key;
    } else {
      // Locked target — only accept the next expected character
      if (key !== this.targetWord.text[this.currentInput.length]) return;
      this.currentInput += key;
    }

    this._handleTargetLetter();
  }

  _handleTargetLetter() {
    if (this.targetWord instanceof SoloPowerUp) {
      if (this.currentInput === this.targetWord.text) {
        const pu = this.targetWord;
        this.currentInput = '';
        this.targetWord   = null;
        this.solo.activateChainLightning(pu, w => this._onWordCleared(w));
      }
    } else if (this.targetWord instanceof SoloSlowPowerUp) {
      if (this.currentInput === this.targetWord.text) {
        const pu = this.targetWord;
        this.currentInput = '';
        this.targetWord   = null;
        this.solo.activateSlow(pu, w => this._onWordCleared(w));
      }
    } else if (this.targetWord instanceof SoloFreezePowerUp) {
      if (this.currentInput === this.targetWord.text) {
        const pu = this.targetWord;
        this.currentInput = '';
        this.targetWord   = null;
        this.solo.activateFreeze(pu, w => this._onWordCleared(w));
      }
    } else {
      this.solo.spawnBullet(this.targetWord);
      if (this.currentInput === this.targetWord.text) {
        this.targetWord.completed = true;
        this.currentInput = '';
        this.targetWord   = null;
      }
    }
  }

  _onWordCleared(w) {
    if (w === this.targetWord || w == null) {
      this.currentInput = '';
      this.targetWord   = null;
    }
  }

  // ── Network init ─────────────────────────────────────────────────────────────
  _initNetwork() {
    this.network.connect();

    this.network.on('onRoomJoined', ({ playerNum, roomCode }) => {
      this.myPlayerNum = playerNum;
      document.getElementById('waiting-code').textContent = roomCode;
      document.getElementById('waiting-msg').textContent  =
        playerNum === 0 ? 'Waiting for partner...' : 'Partner found! Starting...';
      this._showScreen('screen-waiting');
      this.state = 'waiting';
    });

    this.network.on('onRoomError', ({ message }) => {
      document.getElementById('lobby-error').textContent = message;
    });

    this.network.on('onPartnerConnected', () => {
      document.getElementById('waiting-msg').textContent = 'Partner connected! Starting...';
    });

    this.network.on('onPartnerLeft', () => {
      this._showScreen('screen-partner-left');
      this.state = 'menu';
      this.multi.reset();
      this.currentInput = '';
    });

    this.network.on('onGameState', (gs) => {
      if (this.state === 'waiting' && (gs.state === 'starting' || gs.state === 'playing')) {
        this._showScreen(null);
        this.state = 'playing';
      }
      this.multi.serverState = gs;
    });

    this.network.on('onWordDestroyed', ({ wordId, byPlayer }) => {
      this.multi.onWordDestroyed(wordId, byPlayer, this.myPlayerNum);
      const myTarget = this.multi.serverState?.players[this.myPlayerNum]?.targetId;
      if (myTarget === wordId) {
        this.currentInput = '';
      }
    });

    this.network.on('onBaseHit', () => {
      this.multi.onBaseHit();
    });

    this.network.on('onGameOver', () => {
      this.state = 'gameover';
      this.currentInput = '';
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────────
  _bindInput() {
    document.addEventListener('keydown', (e) => {
      if (this.state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') this.startSolo();
        return;
      }
      if (this.state === 'lobby' || this.state === 'waiting') return;

      if (this.state === 'gameover') {
        if (e.key === 'Enter') {
          if (this.gameMode === 'solo') this.startSolo();
          else { this._showScreen('screen-lobby'); this.state = 'lobby'; this.multi.reset(); }
        }
        return;
      }

      if (e.key === 'Escape') {
        this.currentInput = '';
        this.targetWord   = null;
        if (this.gameMode === 'multi') this.network.sendInput('');
        return;
      }
      if (e.key.length !== 1) return;

      if (this.gameMode === 'solo') {
        this._soloHandleKey(e.key);
      } else {
        // Multi: apply same letter-by-letter filter using server-echoed input length
        const serverInput = this.multi.serverState?.players[this.myPlayerNum]?.input ?? this.currentInput;
        const serverWords = this.multi.serverState?.words ?? [];
        const myTargetId  = this.multi.serverState?.players[this.myPlayerNum]?.targetId ?? null;
        const myTarget    = serverWords.find(w => w.id === myTargetId) ?? null;

        if (!myTarget) {
          // No lock yet — accept first-char match (server will lock)
          this.currentInput += e.key;
        } else {
          // Locked — only accept next char in the target word
          if (e.key !== myTarget.text[serverInput.length]) return;
          this.currentInput += e.key;
        }
        this.network.sendInput(this.currentInput);
      }
    });
  }

  // ── Button wiring ─────────────────────────────────────────────────────────────
  _bindButtons() {
    document.getElementById('btn-singleplayer')?.addEventListener('click', () => this.startSolo());

    document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
      this.gameMode = 'multi';
      this._initNetwork();
      document.getElementById('lobby-error').textContent = '';
      document.getElementById('room-code-input').value   = '';
      this._showScreen('screen-lobby');
      this.state = 'lobby';
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      document.getElementById('lobby-error').textContent = '';
      this.network.createRoom();
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const code = document.getElementById('room-code-input').value.trim();
      if (!code) { document.getElementById('lobby-error').textContent = 'Enter a room code.'; return; }
      document.getElementById('lobby-error').textContent = '';
      this.network.joinRoom(code);
    });

    document.getElementById('btn-lobby-back')?.addEventListener('click', () => {
      this._showScreen(null);
      this.state = 'menu';
    });

    document.getElementById('btn-partner-left-menu')?.addEventListener('click', () => {
      this._showScreen(null);
      this.state = 'menu';
    });
  }

  // ── Debug panel ───────────────────────────────────────────────────────────────
  _bindDebug() {
    const panel     = document.getElementById('debug-panel');
    const godBtn    = document.getElementById('debug-godmode');
    const slowBtn   = document.getElementById('debug-slow');
    const waveInput = document.getElementById('debug-wave-input');
    const waveBtn   = document.getElementById('debug-wave-btn');
    const chainBtn  = document.getElementById('debug-chain-lightning');
    const slowPuBtn   = document.getElementById('debug-slow-powerup');
    const freezePuBtn = document.getElementById('debug-freeze-powerup');
    const statusEl  = document.getElementById('debug-status');

    document.addEventListener('keydown', (e) => {
      if (e.key === '`') panel.classList.toggle('hidden');
    });

    godBtn.addEventListener('click', () => {
      this.debugGodMode    = !this.debugGodMode;
      godBtn.textContent   = this.debugGodMode ? 'ON' : 'OFF';
      godBtn.dataset.on    = this.debugGodMode;
      statusEl.textContent = this.debugGodMode ? 'god mode on' : 'god mode off';
    });

    slowBtn.addEventListener('click', () => {
      this.debugSlowEnemies = !this.debugSlowEnemies;
      slowBtn.textContent   = this.debugSlowEnemies ? 'ON' : 'OFF';
      slowBtn.dataset.on    = this.debugSlowEnemies;
      statusEl.textContent  = this.debugSlowEnemies ? 'slow enemies on' : 'slow enemies off';
    });

    chainBtn.addEventListener('click', () => {
      if (this.gameMode !== 'solo' || this.state !== 'playing') {
        statusEl.textContent = 'start solo first';
        return;
      }
      this.solo.activateChainLightning(null, w => this._onWordCleared(w));
      statusEl.textContent = 'chain lightning triggered';
    });

    slowPuBtn?.addEventListener('click', () => {
      if (this.gameMode !== 'solo' || this.state !== 'playing') {
        statusEl.textContent = 'start solo first';
        return;
      }
      this.solo.activateSlow(null, w => this._onWordCleared(w));
      statusEl.textContent = 'slow triggered';
    });

    freezePuBtn?.addEventListener('click', () => {
      if (this.gameMode !== 'solo' || this.state !== 'playing') {
        statusEl.textContent = 'start solo first';
        return;
      }
      this.solo.activateFreeze(null, w => this._onWordCleared(w));
      statusEl.textContent = 'freeze triggered';
    });

    waveBtn.addEventListener('click', () => {
      const n = parseInt(waveInput.value, 10);
      if (isNaN(n) || n < 1) { statusEl.textContent = 'invalid wave'; return; }
      if (this.gameMode !== 'solo' || this.state !== 'playing') {
        statusEl.textContent = 'start solo first';
        return;
      }
      this.currentInput = '';
      this.targetWord   = null;
      this.solo.jumpToWave(n);
      statusEl.textContent = `jumped to wave ${n}`;
    });
  }

  // ── Game loop ─────────────────────────────────────────────────────────────────
  loop(ts) {
    const dt      = Math.min((ts - this.lastTime) / 1000, 0.1);
    this.lastTime = ts;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.state === 'menu') {
      drawMenu();
      requestAnimationFrame(ts => this.loop(ts));
      return;
    }

    if (this.state === 'lobby' || this.state === 'waiting') {
      drawGrid();
      requestAnimationFrame(ts => this.loop(ts));
      return;
    }

    drawGrid();

    // ── Solo ──────────────────────────────────────────────────────────────────
    if (this.state === 'playing' && this.gameMode === 'solo') {
      this.solo.update(
        dt,
        WORD_LIST,
        this.debugSlowEnemies,
        this.debugGodMode,
        w => this._onWordCleared(w),
        () => { this.state = 'gameover'; },
      );

      drawShield(this.solo.hp, 100, this.solo.baseDamageFlash);
      drawParticles(this.solo.particles);
      drawLightningArcs(this.solo.lightningArcs);
      this._drawSoloProjectiles();
      for (const w  of this.solo.words)    w.draw(w  === this.targetWord || w.completed, w.completed ? w.text : this.currentInput);
      for (const pu of this.solo.powerUps) pu.draw(pu === this.targetWord, this.currentInput);
      drawHUD(this.solo.score, this.solo.wave);
      drawActivePowerUps(this.solo.activeChainLightning, this.solo.chainLightningTimer, this.solo.activeSlow, this.solo.slowTimer, this.solo.activeFreeze, this.solo.freezeTimer);
      if (this.solo.inWaveClear)
        drawWaveClearFlash(this.solo.wave, Math.min(1, this.solo.waveClearTimer * 1.5));
      else if (this.solo.waveStartFlash > 0)
        drawWaveFlash(this.solo.wave, Math.min(1, this.solo.waveStartFlash * 1.5));
    }

    // ── Multi ──────────────────────────────────────────────────────────────────
    if ((this.state === 'playing' || this.state === 'gameover') && this.gameMode === 'multi') {
      this.multi.update(dt);
      const ss = this.multi.serverState;
      if (ss) {
        drawParticles(this.multi.particles);
        for (const w of ss.words) drawMultiWord(w, ss, this.myPlayerNum);

        const scaleX = canvas.width / 1920;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const r  = BASE_RADIUS_V * scaleX;
        drawBaseAt(cx, cy, Math.min(r, BASE_RADIUS * 1.2), ss.hp, ss.maxHp, this.multi.baseDamageFlash);
        drawHpBarAt(cx, canvas.height - 28, ss.hp, ss.maxHp);
        drawHUD(ss.score, ss.wave);
        drawPlayerLabels(ss, this.myPlayerNum);

        if (ss.state === 'starting')
          drawCentered(ss.countdown.toString(), cy, 'bold 120px "Courier New",monospace', '#00ffcc', 60);

        if (ss.inWaveClear)
          drawWaveClearFlash(ss.wave, Math.min(1, ss.waveClearTimer * 1.5));
        else if (ss.waveStartFlash > 0)
          drawWaveFlash(ss.wave, Math.min(1, ss.waveStartFlash * 1.5));
      }
    }

    if (this.state === 'gameover') {
      const score = this.gameMode === 'solo' ? this.solo.score : (this.multi.serverState?.score ?? 0);
      const wave  = this.gameMode === 'solo' ? this.solo.wave  : (this.multi.serverState?.wave  ?? 1);
      drawGameOver(this.gameMode, score, wave);
    }

    requestAnimationFrame(ts => this.loop(ts));
  }

  _drawSoloProjectiles() {
    for (const p of this.solo.projectiles) {
      ctx.save();
      ctx.shadowBlur  = 12;
      ctx.shadowColor = COLORS.wordTyped;
      ctx.fillStyle   = COLORS.wordTyped;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  start() {
    requestAnimationFrame(ts => { this.lastTime = ts; this.loop(ts); });
  }
}
