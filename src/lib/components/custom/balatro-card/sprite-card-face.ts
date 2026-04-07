import type { CardRank, CardSuit } from './types.js';
import { renderCardFace } from './card-face.js';

const FACE_RANKS = ['J', 'Q', 'K'] as const;
const FACE_NAMES: Record<string, string> = { J: 'jack', Q: 'queen', K: 'king' };
const SUIT_COLORS: Record<CardSuit, string> = {
	hearts: '#e8534e',
	diamonds: '#e8534e',
	clubs: '#2d2d2d',
	spades: '#2d2d2d'
};
const SUIT_SYMBOLS: Record<CardSuit, string> = {
	hearts: '\u2665',
	diamonds: '\u2666',
	clubs: '\u2663',
	spades: '\u2660'
};

const spriteCache = new Map<string, HTMLImageElement>();

function loadSprite(path: string): Promise<HTMLImageElement> {
	const cached = spriteCache.get(path);
	if (cached?.complete) return Promise.resolve(cached);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			spriteCache.set(path, img);
			resolve(img);
		};
		img.onerror = reject;
		img.src = path;
	});
}

/**
 * Renders a card face using extracted sprite art for face cards (J/Q/K).
 * Falls back to procedural rendering for number cards and aces.
 */
export async function renderSpriteCardFace(
	rank: CardRank,
	suit: CardSuit,
	width: number = 300,
	height: number = 420
): Promise<HTMLCanvasElement> {
	// Only use sprites for face cards
	if (!FACE_RANKS.includes(rank as (typeof FACE_RANKS)[number])) {
		return renderCardFace(rank, suit, width, height);
	}

	const faceName = FACE_NAMES[rank];
	const spritePath = `/sprites/cards/${suit}_${faceName}.png`;

	let spriteImg: HTMLImageElement;
	try {
		spriteImg = await loadSprite(spritePath);
	} catch {
		// Fall back to procedural if sprite fails to load
		return renderCardFace(rank, suit, width, height);
	}

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	const s = width / 300;

	// Background
	ctx.fillStyle = '#f5f0e1';
	roundRect(ctx, 0, 0, width, height, Math.round(20 * s));
	ctx.fill();

	// Outer border
	ctx.strokeStyle = '#c4a882';
	ctx.lineWidth = Math.max(1, 3 * s);
	ctx.beginPath();
	roundRect(ctx, Math.round(2 * s), Math.round(2 * s), width - Math.round(4 * s), height - Math.round(4 * s), Math.round(18 * s));
	ctx.stroke();

	// Inner border
	ctx.strokeStyle = '#e0d5c0';
	ctx.lineWidth = Math.max(1, 2 * s);
	ctx.beginPath();
	roundRect(ctx, Math.round(8 * s), Math.round(8 * s), width - Math.round(16 * s), height - Math.round(16 * s), Math.round(14 * s));
	ctx.stroke();

	// Inner fill
	ctx.fillStyle = '#f8f3e8';
	ctx.beginPath();
	roundRect(ctx, Math.round(10 * s), Math.round(10 * s), width - Math.round(20 * s), height - Math.round(20 * s), Math.round(12 * s));
	ctx.fill();

	const color = SUIT_COLORS[suit];
	const symbol = SUIT_SYMBOLS[suit];

	// Top-left rank + suit
	ctx.fillStyle = color;
	ctx.font = `bold ${Math.round(34 * s)}px monospace`;
	ctx.textAlign = 'left';
	ctx.fillText(rank, Math.round(18 * s), Math.round(42 * s));
	ctx.font = `${Math.round(26 * s)}px serif`;
	ctx.fillText(symbol, Math.round(20 * s), Math.round(70 * s));

	// Bottom-right rank + suit (inverted)
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

	// Draw sprite face art centered
	const artAreaX = Math.round(55 * s);
	const artAreaY = Math.round(80 * s);
	const artAreaW = width - Math.round(110 * s);
	const artAreaH = height - Math.round(180 * s);

	// Scale sprite to fit art area while maintaining aspect ratio
	const spriteAspect = spriteImg.naturalWidth / spriteImg.naturalHeight;
	const areaAspect = artAreaW / artAreaH;
	let drawW: number, drawH: number, drawX: number, drawY: number;

	if (spriteAspect > areaAspect) {
		drawW = artAreaW;
		drawH = artAreaW / spriteAspect;
		drawX = artAreaX;
		drawY = artAreaY + (artAreaH - drawH) / 2;
	} else {
		drawH = artAreaH;
		drawW = artAreaH * spriteAspect;
		drawX = artAreaX + (artAreaW - drawW) / 2;
		drawY = artAreaY;
	}

	// Use pixelated rendering for the sprite art
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(spriteImg, drawX, drawY, drawW, drawH);
	ctx.imageSmoothingEnabled = true;

	// Suit symbol below art
	ctx.fillStyle = color;
	ctx.font = `${Math.round(28 * s)}px serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(symbol, width / 2, height - Math.round(40 * s));

	return canvas;
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
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
