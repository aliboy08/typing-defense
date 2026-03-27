import { canvas, ctx } from './canvas.js';
import { COLORS, WORD_COLORS, SHIELD_X, BASE_RADIUS_V, CHAIN_LIGHTNING_DURATION, SLOW_DURATION, FREEZE_DURATION } from './constants.js';

export function drawGrid() {
	const spacing = 44;
	ctx.strokeStyle = 'rgba(0,255,204,0.035)';
	ctx.lineWidth = 1;
	for (let x = 0; x < canvas.width; x += spacing) {
		ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
	}
	for (let y = 0; y < canvas.height; y += spacing) {
		ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
	}
}

export function hpColor(pct) {
	return pct > 0.5 ? COLORS.hpHigh : pct > 0.25 ? COLORS.hpMid : COLORS.hpLow;
}

export function drawCentered(text, y, font, color, glow = 20) {
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.shadowBlur = glow;
	ctx.shadowColor = color;
	ctx.fillStyle = color;
	ctx.fillText(text, canvas.width / 2, y);
	ctx.shadowBlur = 0;
}

export function drawHUD(score, wave) {
	ctx.font = 'bold 15px "Courier New",monospace';
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';
	ctx.shadowBlur = 10;
	ctx.shadowColor = '#00ffcc';
	ctx.fillStyle = '#00ffcc';
	ctx.fillText(`SCORE  ${score}`, 18, 18);
	ctx.textAlign = 'right';
	ctx.shadowBlur = 10;
	ctx.shadowColor = '#ff8800';
	ctx.fillStyle = '#ff8800';
	ctx.fillText(`WAVE  ${wave}`, canvas.width - 18, 18);
	ctx.shadowBlur = 0;
}

export function drawBaseAt(cx, cy, radius, hp, maxHp, baseDamageFlash) {
	if (baseDamageFlash > 0) {
		ctx.save();
		ctx.globalAlpha = baseDamageFlash * 0.5;
		ctx.shadowBlur = 60;
		ctx.shadowColor = '#ff2244';
		ctx.strokeStyle = '#ff2244';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}
	ctx.shadowBlur = 28;
	ctx.shadowColor = COLORS.baseGlow;
	ctx.strokeStyle = COLORS.base;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(0,20,30,0.9)';
	ctx.beginPath();
	ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = COLORS.base + '44';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
	ctx.stroke();
	ctx.shadowBlur = 10;
	ctx.shadowColor = COLORS.base;
	ctx.fillStyle = COLORS.base;
	ctx.font = 'bold 15px "Courier New",monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(hp, cx, cy);
	ctx.shadowBlur = 0;
}

export function drawHpBarAt(cx, y, hp, maxHp) {
	const barW = 220, barH = 10;
	const x = cx - barW / 2;
	const pct = hp / maxHp;
	const col = hpColor(pct);
	ctx.fillStyle = 'rgba(0,0,0,0.6)';
	ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
	ctx.shadowBlur = 10;
	ctx.shadowColor = col;
	ctx.fillStyle = col;
	ctx.fillRect(x, y, barW * pct, barH);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#ffffff18';
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, barW, barH);
	ctx.font = '11px "Courier New",monospace';
	ctx.fillStyle = '#ffffff66';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillText('BASE HP', cx, y - 4);
}

export function drawShield(hp, maxHp, baseDamageFlash) {
	const w = SHIELD_X;
	const pct = hp / maxHp;
	const col = hpColor(pct);
	const edgeCol = baseDamageFlash > 0 ? '#ff2244' : col;

	ctx.fillStyle = 'rgba(0,0,20,0.75)';
	ctx.fillRect(0, 0, w, canvas.height);

	ctx.fillStyle = baseDamageFlash > 0
		? `rgba(255,34,68,${0.15 + baseDamageFlash * 0.25})`
		: col + '28';
	ctx.fillRect(0, canvas.height * (1 - pct), w, canvas.height * pct);

	if (baseDamageFlash > 0) {
		ctx.save();
		ctx.globalAlpha = baseDamageFlash * 0.35;
		ctx.fillStyle = '#ff2244';
		ctx.fillRect(0, 0, w, canvas.height);
		ctx.restore();
	}

	ctx.shadowBlur = 24;
	ctx.shadowColor = edgeCol;
	ctx.strokeStyle = edgeCol;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(w, 0);
	ctx.lineTo(w, canvas.height);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.font = 'bold 13px "Courier New",monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = col;
	ctx.fillText(hp, w / 2, canvas.height / 2);
}

export function drawActivePowerUps(activeChainLightning, chainLightningTimer, activeSlow, slowTimer, activeFreeze, freezeTimer) {
	const barW = 160, barH = 7;
	let row = 0;

	function drawBar(label, pct, color, bgColor) {
		const x = 18, y = 46 + row * 36;
		ctx.font = '10px "Courier New",monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = color;
		ctx.fillText(label, x, y - 14);
		ctx.fillStyle = bgColor;
		ctx.fillRect(x, y, barW, barH);
		ctx.shadowBlur = 6;
		ctx.shadowColor = color;
		ctx.fillStyle = color;
		ctx.fillRect(x, y, barW * pct, barH);
		ctx.shadowBlur = 0;
		ctx.strokeStyle = '#ffffff18';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, barW, barH);
		row++;
	}

	if (activeChainLightning)
		drawBar('⚡ CHAIN LIGHTNING', chainLightningTimer / CHAIN_LIGHTNING_DURATION, '#aaff00', '#1a2a1a');
	if (activeSlow)
		drawBar('◎ SLOW', slowTimer / SLOW_DURATION, '#44ccff', '#0a1a2a');
	if (activeFreeze)
		drawBar('❄ FREEZE', freezeTimer / FREEZE_DURATION, '#b4f0ff', '#0a1520');
}

export function drawWaveFlash(waveNum, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	drawCentered(`WAVE  ${waveNum}`, canvas.height / 2 - 110, 'bold 30px "Courier New",monospace', '#ff8800', 20);
	ctx.restore();
}

export function drawWaveClearFlash(waveNum, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	drawCentered(`WAVE ${waveNum} CLEAR!`, canvas.height / 2 - 110, 'bold 30px "Courier New",monospace', '#ffff00', 22);
	ctx.restore();
}

export function drawMenu() {
	drawGrid();
	const cy = canvas.height / 2;
	drawCentered('TYPING DEFENSE', cy - 70, 'bold 52px "Courier New",monospace', '#00ffcc', 40);
}

export function drawGameOver(gameMode, score, wave) {
	ctx.fillStyle = 'rgba(5,5,16,0.78)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	const cy = canvas.height / 2;
	drawCentered('GAME OVER', cy - 80, 'bold 60px "Courier New",monospace', '#ff2244', 40);
	drawCentered(`SCORE   ${score}`, cy - 8, 'bold 26px "Courier New",monospace', '#00ffcc', 18);
	drawCentered(`WAVE    ${wave}`, cy + 36, 'bold 26px "Courier New",monospace', '#ff8800', 18);
	const hint = gameMode === 'solo' ? 'PRESS ENTER TO RESTART' : 'PRESS ENTER FOR LOBBY';
	drawCentered(hint, cy + 96, 'bold 18px "Courier New",monospace', '#ffff00', 14);
}

export function drawMultiWord(word, serverState, myPlayerNum) {
	const scaleX = canvas.width / 1920;
	const scaleY = canvas.height / 1080;
	const x = word.x * scaleX;
	const y = word.y * scaleY;

	const isMyTarget = word.claimedBy === myPlayerNum;
	const isPartnerTarget = word.claimedBy === (1 - myPlayerNum) && word.claimedBy !== null;

	const typed = isMyTarget
		? (serverState?.players[myPlayerNum]?.input || '')
		: isPartnerTarget
			? (serverState?.players[1 - myPlayerNum]?.input || '')
			: '';

	const remaining = word.text.slice(typed.length);
	const typedColor = isMyTarget ? COLORS.wordTyped : COLORS.p2Typed;
	const restColor = isMyTarget ? COLORS.wordTarget
		: isPartnerTarget ? COLORS.p2Target
			: WORD_COLORS[word.id % WORD_COLORS.length];

	ctx.font = 'bold 17px "Courier New",monospace';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	const fullW = ctx.measureText(word.text).width;
	const typedW = ctx.measureText(typed).width;
	const sx = x - fullW / 2;

	ctx.fillStyle = 'rgba(5,5,16,0.65)';
	ctx.fillRect(sx - 5, y - 13, fullW + 10, 26);

	if (isMyTarget || isPartnerTarget) {
		ctx.strokeStyle = (isMyTarget ? COLORS.wordTarget : COLORS.p2Target) + '88';
		ctx.lineWidth = 1;
		ctx.strokeRect(sx - 5, y - 13, fullW + 10, 26);
	}

	if (typed) {
		ctx.shadowBlur = 12;
		ctx.shadowColor = typedColor;
		ctx.fillStyle = typedColor;
		ctx.fillText(typed, sx, y);
	}
	ctx.shadowBlur = (isMyTarget || isPartnerTarget) ? 18 : 8;
	ctx.shadowColor = restColor;
	ctx.fillStyle = restColor;
	ctx.fillText(remaining, sx + typedW, y);
	ctx.shadowBlur = 0;
}

export function drawPlayerLabels(serverState, myPlayerNum) {
	if (!serverState) return;
	const myCol = myPlayerNum === 0 ? COLORS.wordTyped : COLORS.p2Typed;
	const myLabel = myPlayerNum === 0 ? 'P1 (YOU)' : 'P2 (YOU)';
	const ptrLabel = myPlayerNum === 0 ? 'P2' : 'P1';
	const ptrCol = myPlayerNum === 0 ? COLORS.p2Typed : COLORS.wordTyped;

	ctx.font = '13px "Courier New",monospace';
	ctx.textBaseline = 'top';
	ctx.shadowBlur = 8;
	ctx.shadowColor = myCol;
	ctx.fillStyle = myCol;
	ctx.textAlign = 'left';
	ctx.fillText(`● ${myLabel}`, 18, canvas.height - 60);
	ctx.shadowBlur = 8;
	ctx.shadowColor = ptrCol;
	ctx.fillStyle = ptrCol;
	ctx.fillText(`● ${ptrLabel}`, 18, canvas.height - 42);
	ctx.shadowBlur = 0;
}
