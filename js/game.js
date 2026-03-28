import { canvas, ctx } from './canvas.js';
import { COLORS, BASE_RADIUS, BASE_RADIUS_V } from './constants.js';
import { WORD_LIST } from './wordlist.js';
import { Network } from './network.js';
import { SoloGame } from './SoloGame.js';
import { BasePowerUp } from './power_ups/BasePowerUp.js';
import { MultiGame } from './MultiGame.js';
import { drawParticles } from './particles.js';
import { drawLightningArcs } from './lightning.js';
import { pickRandomSkills, ALL_SKILLS } from './skills/index.js';
import {
  drawGrid, drawShield, drawHUD, drawMenu, drawGameOver,
  drawActivePowerUps, drawWaveFlash, drawWaveClearFlash,
  drawBaseAt, drawHpBarAt, drawCentered,
  drawMultiWord, drawPlayerLabels,
  drawXPBar, drawLevelUpScreen, drawActiveSkills,
} from './renderer.js';

export class Game {
  constructor() {
    // ── State ──────────────────────────────────────────────────────────────────
    this.state       = 'menu'; // 'menu'|'lobby'|'waiting'|'playing'|'levelup'|'gameover'
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

    // ── Level-up skill choices ─────────────────────────────────────────────────
    this.levelUpChoices = [];

    this.lastTime = 0;

    this._isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this._isMobile) document.body.classList.add('mobile');

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
    this._updateInputDisplay();
  }

  // ── Screen helper ─────────────────────────────────────────────────────────────
  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    if (id) document.getElementById(id)?.classList.remove('hidden');
  }

  // ── Level-up flow ─────────────────────────────────────────────────────────────
  _enterLevelUp() {
    const choices = pickRandomSkills(this.solo.skills, 3);
    if (choices.length === 0) {
      // All skills maxed — just advance with no choice
      this.solo.advanceLevel();
      this.state = 'playing';
      return;
    }
    this.levelUpChoices = choices;
    this.currentInput   = '';
    this.targetWord     = null;
    this.state          = 'levelup';
  }

  _applySkill(skill) {
    const currentTier = this.solo.skills[skill.id] || 0;
    const newTier     = currentTier + 1;
    this.solo.skills[skill.id] = newTier;
    skill.apply(this.solo, newTier);
    this.solo.advanceLevel();

    // Chain into another level-up if XP carried over
    if (this.solo.xp >= this.solo.xpToNext) {
      this.solo.pendingLevelUp = false;
      this._enterLevelUp();
    } else {
      this.state = 'playing';
    }
  }

  // ── Solo targeting ────────────────────────────────────────────────────────────
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
    if (this.targetWord instanceof BasePowerUp) {
      if (this.currentInput === this.targetWord.text) {
        const pu = this.targetWord;
        this.currentInput = '';
        this.targetWord   = null;
        this.solo.activatePowerUp(pu, w => this._onWordCleared(w));
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
      this._updateInputDisplay();
    }
  }

  _updateInputDisplay() {
    const el = document.getElementById('input-display');
    if (el) el.textContent = this.currentInput;
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

      // Level-up skill selection: 1, 2, 3 (desktop only; mobile handled via input event)
      if (this.state === 'levelup') {
        if (!this._isMobile && (e.key === '1' || e.key === '2' || e.key === '3')) {
          const idx   = parseInt(e.key) - 1;
          const skill = this.levelUpChoices[idx];
          if (skill) this._applySkill(skill);
        }
        return;
      }

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
        this._updateInputDisplay();
        return;
      }

      // On mobile, single-char keys are handled by the input event on #mobile-input
      if (this._isMobile) return;

      if (e.key.length !== 1) return;

      if (this.gameMode === 'solo') {
        this._soloHandleKey(e.key);
      } else {
        const serverInput = this.multi.serverState?.players[this.myPlayerNum]?.input ?? this.currentInput;
        const serverWords = this.multi.serverState?.words ?? [];
        const myTargetId  = this.multi.serverState?.players[this.myPlayerNum]?.targetId ?? null;
        const myTarget    = serverWords.find(w => w.id === myTargetId) ?? null;

        if (!myTarget) {
          this.currentInput += e.key;
        } else {
          if (e.key !== myTarget.text[serverInput.length]) return;
          this.currentInput += e.key;
        }
        this.network.sendInput(this.currentInput);
      }
    });

    if (this._isMobile) this._bindMobileInput();
  }

  // ── Mobile input ──────────────────────────────────────────────────────────────
  _bindMobileInput() {
    const mobileInput = document.getElementById('mobile-input');

    // Re-focus whenever it loses focus during active gameplay
    mobileInput.addEventListener('blur', () => {
      if (this.state === 'playing' || this.state === 'levelup') {
        setTimeout(() => mobileInput.focus(), 50);
      }
    });

    // Tap anywhere on the canvas/game area to (re)open the keyboard
    document.addEventListener('touchstart', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        mobileInput.focus();
      }
    }, { passive: true });

    mobileInput.addEventListener('input', (e) => {
      const char = e.data;
      mobileInput.value = ''; // always keep the field empty

      // Backspace / delete = clear current target (like Escape)
      if (!char || e.inputType === 'deleteContentBackward') {
        if (this.state === 'playing') {
          this.currentInput = '';
          this.targetWord   = null;
          if (this.gameMode === 'multi') this.network.sendInput('');
          this._updateInputDisplay();
        }
        return;
      }

      // Level-up: accept 1, 2, 3
      if (this.state === 'levelup') {
        if (char === '1' || char === '2' || char === '3') {
          const idx   = parseInt(char) - 1;
          const skill = this.levelUpChoices[idx];
          if (skill) this._applySkill(skill);
        }
        return;
      }

      if (this.state !== 'playing') return;
      if (!/^[a-zA-Z]$/.test(char)) return;

      const key = char.toLowerCase();
      if (this.gameMode === 'solo') {
        this._soloHandleKey(key);
      } else {
        const serverInput = this.multi.serverState?.players[this.myPlayerNum]?.input ?? this.currentInput;
        const serverWords = this.multi.serverState?.words ?? [];
        const myTargetId  = this.multi.serverState?.players[this.myPlayerNum]?.targetId ?? null;
        const myTarget    = serverWords.find(w => w.id === myTargetId) ?? null;

        if (!myTarget) {
          this.currentInput += key;
        } else {
          if (key !== myTarget.text[serverInput.length]) return;
          this.currentInput += key;
        }
        this.network.sendInput(this.currentInput);
      }

      this._updateInputDisplay();
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

    // ── Solo (playing + levelup share the same render base) ────────────────────
    if ((this.state === 'playing' || this.state === 'levelup') && this.gameMode === 'solo') {
      if (this.state === 'playing') {
        this.solo.update(
          dt,
          WORD_LIST,
          this.debugSlowEnemies,
          this.debugGodMode,
          w => this._onWordCleared(w),
          () => { this.state = 'gameover'; },
        );

        // Trigger level-up screen if XP threshold crossed
        if (this.solo.pendingLevelUp) {
          this.solo.pendingLevelUp = false;
          this._enterLevelUp();
        }
      }

      drawShield(this.solo.hp, this.solo.maxHp, this.solo.baseDamageFlash);
      drawParticles(this.solo.particles);
      drawLightningArcs(this.solo.lightningArcs);
      this._drawSoloProjectiles();
      for (const w  of this.solo.words)    w.draw(w  === this.targetWord || w.completed, w.completed ? w.text : this.currentInput);
      for (const pu of this.solo.powerUps) pu.draw(pu === this.targetWord, this.currentInput);
      drawHUD(this.solo.score, this.solo.wave);
      drawActivePowerUps(this.solo.activeChainLightning, this.solo.chainLightningTimer, this.solo.activeSlow, this.solo.slowTimer, this.solo.activeFreeze, this.solo.freezeTimer);
      drawXPBar(this.solo.xp, this.solo.xpToNext, this.solo.level);
      drawActiveSkills(ALL_SKILLS
        .filter(s => this.solo.skills[s.id])
        .map(s => ({ name: s.name, icon: s.icon, tier: this.solo.skills[s.id], maxTier: s.maxTier })));

      if (this.state === 'levelup') {
        drawLevelUpScreen(this.levelUpChoices, this.solo.skills, this.solo.level + 1);
      } else {
        if (this.solo.inWaveClear)
          drawWaveClearFlash(this.solo.wave, Math.min(1, this.solo.waveClearTimer * 1.5));
        else if (this.solo.waveStartFlash > 0)
          drawWaveFlash(this.solo.wave, Math.min(1, this.solo.waveStartFlash * 1.5));
      }
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
