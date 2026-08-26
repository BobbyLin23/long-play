import type { TasteGenre } from "./genres";

/**
 * 统一的专辑/曲目元数据模型。
 * 目录只到专辑级（产品硬约束：不支持单曲搜索/收藏），
 * tracks 仅作为专辑内部顺序播放使用。
 */
export type MusicSource = "jamendo" | "archive" | "soundhelix";

export type TrackMeta = {
	title: string;
	/** 曲目在专辑内的顺序（1-based） */
	position: number;
	/** 秒 */
	durationSec?: number;
	/** 上游规范音频 URL（代理按此拉流） */
	streamUrl: string;
};

export type AlbumMeta = {
	source: MusicSource;
	/** 上游专辑 ID（Jamendo album id / SoundHelix 占位编号） */
	externalId: string;
	title: string;
	artist: string;
	year?: number;
	coverUrl: string;
	/** 上游授权信息（license_ccurl / licenseurl） */
	license?: string;
	/** Genre labels (same vocabulary Taste uses) */
	genres: TasteGenre[];
	tracks: TrackMeta[];
};
