import { albums, tracks } from "@long-play/db/schema/music";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure } from "../index";

/**
 * 目录（Catalog）：只到专辑级（产品硬约束：不支持单曲搜索）。
 * tracks 仅作为专辑内部顺序播放使用，不暴露单曲级入口。
 */

const albumSummary = {
	id: albums.id,
	source: albums.source,
	title: albums.title,
	artist: albums.artist,
	year: albums.year,
	coverUrl: albums.coverUrl,
};

const onShelf = eq(albums.source, "jamendo");

const albumListInput = z.object({
	cursor: z.number().int().nonnegative().default(0),
	limit: z.number().int().positive().max(50).default(24),
});

export const albumList = publicProcedure
	.input(albumListInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const rows = await db
			.select({
				...albumSummary,
				trackCount: count(tracks.id),
			})
			.from(albums)
			.leftJoin(tracks, eq(tracks.albumId, albums.id))
			.where(onShelf)
			.groupBy(albums.id)
			.orderBy(asc(albums.title))
			.limit(input.limit)
			.offset(input.cursor);

		const total =
			(await db.select({ n: count() }).from(albums).where(onShelf))[0]?.n ?? 0;

		return {
			albums: rows,
			nextCursor:
				input.cursor + rows.length < total ? input.cursor + rows.length : null,
			total,
		};
	});

export const albumDetail = publicProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const { db } = context;
		const [album] = await db
			.select({
				...albumSummary,
				license: albums.license,
				genres: albums.genres,
			})
			.from(albums)
			.where(and(eq(albums.id, input.id), onShelf))
			.limit(1);
		if (!album) {
			throw new Error("Album not found");
		}

		const trackRows = await db
			.select({
				id: tracks.id,
				position: tracks.position,
				title: tracks.title,
				durationSec: tracks.durationSec,
			})
			.from(tracks)
			.where(eq(tracks.albumId, input.id))
			.orderBy(asc(tracks.position));

		return { ...album, tracks: trackRows };
	});
