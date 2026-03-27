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

// activeSkills: [{ name, icon, tier, maxTier }, ...]
export function drawActiveSkills(activeSkills) {
	if (!activeSkills.length) return;
	const lineH  = 17;
	const rightX = canvas.width - 18;
	const baseY  = canvas.height - 42; // sit above the XP bar

	ctx.font         = '10px "Courier New",monospace';
	ctx.textAlign    = 'right';
	ctx.textBaseline = 'bottom';

	for (let i = 0; i < activeSkills.length; i++) {
		const { name, icon, tier, maxTier } = activeSkills[activeSkills.length - 1 - i];
		let pips = '';
		for (let t = 1; t <= maxTier; t++) pips += t <= tier ? '●' : '○';
		ctx.shadowBlur  = 5;
		ctx.shadowColor = '#aa44ff';
		ctx.fillStyle   = '#cc88ff99';
		ctx.fillText(`${icon} ${name}  ${pips}`, rightX, baseY - i * lineH);
		ctx.shadowBlur  = 0;
	}
}

export function drawXPBar(xp, xpToNext, level) {
	const barW = 300, barH = 8;
	const cx   = canvas.width / 2;
	const y    = canvas.height - 22;
	const x    = cx - barW / 2;
	const pct  = Math.min(1, xp / xpToNext);

	ctx.fillStyle = 'rgba(0,0,0,0.6)';
	ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);

	ctx.shadowBlur  = 10;
	ctx.shadowColor = '#aa44ff';
	ctx.fillStyle   = '#aa44ff';
	ctx.fillRect(x, y, barW * pct, barH);
	ctx.shadowBlur  = 0;

	ctx.strokeStyle = '#ffffff22';
	ctx.lineWidth   = 1;
	ctx.strokeRect(x, y, barW, barH);

	ctx.font         = '10px "Courier New",monospace';
	ctx.textBaseline = 'bottom';
	ctx.shadowBlur   = 6;
	ctx.shadowColor  = '#aa44ff';
	ctx.fillStyle    = '#aa44ff';
	ctx.textAlign    = 'left';
	ctx.fillText(`LVL ${level}`, x, y - 3);
	ctx.shadowBlur   = 0;
	ctx.fillStyle    = '#ffffff55';
	ctx.textAlign    = 'right';
	ctx.fillText(`${xp} / ${xpToNext} XP`, x + barW, y - 3);
}

function _wrapText(text, cx, y, maxW, lineH) {
	const words = text.split(' ');
	let line = '';
	ctx.textAlign    = 'center';
	ctx.textBaseline = 'top';
	for (const word of words) {
		const test = line ? line + ' ' + word : word;
		if (ctx.measureText(test).width > maxW && line) {
			ctx.fillText(line, cx, y);
			line = word;
			y   += lineH;
		} else {
			line = test;
		}
	}
	if (line) ctx.fillText(line, cx, y);
}

export function drawLevelUpScreen(choices, playerSkills, newLevel) {
	// Darkened overlay (game is still visible behind)
	ctx.fillStyle = 'rgba(5,5,16,0.82)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const cy = canvas.height / 2;

	// Title
	drawCentered(`LEVEL  UP!`, cy - 160, 'bold 36px "Courier New",monospace', '#aa44ff', 35);
	drawCentered(`LEVEL ${newLevel}`, cy - 118, 'bold 18px "Courier New",monospace', '#ffffff88', 0);
	drawCentered('CHOOSE A SKILL  [ 1 ]  [ 2 ]  [ 3 ]', cy - 86, 'bold 13px "Courier New",monospace', '#ffff0099', 8);

	const cardW = 230, cardH = 145, gap = 28;
	const totalW = choices.length * cardW + (choices.length - 1) * gap;
	const startX = canvas.width / 2 - totalW / 2;

	for (let i = 0; i < choices.length; i++) {
		const skill       = choices[i];
		const currentTier = playerSkills[skill.id] || 0;
		const newTier     = currentTier + 1;
		const isUpgrade   = currentTier > 0;
		const cardCX      = startX + i * (cardW + gap) + cardW / 2;
		const cardY       = cy - 60;

		// Card background
		ctx.fillStyle = 'rgba(18,8,36,0.96)';
		ctx.fillRect(cardCX - cardW / 2, cardY, cardW, cardH);

		// Card border with glow
		ctx.shadowBlur  = 18;
		ctx.shadowColor = '#aa44ff';
		ctx.strokeStyle = '#aa44ff';
		ctx.lineWidth   = 1.5;
		ctx.strokeRect(cardCX - cardW / 2, cardY, cardW, cardH);
		ctx.shadowBlur  = 0;

		// Key hint badge
		ctx.font         = 'bold 14px "Courier New",monospace';
		ctx.textAlign    = 'center';
		ctx.textBaseline = 'top';
		ctx.shadowBlur   = 10;
		ctx.shadowColor  = '#ffff00';
		ctx.fillStyle    = '#ffff00';
		ctx.fillText(`[ ${i + 1} ]`, cardCX, cardY + 8);
		ctx.shadowBlur   = 0;

		// Skill icon + name
		ctx.font      = 'bold 13px "Courier New",monospace';
		ctx.fillStyle = '#ffffff';
		ctx.fillText(`${skill.icon}  ${skill.name}`, cardCX, cardY + 32);

		// Tier indicator (pips)
		const tierColor = isUpgrade ? '#ffcc00' : '#00ffcc';
		ctx.shadowBlur  = 6;
		ctx.shadowColor = tierColor;
		ctx.fillStyle   = tierColor;
		ctx.font        = '11px "Courier New",monospace';
		let pips = '';
		for (let t = 1; t <= skill.maxTier; t++) pips += t <= newTier ? '●' : '○';
		ctx.fillText(isUpgrade ? `UPGRADE  ${pips}` : `NEW!  ${pips}`, cardCX, cardY + 54);
		ctx.shadowBlur  = 0;

		// Description (word-wrapped)
		ctx.font      = '10px "Courier New",monospace';
		ctx.fillStyle = '#cccccc';
		_wrapText(skill.description(newTier), cardCX, cardY + 76, cardW - 24, 15);
	}
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
