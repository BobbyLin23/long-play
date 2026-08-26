import { resolve } from "node:path";
import { config } from "dotenv";

// 配置来自 apps/server/.env（与 drizzle.config.ts 一致），必须先于 db 模块加载
config({ path: resolve(process.cwd(), "../../apps/server/.env") });
config({ path: resolve(process.cwd(), "../../apps/server/.env.local") });

const [{ createJamendoClient }, { db }, { albums, tracks }] = await Promise.all(
	[import("@long-play/music"), import("../src"), import("../src/schema/music")],
);

/**
 * 幂等种子脚本：把精选专辑目录写入 DB。
 * - (source, externalId) 唯一 → upsert 幂等，重复执行不产生重复行。
 * - Jamendo 需要 JAMENDO_CLIENT_ID；SoundHelix 不写入产品货架。
 * - 音频不落库：streamUrl 存上游 URL，播放期由 Elysia 代理拉流。
 *
 * 用法：pnpm --filter @long-play/db seed
 */

const JAMENDO_ALBUM_COUNT = 20;

async function upsertAlbums(
	metas: Array<{
		source: string;
		externalId: string;
		title: string;
		artist: string;
		year?: number;
		coverUrl?: string;
		license?: string;
		genres?: string[];
		tracks: Array<{
			title: string;
			position: number;
			durationSec?: number;
			streamUrl: string;
		}>;
	}>,
) {
	let albumCount = 0;
	let trackCount = 0;

	for (const meta of metas) {
		const [album] = await db
			.insert(albums)
			.values({
				source: meta.source as never,
				externalId: meta.externalId,
				title: meta.title,
				artist: meta.artist,
				year: meta.year,
				coverUrl: meta.coverUrl,
				license: meta.license,
				genres: meta.genres ?? [],
			})
			.onConflictDoUpdate({
				target: [albums.source, albums.externalId],
				set: {
					title: meta.title,
					artist: meta.artist,
					year: meta.year,
					coverUrl: meta.coverUrl,
					license: meta.license,
					genres: meta.genres ?? [],
				},
			})
			.returning({ id: albums.id });

		for (const track of meta.tracks) {
			await db
				.insert(tracks)
				.values({
					albumId: album!.id,
					position: track.position,
					title: track.title,
					durationSec: track.durationSec,
					streamUrl: track.streamUrl,
				})
				.onConflictDoUpdate({
					target: [tracks.albumId, tracks.position],
					set: {
						title: track.title,
						durationSec: track.durationSec,
						streamUrl: track.streamUrl,
					},
				});
			trackCount++;
		}
		albumCount++;
	}

	return { albumCount, trackCount };
}

async function main() {
	const clientId = process.env.JAMENDO_CLIENT_ID;
	if (!clientId) {
		console.log("[seed] JAMENDO_CLIENT_ID not set, shelf stays empty");
		return;
	}

	try {
		const jamendo = createJamendoClient({ clientId });
		const albumsMeta = await jamendo.getAlbums({
			limit: JAMENDO_ALBUM_COUNT,
		});
		const jamendoResult = await upsertAlbums(albumsMeta);
		console.log(
			`[seed] Jamendo: ${jamendoResult.albumCount} albums, ${jamendoResult.trackCount} tracks`,
		);
	} catch (error) {
		console.error("[seed] Jamendo fetch failed, skipping:", error);
	}

	console.log("[seed] done");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
