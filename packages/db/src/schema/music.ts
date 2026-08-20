import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const musicSource = pgEnum("music_source", [
	"jamendo",
	"archive",
	"soundhelix",
]);

/** 目录：一张专辑（来源可为 jamendo / archive / soundhelix） */
export const albums = pgTable(
	"albums",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		source: musicSource("source").notNull(),
		/** 上游专辑 ID（Jamendo album id / SoundHelix 占位编号） */
		externalId: text("external_id").notNull(),
		title: text("title").notNull(),
		artist: text("artist").notNull(),
		year: integer("year"),
		coverUrl: text("cover_url"),
		/** 上游授权信息（license_ccurl / licenseurl），用于白名单筛选 */
		license: text("license"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("albums_source_external_id_idx").on(
			table.source,
			table.externalId,
		),
	],
);

/** 目录：专辑内曲目 */
export const tracks = pgTable(
	"tracks",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		albumId: uuid("album_id")
			.notNull()
			.references(() => albums.id, { onDelete: "cascade" }),
		/** 官方曲序，从 1 起 */
		position: integer("position").notNull(),
		title: text("title").notNull(),
		/** 秒 */
		durationSec: integer("duration_sec"),
		/** 上游规范音频 URL（代理按此拉流） */
		streamUrl: text("stream_url").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("tracks_album_id_position_idx").on(
			table.albumId,
			table.position,
		),
		index("tracks_album_id_idx").on(table.albumId),
	],
);

/** 用户收藏列表（收藏粒度 = 专辑） */
export const playlists = pgTable(
	"playlists",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("playlists_user_id_idx").on(table.userId)],
);

/** 列表条目（专辑 ↔ 列表，带顺序） */
export const playlistItems = pgTable(
	"playlist_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlists.id, { onDelete: "cascade" }),
		albumId: uuid("album_id")
			.notNull()
			.references(() => albums.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		addedAt: timestamp("added_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("playlist_items_playlist_album_idx").on(
			table.playlistId,
			table.albumId,
		),
		uniqueIndex("playlist_items_playlist_position_idx").on(
			table.playlistId,
			table.position,
		),
		index("playlist_items_album_id_idx").on(table.albumId),
	],
);

export const albumRelations = relations(albums, ({ many }) => ({
	tracks: many(tracks),
}));

export const trackRelations = relations(tracks, ({ one }) => ({
	album: one(albums, {
		fields: [tracks.albumId],
		references: [albums.id],
	}),
}));

export const playlistRelations = relations(playlists, ({ many, one }) => ({
	items: many(playlistItems),
	owner: one(user, {
		fields: [playlists.userId],
		references: [user.id],
	}),
}));

export const playlistItemRelations = relations(playlistItems, ({ one }) => ({
	playlist: one(playlists, {
		fields: [playlistItems.playlistId],
		references: [playlists.id],
	}),
	album: one(albums, {
		fields: [playlistItems.albumId],
		references: [albums.id],
	}),
}));
