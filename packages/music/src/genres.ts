/**
 * Genre labels Taste will offer. Taken from Jamendo's featured selections
 * so admission and the quiz share one vocabulary.
 */
export const TASTE_GENRES = [
	"lounge",
	"classical",
	"electronic",
	"jazz",
	"pop",
	"hiphop",
	"relaxation",
	"rock",
	"songwriter",
	"world",
	"metal",
	"soundtrack",
] as const;

export type TasteGenre = (typeof TASTE_GENRES)[number];

const TASTE_GENRE_SET = new Set<string>(TASTE_GENRES);

const TAG_ALIASES: Record<string, TasteGenre> = {
	"hip-hop": "hiphop",
	hiphoprap: "hiphop",
	rap: "hiphop",
	ambient: "relaxation",
	chillout: "lounge",
	chill: "lounge",
	house: "electronic",
	techno: "electronic",
	trance: "electronic",
	dance: "electronic",
	folk: "songwriter",
	acoustic: "songwriter",
	"singer songwriter": "songwriter",
	singersongwriter: "songwriter",
	orchestral: "classical",
	film: "soundtrack",
	score: "soundtrack",
	latin: "world",
	celtic: "world",
	african: "world",
	hardrock: "metal",
	"hard rock": "metal",
};

export function genresFromJamendoTags(tags: string[]): TasteGenre[] {
	const found = new Set<TasteGenre>();
	for (const raw of tags) {
		const tag = raw.trim().toLowerCase();
		const mapped = TASTE_GENRE_SET.has(tag)
			? (tag as TasteGenre)
			: TAG_ALIASES[tag];
		if (mapped) found.add(mapped);
	}
	return TASTE_GENRES.filter((genre) => found.has(genre));
}
