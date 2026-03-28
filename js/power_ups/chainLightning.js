import { canvas, ctx } from '../canvas.js';
import { SHIELD_X, COLORS } from '../constants.js';

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
    ctx.fillText('⚡ CHAIN LIGHTNING', this.x, this.y - 22);
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
