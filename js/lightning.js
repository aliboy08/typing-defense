import { ctx } from './canvas.js';

export function createLightningPoints(x1, y1, x2, y2) {
  const segs  = 8;
  const dx    = x2 - x1, dy = y2 - y1;
  const len   = Math.hypot(dx, dy);
  const perpX = -dy / len, perpY = dx / len;
  const pts   = [{ x: x1, y: y1 }];
  for (let i = 1; i < segs; i++) {
    const t   = i / segs;
    const off = (Math.random() - 0.5) * Math.min(50, len * 0.35);
    pts.push({ x: x1 + dx * t + perpX * off, y: y1 + dy * t + perpY * off });
  }
  pts.push({ x: x2, y: y2 });
  return { pts, life: 1.0 };
}

export function updateLightningArcs(arcs, dt) {
  for (const a of arcs) a.life -= dt * 2.5;
  return arcs.filter(a => a.life > 0);
}

export function drawLightningArcs(arcs) {
  for (const a of arcs) {
    ctx.save();
    ctx.globalAlpha = a.life;
    ctx.strokeStyle = '#aaff00';
    ctx.shadowBlur  = 18;
    ctx.shadowColor = '#aaff00';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(a.pts[0].x, a.pts[0].y);
    for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
    ctx.stroke();
    ctx.restore();
  }
}
