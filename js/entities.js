import { canvas, ctx } from './canvas.js';
import { SHIELD_X, COLORS, WORD_COLORS } from './constants.js';

const SLOW_COLOR = '#44ccff';

export class SoloWord {
  constructor(text, speed, hp = 1) {
    this.x        = canvas.width + 30;
    this.y        = canvas.height * (0.1 + Math.random() * 0.8);
    this.text     = text;
    this.baseVx   = -speed;
    this.color    = WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)];
    this.reached  = false;
    this.opacity  = 0;
    this.maxHp    = hp;
    this.hp       = hp;
    this.hitFlash = 0;
  }

  update(dt, speedMult = 1) {
    this.opacity  = Math.min(1, this.opacity + dt * 3);
    if (this.hitFlash > 0) this.hitFlash -= dt * 4;
    this.x += this.baseVx * speedMult * dt;
    if (this.x <= SHIELD_X) this.reached = true;
  }

  draw(isTarget, currentInput = '') {
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

    // Background box
    ctx.fillStyle = 'rgba(5,5,16,0.65)';
    ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Border
    if (this.hitFlash > 0) {
      ctx.strokeStyle = `rgba(255,34,68,${this.hitFlash})`;
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
    } else if (isTarget) {
      ctx.strokeStyle = COLORS.wordTarget + '88';
      ctx.lineWidth   = 1;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
    }

    // Typed prefix
    if (typed) {
      ctx.fillStyle = COLORS.wordTyped;
      ctx.fillText(typed, sx, this.y);
    }

    // Remaining text
    ctx.fillStyle = this.hitFlash > 0 ? '#ff4466'
                  : isTarget ? COLORS.wordTarget : this.color;
    ctx.fillText(remaining, sx + typedW, this.y);

    // HP bar
    const barW = fullW + 10;
    const barH = 4;
    const barX = sx - 5;
    const barY = this.y - 13 - barH - 3;
    ctx.fillStyle   = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.shadowBlur  = 6;
    ctx.shadowColor = '#ff4466';
    ctx.fillStyle   = '#ff4466';
    ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    ctx.shadowBlur  = 0;

    ctx.restore();
  }
}

export class SoloPowerUp {
  constructor(text) {
    this.x       = canvas.width + 30;
    this.y       = canvas.height * (0.1 + Math.random() * 0.8);
    this.text    = text;
    this.type    = 'chain-lightning';
    this.baseVx  = -45;
    this.reached = false;
    this.opacity = 0;
    this.pulse   = 0;
  }

  update(dt, speedMult = 1) {
    this.opacity = Math.min(1, this.opacity + dt * 3);
    this.pulse   = (this.pulse + dt * 4) % (Math.PI * 2);
    this.x += this.baseVx * speedMult * dt;
    if (this.x <= SHIELD_X) this.reached = true;
  }

  draw(isTarget, currentInput = '') {
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

    // Background
    ctx.fillStyle = 'rgba(5,5,16,0.85)';
    ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Pulsing gold border
    const pa = 0.4 + 0.6 * Math.abs(Math.sin(this.pulse));
    ctx.strokeStyle = `rgba(255,220,0,${pa})`;
    ctx.lineWidth   = isTarget ? 2 : 1.5;
    ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Label
    ctx.font      = '9px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('CHAIN LIGHTNING', this.x, this.y - 22);
    ctx.font      = 'bold 17px "Courier New",monospace';
    ctx.textAlign = 'left';

    // Typed prefix
    if (typed) { ctx.fillStyle = COLORS.wordTyped; ctx.fillText(typed, sx, this.y); }

    // Remaining text
    ctx.fillStyle = isTarget ? '#ffdd00' : '#ffaa00';
    ctx.fillText(remaining, sx + typedW, this.y);

    ctx.restore();
  }
}

export class SoloSlowPowerUp {
  constructor(text) {
    this.x       = canvas.width + 30;
    this.y       = canvas.height * (0.1 + Math.random() * 0.8);
    this.text    = text;
    this.baseVx  = -45;
    this.reached = false;
    this.opacity = 0;
    this.pulse   = 0;
  }

  update(dt, speedMult = 1) {
    this.opacity = Math.min(1, this.opacity + dt * 3);
    this.pulse   = (this.pulse + dt * 4) % (Math.PI * 2);
    this.x += this.baseVx * speedMult * dt;
    if (this.x <= SHIELD_X) this.reached = true;
  }

  draw(isTarget, currentInput = '') {
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

    // Background
    ctx.fillStyle = 'rgba(5,5,16,0.85)';
    ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Pulsing cyan border
    const pa = 0.4 + 0.6 * Math.abs(Math.sin(this.pulse));
    ctx.strokeStyle = `rgba(68,204,255,${pa})`;
    ctx.lineWidth   = isTarget ? 2 : 1.5;
    ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Label
    ctx.font      = '9px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#44ccff';
    ctx.fillText('SLOW', this.x, this.y - 22);
    ctx.font      = 'bold 17px "Courier New",monospace';
    ctx.textAlign = 'left';

    // Typed prefix
    if (typed) { ctx.fillStyle = COLORS.wordTyped; ctx.fillText(typed, sx, this.y); }

    // Remaining text
    ctx.fillStyle = isTarget ? '#44ccff' : '#22aadd';
    ctx.fillText(remaining, sx + typedW, this.y);

    ctx.restore();
  }
}
