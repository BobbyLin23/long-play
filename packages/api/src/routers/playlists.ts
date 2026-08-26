import type { Database } from "@long-play/db";
import { albums, playlistItems, playlists } from "@long-play/db/schema/music";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

/**
 * 用户收藏列表（收藏粒度 = 专辑）。
 * 所有操作需登录（protectedProcedure）且校验所有权。
 */

const playlistSummary = {
	id: playlists.id,
	name: playlists.name,
	description: playlists.description,
	createdAt: playlists.createdAt,
};

const albumSummary = {
	id: albums.id,
	source: albums.source,
	title: albums.title,
	artist: albums.artist,
	year: albums.year,
	coverUrl: albums.coverUrl,
};

const requireOwner = async (
	db: Database,
	playlistId: string,
	userId: string,
) => {
	const [row] = await db
		.select({ id: playlists.id })
		.from(playlists)
		.where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
		.limit(1);
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Playlist not found" });
	}
};

export const playlistList = protectedProcedure.handler(async ({ context }) => {
	const { db } = context;
	const userId = context.session!.user.id;
	const rows = await db
		.select({
			...playlistSummary,
			albumCount: count(playlistItems.id),
		})
		.from(playlists)
		.leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
		.where(eq(playlists.userId, userId))
		.groupBy(playlists.id)
		.orderBy(desc(playlists.createdAt));
	return rows;
});

const playlistCreateInput = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

export const playlistCreate = protectedProcedure
	.input(playlistCreateInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		const [row] = await db
			.insert(playlists)
			.values({ userId, name: input.name, description: input.description })
			.returning(playlistSummary);
		return row;
	});

const playlistIdInput = z.object({ id: z.string().uuid() });

export const playlistDetail = protectedProcedure
	.input(playlistIdInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		await requireOwner(db, input.id, userId);
		const [playlist] = await db
			.select(playlistSummary)
			.from(playlists)
			.where(eq(playlists.id, input.id))
			.limit(1);
		if (!playlist) {
			throw new ORPCError("NOT_FOUND", { message: "Playlist not found" });
		}

		const items = await db
			.select({
				...albumSummary,
				position: playlistItems.position,
				addedAt: playlistItems.addedAt,
			})
			.from(playlistItems)
			.innerJoin(albums, eq(playlistItems.albumId, albums.id))
			.where(eq(playlistItems.playlistId, input.id))
			.orderBy(asc(playlistItems.position));

		return { ...playlist, albums: items };
	});

export const playlistRename = protectedProcedure
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).max(100),
			description: z.string().max(500).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		await requireOwner(db, input.id, userId);
		const [row] = await db
			.update(playlists)
			.set({ name: input.name, description: input.description })
			.where(eq(playlists.id, input.id))
			.returning(playlistSummary);
		return row;
	});

export const playlistDelete = protectedProcedure
	.input(playlistIdInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		await requireOwner(db, input.id, userId);
		await db.delete(playlists).where(eq(playlists.id, input.id));
		return { ok: true };
	});

const playlistAddAlbumInput = z.object({
	playlistId: z.string().uuid(),
	albumId: z.string().uuid(),
});

export const playlistAddAlbum = protectedProcedure
	.input(playlistAddAlbumInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		await requireOwner(db, input.playlistId, userId);

		// 校验专辑存在
		const [album] = await db
			.select({ id: albums.id })
			.from(albums)
			.where(eq(albums.id, input.albumId))
			.limit(1);
		if (!album) {
			throw new ORPCError("NOT_FOUND", { message: "Album not found" });
		}

		// 重复收藏（playlistId, albumId 唯一）→ 幂等返回
		const [existing] = await db
			.select({ id: playlistItems.id })
			.from(playlistItems)
			.where(
				and(
					eq(playlistItems.playlistId, input.playlistId),
					eq(playlistItems.albumId, input.albumId),
				),
			)
			.limit(1);
		if (existing) return { ok: true, added: false };

		// 新条目 position = 当前最大 + 1
		const [last] = await db
			.select({ max: count(playlistItems.id) })
			.from(playlistItems)
			.where(eq(playlistItems.playlistId, input.playlistId));
		const nextPosition = (last?.max ?? 0) + 1;

		await db.insert(playlistItems).values({
			playlistId: input.playlistId,
			albumId: input.albumId,
			position: nextPosition,
		});
		return { ok: true, added: true };
	});

const playlistRemoveAlbumInput = z.object({
	playlistId: z.string().uuid(),
	albumId: z.string().uuid(),
});

export const playlistRemoveAlbum = protectedProcedure
	.input(playlistRemoveAlbumInput)
	.handler(async ({ input, context }) => {
		const { db } = context;
		const userId = context.session!.user.id;
		await requireOwner(db, input.playlistId, userId);
		await db
			.delete(playlistItems)
			.where(
				and(
					eq(playlistItems.playlistId, input.playlistId),
					eq(playlistItems.albumId, input.albumId),
				),
			);
		return { ok: true };
	});
