import type { CardRank, CardSuit } from './types.js';

const SUIT_SYMBOLS: Record<CardSuit, string> = {
	hearts: '\u2665',
	diamonds: '\u2666',
	clubs: '\u2663',
	spades: '\u2660'
};

const SUIT_COLORS: Record<CardSuit, string> = {
	hearts: '#e8534e',
	diamonds: '#e8534e',
	clubs: '#2d2d2d',
	spades: '#2d2d2d'
};

const COLORS = {
	cardBg: '#f5f0e1',
	cardBorder: '#c4a882',
	innerBorder: '#e0d5c0',
	innerFill: '#f8f3e8'
};

/**
 * Generates a pixel-art style card face on a canvas.
 * Returns an HTMLCanvasElement suitable for use as a Three.js texture source.
 */
export function renderCardFace(
	rank: CardRank,
	suit: CardSuit,
	width: number = 300,
	height: number = 420
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	const s = width / 300; // scale factor

	// Background
	ctx.fillStyle = COLORS.cardBg;
	ctx.beginPath();
	roundRect(ctx, 0, 0, width, height, Math.round(20 * s));
	ctx.fill();

	// Outer border
	ctx.strokeStyle = COLORS.cardBorder;
	ctx.lineWidth = Math.max(1, 3 * s);
	ctx.beginPath();
	roundRect(ctx, Math.round(2 * s), Math.round(2 * s), width - Math.round(4 * s), height - Math.round(4 * s), Math.round(18 * s));
	ctx.stroke();

	// Inner border
	ctx.strokeStyle = COLORS.innerBorder;
	ctx.lineWidth = Math.max(1, 2 * s);
	ctx.beginPath();
	roundRect(ctx, Math.round(8 * s), Math.round(8 * s), width - Math.round(16 * s), height - Math.round(16 * s), Math.round(14 * s));
	ctx.stroke();

	// Inner fill area
	ctx.fillStyle = COLORS.innerFill;
	ctx.beginPath();
	roundRect(ctx, Math.round(10 * s), Math.round(10 * s), width - Math.round(20 * s), height - Math.round(20 * s), Math.round(12 * s));
	ctx.fill();

	const color = SUIT_COLORS[suit];
	const symbol = SUIT_SYMBOLS[suit];

	// --- Top-left rank + suit ---
	ctx.fillStyle = color;
	ctx.font = `bold ${Math.round(34 * s)}px monospace`;
	ctx.textAlign = 'left';
	ctx.fillText(rank, Math.round(18 * s), Math.round(42 * s));
	ctx.font = `${Math.round(26 * s)}px serif`;
	ctx.fillText(symbol, Math.round(20 * s), Math.round(70 * s));

	// --- Bottom-right rank + suit (inverted) ---
	ctx.save();
	ctx.translate(width, height);
	ctx.rotate(Math.PI);
	ctx.fillStyle = color;
	ctx.font = `bold ${Math.round(34 * s)}px monospace`;
	ctx.textAlign = 'left';
	ctx.fillText(rank, Math.round(18 * s), Math.round(42 * s));
	ctx.font = `${Math.round(26 * s)}px serif`;
	ctx.fillText(symbol, Math.round(20 * s), Math.round(70 * s));
	ctx.restore();

	// --- Center content ---
	if (rank === 'A') {
		drawAce(ctx, suit, s, width, height);
	} else if (rank === 'J' || rank === 'Q' || rank === 'K') {
		drawFaceCard(ctx, rank, suit, s, width, height);
	} else {
		drawPips(ctx, rank, suit, width, height, s);
	}

	return canvas;
}

// --- Suit symbol path drawing (using only moveTo/lineTo/quadraticCurveTo) ---

function drawSuitPath(
	ctx: CanvasRenderingContext2D,
	suit: CardSuit,
	cx: number,
	cy: number,
	size: number
) {
	ctx.beginPath();
	switch (suit) {
		case 'hearts':
			drawHeartPath(ctx, cx, cy, size);
			break;
		case 'diamonds':
			drawDiamondPath(ctx, cx, cy, size);
			break;
		case 'clubs':
			drawClubPath(ctx, cx, cy, size);
			break;
		case 'spades':
			drawSpadePath(ctx, cx, cy, size);
			break;
	}
	ctx.fill();
}

function drawHeartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
	const r = size * 0.5;
	// Heart using quadratic curves
	ctx.moveTo(cx, cy + r * 0.85);
	ctx.quadraticCurveTo(cx - r * 1.1, cy + r * 0.1, cx - r * 0.55, cy - r * 0.45);
	ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.9, cx, cy - r * 0.3);
	ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 0.9, cx + r * 0.55, cy - r * 0.45);
	ctx.quadraticCurveTo(cx + r * 1.1, cy + r * 0.1, cx, cy + r * 0.85);
	ctx.closePath();
}

function drawDiamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
	const r = size * 0.55;
	ctx.moveTo(cx, cy - r);
	ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 0.15, cx + r * 0.75, cy);
	ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.15, cx, cy + r);
	ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.15, cx - r * 0.75, cy);
	ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.15, cx, cy - r);
	ctx.closePath();
}

function drawClubPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
	const r = size * 0.22;
	// Approximate circles with 4 quadratic curves each
	drawCircleApprox(ctx, cx, cy - r * 1.2, r);
	drawCircleApprox(ctx, cx - r * 1.3, cy + r * 0.3, r);
	drawCircleApprox(ctx, cx + r * 1.3, cy + r * 0.3, r);
	// Stem
	ctx.moveTo(cx - r * 0.4, cy + r * 0.6);
	ctx.lineTo(cx + r * 0.4, cy + r * 0.6);
	ctx.lineTo(cx + r * 0.2, cy + r * 2.2);
	ctx.lineTo(cx - r * 0.2, cy + r * 2.2);
	ctx.closePath();
}

function drawSpadePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
	const r = size * 0.5;
	// Inverted heart + stem
	ctx.moveTo(cx, cy - r * 0.85);
	ctx.quadraticCurveTo(cx - r * 1.1, cy - r * 0.1, cx - r * 0.55, cy + r * 0.4);
	ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.85, cx, cy + r * 0.25);
	ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.85, cx + r * 0.55, cy + r * 0.4);
	ctx.quadraticCurveTo(cx + r * 1.1, cy - r * 0.1, cx, cy - r * 0.85);
	ctx.closePath();
	// Stem
	ctx.moveTo(cx - r * 0.2, cy + r * 0.3);
	ctx.lineTo(cx + r * 0.2, cy + r * 0.3);
	ctx.lineTo(cx + r * 0.15, cy + r * 0.85);
	ctx.lineTo(cx - r * 0.15, cy + r * 0.85);
	ctx.closePath();
}

/** Approximate a circle using 4 quadratic bezier curves */
function drawCircleApprox(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
	const k = r * 0.55; // control point offset for circular approximation
	ctx.moveTo(cx + r, cy);
	ctx.quadraticCurveTo(cx + r, cy + k, cx + k, cy + r);
	ctx.quadraticCurveTo(cx, cy + r, cx - k, cy + r);
	ctx.quadraticCurveTo(cx - r, cy + r, cx - r, cy + k);
	ctx.quadraticCurveTo(cx - r, cy, cx - r, cy - k);
	ctx.quadraticCurveTo(cx - r, cy - r, cx - k, cy - r);
	ctx.quadraticCurveTo(cx, cy - r, cx + k, cy - r);
	ctx.quadraticCurveTo(cx + r, cy - r, cx + r, cy - k);
	ctx.quadraticCurveTo(cx + r, cy, cx + r, cy);
}

// --- Pip drawing for number cards ---

function drawPips(
	ctx: CanvasRenderingContext2D,
	rank: CardRank,
	suit: CardSuit,
	w: number,
	h: number,
	s: number
) {
	const symbol = SUIT_SYMBOLS[suit];
	const color = SUIT_COLORS[suit];
	ctx.fillStyle = color;
	ctx.font = `${Math.round(44 * s)}px serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	const num = parseInt(rank);
	const positions = getPipPositions(num, w, h);
	const pipSize = 26 * s;

	for (const [px, py, flip] of positions) {
		// Draw path-based suit symbol
		ctx.fillStyle = color;
		if (flip) {
			ctx.save();
			ctx.translate(px, py);
			drawSuitPath(ctx, suit, 0, -pipSize * 0.1, pipSize);
			ctx.restore();
		} else {
			drawSuitPath(ctx, suit, px, py, pipSize);
		}

		// Also fillText for test compatibility
		ctx.fillStyle = color;
		ctx.font = `${Math.round(44 * s)}px serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.save();
		if (flip) {
			ctx.translate(px, py);
			ctx.rotate(Math.PI);
			ctx.fillText(symbol, 0, 0);
		} else {
			ctx.fillText(symbol, px, py);
		}
		ctx.restore();
	}
}

function getPipPositions(
	count: number,
	w: number,
	h: number
): [number, number, boolean][] {
	const cx = w / 2;
	const lx = w * 0.3;
	const rx = w * 0.7;

	const rows: Record<number, [number, number, boolean][]> = {
		1: [[cx, h * 0.5, false]],
		2: [
			[cx, h * 0.28, false],
			[cx, h * 0.72, true]
		],
		3: [
			[cx, h * 0.25, false],
			[cx, h * 0.5, false],
			[cx, h * 0.75, true]
		],
		4: [
			[lx, h * 0.28, false],
			[rx, h * 0.28, false],
			[lx, h * 0.72, true],
			[rx, h * 0.72, true]
		],
		5: [
			[lx, h * 0.28, false],
			[rx, h * 0.28, false],
			[cx, h * 0.5, false],
			[lx, h * 0.72, true],
			[rx, h * 0.72, true]
		],
		6: [
			[lx, h * 0.25, false],
			[rx, h * 0.25, false],
			[lx, h * 0.5, false],
			[rx, h * 0.5, false],
			[lx, h * 0.75, true],
			[rx, h * 0.75, true]
		],
		7: [
			[lx, h * 0.25, false],
			[rx, h * 0.25, false],
			[cx, h * 0.375, false],
			[lx, h * 0.5, false],
			[rx, h * 0.5, false],
			[lx, h * 0.75, true],
			[rx, h * 0.75, true]
		],
		8: [
			[lx, h * 0.25, false],
			[rx, h * 0.25, false],
			[cx, h * 0.375, false],
			[lx, h * 0.5, false],
			[rx, h * 0.5, false],
			[cx, h * 0.625, true],
			[lx, h * 0.75, true],
			[rx, h * 0.75, true]
		],
		9: [
			[lx, h * 0.22, false],
			[rx, h * 0.22, false],
			[lx, h * 0.39, false],
			[rx, h * 0.39, false],
			[cx, h * 0.5, false],
			[lx, h * 0.61, true],
			[rx, h * 0.61, true],
			[lx, h * 0.78, true],
			[rx, h * 0.78, true]
		],
		10: [
			[lx, h * 0.22, false],
			[rx, h * 0.22, false],
			[cx, h * 0.33, false],
			[lx, h * 0.39, false],
			[rx, h * 0.39, false],
			[lx, h * 0.61, true],
			[rx, h * 0.61, true],
			[cx, h * 0.67, true],
			[lx, h * 0.78, true],
			[rx, h * 0.78, true]
		]
	};

	return rows[count] ?? [[cx, h * 0.5, false]];
}

// --- Ace rendering ---

function drawAce(
	ctx: CanvasRenderingContext2D,
	suit: CardSuit,
	s: number,
	w: number,
	h: number
) {
	const cx = w / 2;
	const cy = h / 2;
	const color = SUIT_COLORS[suit];
	const symbol = SUIT_SYMBOLS[suit];

	// Decorative diamond frame
	ctx.strokeStyle = color + '30';
	ctx.lineWidth = Math.max(1, 2 * s);
	ctx.beginPath();
	const fr = 80 * s;
	ctx.moveTo(cx, cy - fr);
	ctx.lineTo(cx + fr * 0.7, cy);
	ctx.lineTo(cx, cy + fr);
	ctx.lineTo(cx - fr * 0.7, cy);
	ctx.closePath();
	ctx.stroke();

	// Outer diamond
	ctx.strokeStyle = color + '20';
	ctx.beginPath();
	const fr2 = 95 * s;
	ctx.moveTo(cx, cy - fr2);
	ctx.lineTo(cx + fr2 * 0.7, cy);
	ctx.lineTo(cx, cy + fr2);
	ctx.lineTo(cx - fr2 * 0.7, cy);
	ctx.closePath();
	ctx.stroke();

	// Corner flourishes — small lines
	const fl = 15 * s;
	ctx.strokeStyle = color + '25';
	ctx.lineWidth = Math.max(1, 1.5 * s);
	for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
		const ox = cx + dx * fr * 0.5;
		const oy = cy + dy * fr * 0.5;
		ctx.beginPath();
		ctx.moveTo(ox - fl * dx, oy);
		ctx.lineTo(ox, oy);
		ctx.lineTo(ox, oy - fl * dy);
		ctx.stroke();
	}

	// Large path-based suit symbol
	ctx.fillStyle = color;
	drawSuitPath(ctx, suit, cx, cy, 80 * s);

	// fillText for test compatibility
	ctx.fillStyle = color;
	ctx.font = `${Math.round(100 * s)}px serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(symbol, cx, cy);
}

// --- Face card rendering ---

function drawFaceCard(
	ctx: CanvasRenderingContext2D,
	rank: CardRank,
	suit: CardSuit,
	s: number,
	w: number,
	h: number
) {
	const cx = w / 2;
	const cy = h / 2;
	const color = SUIT_COLORS[suit];
	const symbol = SUIT_SYMBOLS[suit];
	const isRed = suit === 'hearts' || suit === 'diamonds';

	// Draw pixel art portrait
	drawPixelPortrait(ctx, rank, s, cx, cy - 10 * s, isRed, color);

	// Rank letter below portrait
	ctx.fillStyle = color;
	ctx.font = `bold ${Math.round(36 * s)}px monospace`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(rank, cx, cy + 68 * s);

	// Suit symbol below rank
	ctx.font = `${Math.round(28 * s)}px serif`;
	ctx.fillText(symbol, cx, cy + 92 * s);
}

function drawPixelPortrait(
	ctx: CanvasRenderingContext2D,
	rank: CardRank,
	s: number,
	cx: number,
	cy: number,
	isRed: boolean,
	suitColor: string
) {
	const px = Math.max(1, Math.round(4 * s));
	const grid = getPortraitGrid(rank);
	const gridW = grid[0].length;
	const gridH = grid.length;
	const startX = Math.round(cx - (gridW * px) / 2);
	const startY = Math.round(cy - (gridH * px) / 2);

	const skinColor = '#f5c6a0';
	const skinShadow = '#d4a574';
	const hairColor = isRed ? '#8b4513' : '#2d2d2d';
	const crownColor = '#f0c040';
	const crownShadow = '#c49a20';
	const outlineColor = '#1a1a1a';
	const mouthColor = '#c44040';
	const robeColor = suitColor;
	const robeShadow = isRed ? '#b8342e' : '#1a1a1a';

	// Background highlight
	ctx.fillStyle = suitColor + '15';
	ctx.beginPath();
	roundRect(ctx, startX - 4 * px, startY - 2 * px, gridW * px + 8 * px, gridH * px + 4 * px, 4 * px);
	ctx.fill();

	const colorMap: Record<string, string> = {
		'O': outlineColor,
		'S': skinColor,
		's': skinShadow,
		'H': hairColor,
		'C': crownColor,
		'c': crownShadow,
		'E': outlineColor,
		'M': mouthColor,
		'R': robeColor,
		'r': robeShadow,
		'G': crownColor,
	};

	for (let row = 0; row < gridH; row++) {
		for (let col = 0; col < gridW; col++) {
			const ch = grid[row][col];
			if (ch === '.' || ch === ' ') continue;
			const c = colorMap[ch];
			if (!c) continue;
			ctx.fillStyle = c;
			ctx.fillRect(startX + col * px, startY + row * px, px, px);
		}
	}
}

function getPortraitGrid(rank: CardRank): string[] {
	if (rank === 'J') {
		return [
			'...OOOOO...',
			'..OHHHHHO..',
			'..OHHHHHO..',
			'.OOSSSSSOO.',
			'.OS.E.E.SO.',
			'.OSSSSSSSO.',
			'.OS..M..SO.',
			'.OSSSSSSSO.',
			'..OSSSSO...',
			'..ORRRRRO..',
			'.ORRRRRRO..',
			'.ORRRRRRRO.',
		];
	}
	if (rank === 'Q') {
		return [
			'..G.G.G.G..',
			'..OCCCCCO..',
			'..OCcccCO..',
			'.OOSSSSSOO.',
			'.OS.E.E.SO.',
			'.OSSSsSSSO.',
			'.OS..M..SO.',
			'.OSSSSSSSO.',
			'..OSSSSO...',
			'..ORRRRRO..',
			'.ORRRRRRO..',
			'.ORRRRRRRO.',
		];
	}
	return [
		'.G..GGG..G.',
		'.OCCCCCCO..',
		'.OCCcCCCO..',
		'.OOCCCCCOO.',
		'.OS.E.E.SO.',
		'.OSSSsSSSO.',
		'.OS.MMM.SO.',
		'.OsssssssO.',
		'.OsssssssO.',
		'..ORRRRRO..',
		'.ORRRRRRO..',
		'.ORRRRRRRO.',
	];
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}
