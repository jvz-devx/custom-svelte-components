export type CardEdition = 'base' | 'foil' | 'polychrome' | 'negative';

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type CardRank =
	| 'A'
	| '2'
	| '3'
	| '4'
	| '5'
	| '6'
	| '7'
	| '8'
	| '9'
	| '10'
	| 'J'
	| 'Q'
	| 'K';

export type BalatroCardProps = {
	rank?: CardRank;
	suit?: CardSuit;
	edition?: CardEdition;
	width?: number;
	selected?: boolean;
	disabled?: boolean;
	played?: boolean;
	useSprites?: boolean;
	cardIndex?: number;
	onclick?: () => void;
	class?: string;
};
