import type { AlbumMeta } from "./types";

const SONG_COUNT = 17;
const SONG_URL = (n: number) =>
	`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

/**
 * 开发期占位专辑（无真实授权、非精选，仅用于联调播放/seek/连播）。
 * SoundHelix 提供 17 首程序生成 MP3，分成 3 张占位专辑。
 */
const PLACEHOLDER_ALBUMS: Array<{
	title: string;
	songRange: [number, number];
}> = [
	{ title: "SoundHelix Vol. 1", songRange: [1, 6] },
	{ title: "SoundHelix Vol. 2", songRange: [7, 12] },
	{ title: "SoundHelix Vol. 3", songRange: [13, SONG_COUNT] },
];

export function getSoundHelixAlbums(): AlbumMeta[] {
	return PLACEHOLDER_ALBUMS.map((album, albumIndex) => {
		const [start, end] = album.songRange;
		const tracks = [];
		for (let n = start; n <= end; n++) {
			tracks.push({
				title: `SoundHelix Song ${n}`,
				position: n - start + 1,
				streamUrl: SONG_URL(n),
			});
		}
		return {
			source: "soundhelix",
			externalId: String(albumIndex + 1),
			title: album.title,
			artist: "SoundHelix",
			coverUrl: "",
			license: "placeholder (dev only)",
			tracks,
		};
	});
}
