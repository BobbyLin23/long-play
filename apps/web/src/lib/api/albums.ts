import { createQuery } from "@tanstack/svelte-query";
import { orpc } from "$lib/orpc";
import { type PlayableTrack, player } from "$lib/player/player.svelte";

/**
 * 目录/播放的 web 端数据层封装。
 * 目录只到专辑级；播放 = 整张专辑（或整个收藏列表）。
 *
 * 注意：createQuery 返回 QueryObserverResult（Svelte 5 深度响应式对象），
 * 模板里直接访问 q.data / q.isPending 即可，不要解构（解构会丢失响应式）。
 */

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

/** 把专辑详情（含 tracks）转成可播放队列 */
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

/** 播放整张专辑（默认从第 1 首；startIndex 用于"从某曲开始播"） */
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
