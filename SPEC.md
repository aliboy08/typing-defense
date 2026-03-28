# Typing Defense — Specification

## Table of Contents
1. [Overview](#overview)
2. [Game States](#game-states)
3. [Core Mechanics](#core-mechanics)
4. [Wave System](#wave-system)
5. [XP and Leveling](#xp-and-leveling)
6. [Skills](#skills)
7. [Power-Ups](#power-ups)
8. [Entity Types](#entity-types)
9. [Hook System](#hook-system)
10. [Input System](#input-system)
11. [Renderer](#renderer)
12. [Debug Panel](#debug-panel)
13. [Multiplayer](#multiplayer)
14. [Constants](#constants)

---

## Overview

Browser-based typing defense game. Words (enemies) scroll left toward a shield. The player types words to fire bullets and destroy them before they reach the base. Destroying words earns XP; leveling up grants skill choices. Three power-up types spawn as typeable pickups. Stack of 12 skills (3 tiers each) modifies every aspect of play via a hook system.

**Tech:** Vanilla JS (ES modules), Canvas 2D, no framework. Express + Socket.io for multiplayer.

---

## Game States

```
menu ──► playing ──► levelup ──► playing ──► gameover ──► menu
              └──────────────────────────────────┘
       ┌──► lobby ──► waiting ──► playing
```

| State | Description | Entry |
|-------|-------------|-------|
| `menu` | Title screen | Initial load; gameover restart |
| `lobby` | Multiplayer room creation/join | Multiplayer button |
| `waiting` | Waiting for opponent | After creating/joining room |
| `playing` | Active gameplay | `startSolo()` / room ready |
| `levelup` | Skill selection (game paused) | `pendingLevelUp` flag set |
| `gameover` | End screen | HP reaches 0 |

### Transitions

- **`startSolo()`** → clears state, calls `solo.reset()`, enters `playing`, calls `startWave(1)`
- **`_enterLevelUp()`** → picks 3 random non-maxed skill choices, enters `levelup`; if all skills maxed, skips to next wave
- **`_applySkill(skill)`** → applies skill, advances level; if XP carried over chains another `_enterLevelUp()`
- **Game over callback** → enters `gameover`
- **Enter on gameover** → `startSolo()` (solo) or lobby (multi)

---

## Core Mechanics

### Targeting

- One word is targeted at a time (`game.targetWord`)
- On any keypress, find the **closest word** (lowest `x`) whose first letter matches — lock onto it
- Once locked, only the **next expected character** in sequence is accepted
- Each correct keystroke fires bullets toward the target
- Word destroyed when fully typed
- **Escape** (or backspace on mobile) clears current target

### Bullets

- Spawned at the shield edge (`x = 32`, `y ≈ target.y`)
- Speed: **700 px/s**
- Count per keystroke: `bulletCount` (base 1, modified by Double Shot skill)
- Multiple bullets spread vertically by 10px each: `offset = (i - (count-1)/2) * 10`
- On reaching target (`distance < 6px`): deal damage, run `onBulletHit` hooks
- Supports redirect via `onBulletRedirect` hook (piercing)

### Damage

1. Start with base damage = 1
2. Apply `onDamageCalc` reducer hooks (Critical Strike, etc.)
3. Subtract from `word.hp`; set `hitFlash = 0.5`
4. If `hp ≤ 0` → destroy word

### Word Destruction

1. Spawn particle burst
2. Remove from `words[]`
3. Award score: `word.text.length × wave × 10`
4. Award XP via `_awardXp(word)` (applies `onXpCalc` hooks)
5. Increment `consecutiveKills`
6. Run `onWordDestroyed` hooks (Overkill, Focus)
7. Clear player's input/target via callback

### Base Damage

- When a word reaches `x ≤ 32` it sets `reached = true`
- `SoloGame.update()` removes it and deals **10 HP** to the base
- Triggers `baseDamageFlash`, runs `onLethalHit` hook if resulting HP ≤ 0
- `consecutiveKills` resets to 0

### Scoring

`score += word.text.length × wave × 10`

Longer words on higher waves yield exponentially more points.

---

## Wave System

### Wave Config

```
wordSpeed:     40 + wave × 9          (px/s)
spawnInterval: max(500, 2300 - wave × 130)  (ms)
maxWords:      min(2 + wave, 14)
wordTarget:    7 + wave × 3           (words to spawn this wave)
wordLenMin:    min(3 + floor(wave/2), 12)
wordLenMax:    min(5 + wave, 20)
```

### Spawn Logic

Each frame: `spawnTimer += dt × 1000`. When `spawnTimer ≥ spawnInterval` and `words.length < maxWords` and `waveSpawned < waveTarget`:
- Pick a random unused word from the word list at the configured length range
- Create `SoloWord`, add to `words[]`, increment `waveSpawned`, reset timer
- Used words tracked in a `Set`; resets when pool exhausted

### Wave Clear

When `waveSpawned ≥ waveTarget && words.length === 0`:
- Set `inWaveClear = true`, `waveClearTimer = 2.8`
- Show "WAVE # CLEAR!" flash
- After 2.8s → `startWave(wave + 1)`

### Wave Start

- `startWave(n)`: reset counters, run `onWaveStart` hooks (resets Last Stand), show "WAVE #" flash
- Power-up timer continues across waves

---

## XP and Leveling

### XP Per Kill

```
base XP = word.text.length × wave
→ apply onXpCalc hooks (Greed, Scholar)
→ add to solo.xp
```

### Level Thresholds

```
xpForLevel(n) = 100 × 1.4^(n-1)

Level 1:  100 XP
Level 2:  140 XP
Level 3:  196 XP
Level 4:  274 XP
Level 5:  384 XP  …
```

### Level-Up Flow

1. `solo.xp ≥ solo.xpToNext` → set `pendingLevelUp = true`
2. Next frame: game enters `levelup` state
3. `pickRandomSkills(skills, 3)` → 3 non-maxed choices
4. Player presses **1 / 2 / 3** to select
5. `skill.apply(solo, newTier)` runs
6. `solo.advanceLevel()`: `xp -= xpToNext`, `level++`, recalc `xpToNext`
7. If `xp ≥ xpToNext` again → chain another level-up immediately

---

## Skills

All 12 skills have **3 tiers**. Tiers stack cumulatively (re-selecting upgrades to next tier). Skills are applied via hooks registered on `SoloGame`.

### Offensive

#### Double Shot `>>`
Fire multiple bullets per keystroke.

| Tier | Bullet count |
|------|-------------|
| 1 | 2 |
| 2 | 3 |
| 3 | 4 |

Formula: `bulletCount = 1 + tier`

---

#### Explosive Round `[*]`
Bullets deal splash damage to nearby enemies on hit.

| Tier | Splash damage | Radius |
|------|--------------|--------|
| 1 | 1 | 80 px |
| 2 | 2 | 100 px |
| 3 | 3 | 120 px |

Hook: `onBulletHit` — damages all words within radius except direct target.

---

#### Critical Strike `!!`
Chance to instantly destroy an enemy.

| Tier | Proc chance |
|------|------------|
| 1 | 15% |
| 2 | 25% |
| 3 | 35% |

Hook: `onDamageCalc` — if proc and not from chain/overkill, return `word.hp` as damage.

---

#### Overkill `XX`
Excess kill damage chains to nearby enemies.

| Tier | Chains |
|------|--------|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |

Hook: `onWordDestroyed` — finds nearest N enemies, applies excess damage recursively.

---

#### Piercing Shot `->`
Bullets penetrate through targets.

| Tier | Extra targets hit |
|------|------------------|
| 1 | +1 |
| 2 | +2 |
| 3 | +3 |

Hook: `onBulletRedirect` — when target destroyed, redirect bullet to nearest surviving word; decrement `pierceLeft`.

---

### Defensive

#### Fortify `##`
Permanent max HP increase + immediate heal.

| Tier | +Max HP | +Heal |
|------|---------|-------|
| 1 | +15 | +10 |
| 2 | +15 | +10 |
| 3 | +15 | +10 |

Max total: +45 HP (base 100 → 145). Applied immediately on pick.

---

#### Shield Regen `++`
Passive HP regeneration.

| Tier | Regen rate |
|------|-----------|
| 1 | +1 HP every 4s |
| 2 | +1 HP every 2s |
| 3 | +2 HP every 2s |

Hook: `onUpdate` — accumulates time, heals at interval, capped at `maxHp`.

---

#### Last Stand `**`
Survive one lethal hit per wave.

| Tier | Survive with |
|------|-------------|
| 1 | 1 HP |
| 2 | 3 HP |
| 3 | 6 HP |

Hook: `onLethalHit` — one-use per wave (resets on `onWaveStart`). Disabled in god mode.

---

### Utility

#### Greed `$$`
Bonus XP multiplier.

| Tier | XP multiplier |
|------|--------------|
| 1 | ×1.25 |
| 2 | ×1.50 |
| 3 | ×1.75 |

Hook: `onXpCalc` — `xp × (1 + tier × 0.25)`

---

#### Scholar `==`
Double XP for long words.

| Tier | Threshold |
|------|----------|
| 1 | ≥ 6 letters → ×2 XP |
| 2 | ≥ 5 letters → ×2 XP |
| 3 | ≥ 4 letters → ×2 XP |

Hook: `onXpCalc` — applies 2× if `word.text.length ≥ threshold`.

---

#### Focus `@@`
Bonus free bullet every N consecutive kills.

| Tier | Kills per bonus |
|------|----------------|
| 1 | every 5 kills |
| 2 | every 4 kills |
| 3 | every 3 kills |

Hook: `onWordDestroyed` — when `consecutiveKills % threshold === 0`, fire a free bullet from shield center to nearest word.

---

#### Slow Aura `~~`
Permanent passive enemy speed reduction.

| Tier | Speed reduction |
|------|----------------|
| 1 | −10% |
| 2 | −20% |
| 3 | −30% |

Hook: `onSpeedMult` — `speedMult × (1 - tier × 0.1)`. Stacks multiplicatively with Slow power-up.

---

## Power-Ups

Power-ups spawn as typeable pickups that move left like words. Type them to activate.

### Spawn Rules

- Spawn timer accumulates each frame
- When `powerUpTimer ≥ 12s` and `powerUps.length < 2`:
  - Reset timer
  - Pick random word (3–5 letters)
  - Pick random type (33% each: Chain Lightning, Slow, Freeze)
  - Spawn as appropriate `BasePowerUp` subclass
- Base velocity: **−45 px/s** (slower than words)
- Removed on reach if not typed

---

### Chain Lightning `⚡ CHAIN LIGHTNING`

**Color:** Gold (#ffdd00)

**On activation:**
1. Chain to up to 4 nearby words instantly, dealing 75% of each word's max HP
2. Lightning arcs drawn between chain targets
3. Activate 12-second active mode

**Active mode (12s):**
- Each bullet hit triggers a chain to 2 nearby enemies (1 damage each)
- Chain damage marked `fromChain` (bypasses Critical Strike)

---

### Slow `◎ SLOW`

**Color:** Cyan (#44ccff)

**On activation:**
- All enemies move at **35% normal speed** for **8 seconds**
- Stacks multiplicatively with Slow Aura skill

---

### Freeze `❄ FREEZE`

**Color:** Light cyan (#b4f0ff)

**On activation:**
- All current words instantly set `frozen = true`
- All words stop moving for **5 seconds**
- Frozen words display a cyan tint overlay
- On expiry, all words unfreeze

---

## Entity Types

### `SoloWord`

```
text       — the word string
x, y       — position (spawns at right edge)
baseVx     — negative velocity (set from wave config)
color      — random from WORD_COLORS
hp, maxHp  — = text.length initially
opacity    — 0→1 fade-in
hitFlash   — 0–0.5, decays; triggers red border
reached    — set when x ≤ 32 (base hit)
frozen     — from Freeze power-up
completed  — fully typed flag
```

Draw order: background box → border (glow if targeted, red if hit flash) → downward arrow if targeted → typed portion (cyan) + remaining (word color) → HP bar → frozen overlay.

---

### `BasePowerUp`

```
text        — word to type
x, y        — position
baseVx      — -45 px/s
reached     — if reached shield without being typed
opacity     — fade-in
pulse       — sine-wave animation (0–2π)
label       — e.g. "⚡ CHAIN LIGHTNING"
color, dimColor, borderRgb  — subclass-specific
```

Subclasses: `SoloChainLightningPowerUp`, `SoloSlowPowerUp`, `SoloFreezePowerUp`.

---

### Projectile

```
x, y        — current position
target      — word reference
speed       — 700 px/s
pierceLeft  — remaining pierce charges
```

---

### Particle

```
x, y        — position
vx, vy      — velocity
life        — 0–1, decays each frame
color       — hex string
size        — radius in pixels
```

---

### Lightning Arc

```
pts[]   — interpolated {x,y} points along arc
life    — 0–1, decays
```

---

## Hook System

Skills register handlers on `SoloGame` to modify behavior without coupling to core code.

### Registration

```javascript
solo.registerHook(event, skillId, fn)
// fn = (solo, ...args) → value (for reducers) | void (for side-effects)
// Re-registering the same skillId replaces the previous handler
```

### Hook Types

**Side-effect (`_runHooks`)** — each handler receives `(solo, ...args)`:

| Event | Trigger | Args |
|-------|---------|------|
| `onWaveStart` | New wave begins | — |
| `onUpdate` | Every frame | `dt` |
| `onWordDestroyed` | Enemy killed | `word, excessDmg` |
| `onBulletHit` | Bullet collides | `bullet` |

**Reducer (`_reduceHooks`)** — value threaded through handlers `(solo, value, ...args) → value`:

| Event | Initial value | Extra args |
|-------|--------------|-----------|
| `onDamageCalc` | `1` | `word, fromChain, fromOverkill` |
| `onXpCalc` | base XP | `word` |
| `onSpeedMult` | `1.0` | — |
| `onLethalHit` | `newHp` | `word, debugGodMode` |
| `onBulletRedirect` | `false` (keepAlive) | `bullet, excludeTarget` |

---

## Input System

### Desktop

| Context | Key | Action |
|---------|-----|--------|
| Menu | Enter / Space | Start solo game |
| Playing | Letter key | Target / type word |
| Playing | Escape | Clear target |
| Level-up | 1 / 2 / 3 | Select skill |
| Gameover | Enter | Restart / return to lobby |
| Any | `` ` `` | Toggle debug panel |

### Mobile

**Detection:** `'ontouchstart' in window || navigator.maxTouchPoints > 0`
**Class added to `<body>`:** `mobile`

**`#mobile-input`** — invisible `<input>` fixed to bottom of viewport:
- `font-size: 16px` prevents iOS auto-zoom
- Programmatically focused during `playing` / `levelup`; auto-refocuses on blur
- Tap on canvas (not a button/input) triggers `.focus()`

**`#input-display`** — shown only on `body.mobile`:
- Fixed bar at screen bottom, neon cyan text
- Shows `game.currentInput` — updated via `_updateInputDisplay()` after every change

**Mobile `input` event routing:**

| Input | Action |
|-------|--------|
| Letter (a–z) | Same as desktop keypress |
| Backspace / delete | Clear current target (= Escape) |
| 1 / 2 / 3 in levelup | Skill selection |

Single-char `keydown` events are **skipped** on mobile (handled exclusively via `input` event to avoid double-processing).

**Viewport meta:** `interactive-widget=resizes-visual` prevents Android Chrome from resizing the canvas when the virtual keyboard opens.

---

## Renderer

All drawing uses a 2D canvas that fills `window.innerWidth × window.innerHeight`. Logical coordinates are 1920×1080 and positions scale via `canvas.width / 1920`.

### Render Order (each frame)

1. Background fill (`#050510`)
2. `drawGrid()` — faint cyan grid lines at 44px spacing
3. `drawShield()` / `drawBaseAt()` — HP bar at left edge (solo) or circle (multi)
4. `drawParticles()` — particle burst effects
5. `drawLightningArcs()` — chain lightning visual
6. Projectiles — small 3px cyan dots
7. `word.draw()` for each word
8. `pu.draw()` for each power-up
9. `drawHUD()` — score (top-left), wave (top-right)
10. `drawActivePowerUps()` — timer bars for active effects
11. `drawXPBar()` — bottom-center purple XP bar
12. `drawActiveSkills()` — top-right skill list with tier pips
13. **If levelup:** `drawLevelUpScreen()` overlay — 3 skill cards
14. **If wave transitioning:** `drawWaveFlash()` / `drawWaveClearFlash()`
15. **If gameover:** `drawGameOver()` overlay

### Key Drawing Functions

| Function | Description |
|----------|-------------|
| `drawShield(hp, maxHp, flash)` | Left edge fill bar; color: green >50%, yellow 25–50%, red <25% |
| `drawHUD(score, wave)` | Score top-left, wave top-right |
| `drawXPBar(xp, xpToNext, level)` | Purple bar, level label, XP label |
| `drawActivePowerUps(...)` | Stacked timer bars (gold, cyan, light-cyan) |
| `drawActiveSkills(skills)` | Icon + name + tier pips (●/○) |
| `drawLevelUpScreen(choices, skills, level)` | Dark overlay + 3 skill cards (icon, name, tier, description) |
| `drawWaveFlash(n, alpha)` | Orange "WAVE N" centered text |
| `drawWaveClearFlash(n, alpha)` | Yellow "WAVE N CLEAR!" centered text |
| `drawGameOver(mode, score, wave)` | Red "GAME OVER", score, restart hint |
| `drawMenu()` | "TYPING DEFENSE" title centered |
| `drawMultiWord(word, ss, myNum)` | Multiplayer word with per-player color coding |
| `drawPlayerLabels(ss, myNum)` | Bottom-left P1/P2 labels |

---

## Debug Panel

Toggle: `` ` `` key. Fixed top-right corner, purple border.

| Control | Effect |
|---------|--------|
| **God Mode** toggle | HP cannot drop to 0; disables Last Stand |
| **Slow Enemies** toggle | All words move at 10% speed |
| **Set Wave** input + SET | Jump to any wave (clears current words) |
| **Chain Lightning** TRIGGER | Manually activate chain lightning power-up |
| **Slow** TRIGGER | Manually activate slow power-up |
| **Freeze** TRIGGER | Manually activate freeze power-up |

Trigger buttons require solo + playing state. Status text shows last action result.

---

## Multiplayer

Client infrastructure is present; server logic is in `server.js`.

**Network events (Socket.io):**

| Event | Direction | Payload |
|-------|-----------|---------|
| `room_joined` | Server → Client | `{ playerNum, roomCode }` |
| `room_error` | Server → Client | `{ message }` |
| `partner_connected` | Server → Client | — |
| `partner_left` | Server → Client | — |
| `game_state` | Server → Client | Full game state object |
| `word_destroyed` | Server → Client | `{ wordId, byPlayer }` |
| `base_hit` | Server → Client | — |
| `game_over` | Server → Client | — |
| `create_room` | Client → Server | — |
| `join_room` | Client → Server | `{ code }` |
| `input` | Client → Server | Current typed string |

**Render differences in multi:**
- Words drawn from server state (`ss.words`), not local arrays
- Word color encodes which player has it targeted
- Circular base at screen center instead of left-edge shield
- Countdown overlay during starting state
- Player labels bottom-left

---

## Constants

```javascript
// Layout
SHIELD_X = 32          // px, left edge shield position
BASE_RADIUS = 42       // solo base circle radius (unused in solo)
BASE_RADIUS_V = 50     // multiplayer base radius

// Timing
CHAIN_LIGHTNING_DURATION = 12   // seconds
SLOW_DURATION = 8               // seconds
FREEZE_DURATION = 5             // seconds
SLOW_MULTIPLIER = 0.35          // 35% of normal speed

// Colors
COLORS.bg            = '#050510'
COLORS.base          = '#00ffcc'
COLORS.hpHigh        = '#00ff88'    // > 50% HP
COLORS.hpMid         = '#ffcc00'    // 25–50% HP
COLORS.hpLow         = '#ff4466'    // < 25% HP
COLORS.wordTyped     = '#00ffcc'
COLORS.wordTarget    = '#ff8800'
COLORS.p2Typed       = '#aaff00'
COLORS.p2Target      = '#aa44ff'

WORD_COLORS = ['#ff44aa', '#ff8800', '#cc44ff', '#ff6644', '#ffcc00']
```
