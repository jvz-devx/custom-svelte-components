const TILE_W = 142; // 2x of 71
const TILE_H = 190; // 2x of 95

// Native Balatro card render resolution — shaders operate at this size
// for the characteristic chunky pixel-art look
export const NATIVE_CARD_W = 71;
export const NATIVE_CARD_H = 95;

export const NATIVE_JOKER_W = 71;
export const NATIVE_JOKER_H = 95;

// Map rank to column index (matching Balatro's P_CARDS)
const RANK_COL: Record<string, number> = {
	'2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8,
	'J': 9, 'Q': 10, 'K': 11, 'A': 12
};

// Map suit to row index
const SUIT_ROW: Record<string, number> = {
	'hearts': 0, 'clubs': 1, 'diamonds': 2, 'spades': 3
};

export function getCardSpriteRegion(rank: string, suit: string): { x: number; y: number; w: number; h: number } {
	return {
		x: RANK_COL[rank] * TILE_W,
		y: SUIT_ROW[suit] * TILE_H,
		w: TILE_W,
		h: TILE_H
	};
}

let sheetImage: HTMLImageElement | null = null;
let sheetPromise: Promise<HTMLImageElement> | null = null;

function loadSheet(): Promise<HTMLImageElement> {
	if (sheetImage?.complete) return Promise.resolve(sheetImage);
	if (sheetPromise) return sheetPromise;
	sheetPromise = new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => { sheetImage = img; resolve(img); };
		img.onerror = reject;
		img.src = '/sprites/cards/playing-cards-sheet.png';
	});
	return sheetPromise;
}

export async function renderSpriteCard(rank: string, suit: string, width: number, height: number): Promise<HTMLCanvasElement> {
	const sheet = await loadSheet();
	const region = getCardSpriteRegion(rank, suit);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	// Draw card background first — Balatro sprites have opaque card backgrounds.
	// Our sprite sheet may have transparent areas, so we fill with the
	// standard Balatro card background color (cream/beige) to ensure
	// shaders like negative can invert the full card, not just the art.
	const r = width / 300; // scale factor
	const cornerRadius = Math.round(20 * r);
	ctx.fillStyle = '#f5f0e1'; // Balatro card background color
	ctx.beginPath();
	ctx.moveTo(cornerRadius, 0);
	ctx.lineTo(width - cornerRadius, 0);
	ctx.quadraticCurveTo(width, 0, width, cornerRadius);
	ctx.lineTo(width, height - cornerRadius);
	ctx.quadraticCurveTo(width, height, width - cornerRadius, height);
	ctx.lineTo(cornerRadius, height);
	ctx.quadraticCurveTo(0, height, 0, height - cornerRadius);
	ctx.lineTo(0, cornerRadius);
	ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
	ctx.closePath();
	ctx.fill();

	// Draw sprite on top with pixelated rendering
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(sheet, region.x, region.y, region.w, region.h, 0, 0, width, height);
	return canvas;
}

const jokerCache = new Map<string, HTMLImageElement>();

function loadJokerSprite(col: number, row: number): Promise<HTMLImageElement> {
	const key = `${col}x${row}`;
	const cached = jokerCache.get(key);
	if (cached?.complete) return Promise.resolve(cached);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => { jokerCache.set(key, img); resolve(img); };
		img.onerror = reject;
		img.src = `/sprites/jokers/joker_${col}x${row}.png`;
	});
}

export async function renderJokerSprite(
	col: number,
	row: number,
	width: number,
	height: number
): Promise<HTMLCanvasElement> {
	const sprite = await loadJokerSprite(col, row);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	// Draw card background (same cream as playing cards)
	const r = width / 300;
	const cornerRadius = Math.round(20 * r);
	ctx.fillStyle = '#f5f0e1';
	ctx.beginPath();
	ctx.moveTo(cornerRadius, 0);
	ctx.lineTo(width - cornerRadius, 0);
	ctx.quadraticCurveTo(width, 0, width, cornerRadius);
	ctx.lineTo(width, height - cornerRadius);
	ctx.quadraticCurveTo(width, height, width - cornerRadius, height);
	ctx.lineTo(cornerRadius, height);
	ctx.quadraticCurveTo(0, height, 0, height - cornerRadius);
	ctx.lineTo(0, cornerRadius);
	ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
	ctx.closePath();
	ctx.fill();

	// Draw joker sprite on top
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(sprite, 0, 0, width, height);
	return canvas;
}
