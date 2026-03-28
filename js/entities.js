import { canvas, ctx } from './canvas.js';
import { SHIELD_X, COLORS, WORD_COLORS } from './constants.js';

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
    this.frozen   = false;
  }

  update(dt, speedMult = 1) {
    this.opacity  = Math.min(1, this.opacity + dt * 3);
    if (this.hitFlash > 0) this.hitFlash -= dt * 4;
    if (!this.frozen) {
      this.x += this.baseVx * speedMult * dt;
      if (this.x <= SHIELD_X) this.reached = true;
    }
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
    ctx.fillStyle = isTarget ? 'rgba(40,18,0,0.85)' : 'rgba(5,5,16,0.65)';
    ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);

    // Border
    if (this.hitFlash > 0) {
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `rgba(255,34,68,${this.hitFlash})`;
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
    } else if (isTarget) {
      ctx.shadowBlur  = 22;
      ctx.shadowColor = COLORS.wordTarget;
      ctx.strokeStyle = COLORS.wordTarget;
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
      // Downward arrow above the HP bar
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = COLORS.wordTarget;
      ctx.beginPath();
      ctx.moveTo(this.x - 6, this.y - 34);
      ctx.lineTo(this.x + 6, this.y - 34);
      ctx.lineTo(this.x,     this.y - 27);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    // Typed prefix
    if (typed) {
      ctx.fillStyle = COLORS.wordTyped;
      ctx.fillText(typed, sx, this.y);
    }

    // Remaining text
    ctx.fillStyle = this.frozen    ? '#88eeff'
                  : this.hitFlash > 0 ? '#ff4466'
                  : isTarget ? COLORS.wordTarget : this.color;
    ctx.fillText(remaining, sx + typedW, this.y);

    // Frozen overlay
    if (this.frozen) {
      ctx.fillStyle = 'rgba(136,238,255,0.12)';
      ctx.fillRect(sx - 5, this.y - 13, fullW + 10, 26);
      ctx.strokeStyle = 'rgba(136,238,255,0.55)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(sx - 5, this.y - 13, fullW + 10, 26);
    }

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

