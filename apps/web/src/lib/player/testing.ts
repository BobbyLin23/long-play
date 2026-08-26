import { createPlayer, type PlayableTrack } from "./player";

/** Seam 2: load an Album queue and drive `ended`. No stream or audio element. */

export { createPlayer };

export function albumTracks(titles: string[]): PlayableTrack[] {
	return titles.map((title, i) => ({
		trackId: `track-${i + 1}`,
		title,
		artist: "Aero",
		albumTitle: "Night Drive",
	}));
}
