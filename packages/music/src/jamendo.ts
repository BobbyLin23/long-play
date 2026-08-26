import { z } from "zod";

import { genresFromJamendoTags, type TasteGenre } from "./genres";
import type { AlbumMeta, TrackMeta } from "./types";

const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

const jamendoTrackSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	position: z.coerce.number().optional(),
	duration: z.coerce.number().optional(),
	audio: z.string(),
	license_ccurl: z.string().optional(),
});

const jamendoAlbumSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	artist_name: z.string().optional(),
	image: z.string().optional(),
	releasedate: z.string().optional(),
	tracks: z.array(jamendoTrackSchema).optional(),
});

const jamendoResponseSchema = z.object({
	results: z.array(jamendoAlbumSchema),
});

const jamendoTaggedTrackSchema = z.object({
	album_id: z.coerce.string(),
	musicinfo: z
		.object({
			tags: z
				.object({
					genres: z.array(z.string()).optional(),
				})
				.optional(),
		})
		.optional(),
});

const jamendoTracksResponseSchema = z.object({
	results: z.array(jamendoTaggedTrackSchema),
});

export type JamendoClientOptions = {
	clientId: string;
	fetchImpl?: typeof fetch;
};

export type JamendoSearchOptions = {
	/** 返回专辑数上限（Jamendo 免费档 35,000 次/月，按次计费需节制） */
	limit?: number;
	search?: string;
};

export function createJamendoClient(options: JamendoClientOptions) {
	const { clientId, fetchImpl = fetch } = options;

	async function getAlbums(
		params: JamendoSearchOptions = {},
	): Promise<AlbumMeta[]> {
		const url = new URL(`${JAMENDO_BASE}/albums/tracks/`);
		url.searchParams.set("client_id", clientId);
		url.searchParams.set("format", "json");
		url.searchParams.set("order", "popularity_total");
		url.searchParams.set("limit", String(params.limit ?? 20));
		if (params.search) {
			url.searchParams.set("search", params.search);
		}

		const data = await fetchJson(url, jamendoResponseSchema);
		const genreByAlbum = await getAlbumGenres(
			data.results.map((album) => String(album.id)),
		);
		return data.results.map((album) =>
			toAlbumMeta(album, genreByAlbum.get(String(album.id)) ?? []),
		);
	}

	async function fetchJson<T>(url: URL, schema: z.ZodType<T>): Promise<T> {
		const res = await fetchImpl(url);
		if (!res.ok) {
			throw new Error(`Jamendo API error: ${res.status} ${res.statusText}`);
		}
		return schema.parse(await res.json());
	}

	async function getAlbumGenres(
		albumIds: string[],
	): Promise<Map<string, TasteGenre[]>> {
		const entries = await Promise.all(
			albumIds.map(async (albumId) => {
				const url = new URL(`${JAMENDO_BASE}/tracks/`);
				url.searchParams.set("client_id", clientId);
				url.searchParams.set("format", "json");
				url.searchParams.set("include", "musicinfo");
				url.searchParams.set("limit", "200");
				url.searchParams.set("album_id", albumId);
				const data = await fetchJson(url, jamendoTracksResponseSchema);
				const tags = data.results.flatMap(
					(track) => track.musicinfo?.tags?.genres ?? [],
				);
				return [albumId, genresFromJamendoTags(tags)] as const;
			}),
		);
		return new Map(entries);
	}

	return { getAlbums };
}

function toAlbumMeta(
	album: z.infer<typeof jamendoAlbumSchema>,
	genres: TasteGenre[],
): AlbumMeta {
	const tracks: TrackMeta[] = (album.tracks ?? []).map((track, index) => ({
		title: track.name,
		position: track.position ?? index + 1,
		durationSec: track.duration,
		streamUrl: track.audio,
	}));
	tracks.sort((a, b) => a.position - b.position);

	return {
		source: "jamendo",
		externalId: String(album.id),
		title: album.name,
		artist: album.artist_name ?? "Unknown Artist",
		year: album.releasedate
			? Number.parseInt(album.releasedate.slice(0, 4), 10)
			: undefined,
		coverUrl: album.image ?? "",
		license: album.tracks?.[0]?.license_ccurl,
		genres,
		tracks,
	};
}
