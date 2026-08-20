import { createQuery } from "@tanstack/svelte-query";
import { orpc } from "$lib/orpc";
import { type PlayableTrack, player } from "$lib/player/player.svelte";

export function useAlbumList() {
	return createQuery(() =>
		orpc.albumList.queryOptions({ input: { limit: 24 } }),
	);
}

export function useAlbumDetail(id: string | undefined) {
	return createQuery(() =>
		orpc.albumDetail.queryOptions({
			input: { id: id ?? "" },
			enabled: !!id,
		}),
	);
}

export function toPlayableQueue(album: {
	id: string;
	title: string;
	artist: string;
	coverUrl?: string | null;
	tracks: Array<{
		id: string;
		title: string;
		durationSec?: number | null;
	}>;
}): PlayableTrack[] {
	return album.tracks.map((track) => ({
		trackId: track.id,
		title: track.title,
		artist: album.artist,
		albumTitle: album.title,
		coverUrl: album.coverUrl ?? undefined,
		durationSec: track.durationSec ?? undefined,
	}));
}

export function playAlbum(
	album: {
		id: string;
		title: string;
		artist: string;
		coverUrl?: string | null;
		tracks: Array<{
			id: string;
			title: string;
			durationSec?: number | null;
		}>;
	},
	startIndex = 0,
): void {
	player.playQueue(toPlayableQueue(album), startIndex);
}
