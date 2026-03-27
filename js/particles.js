import { ctx } from './canvas.js';

export function spawnParticles(store, x, y, color) {
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i / 14) + Math.random() * 0.4;
    const spd   = 60 + Math.random() * 100;
    store.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1.0,
      color,
      size: 2 + Math.random() * 2.5,
    });
  }
}

export function updateParticles(store, dt) {
  for (const p of store) {
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vx   *= 0.93;
    p.vy   *= 0.93;
    p.life -= dt * 2.2;
  }
  return store.filter(p => p.life > 0);
}

export function drawParticles(store) {
  for (const p of store) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
