import { audioProxyUrl } from "./audio";

/**
 * 播放器单例 store（Svelte 5 runes）。
 *
 * 队列即"当前播放的专辑/列表"（产品约束：只能整张专辑顺序播放）。
 *
 * - 双 `<audio>` 元素预载：当前轨播放时下一轨 preload=auto，ended 时 swap，
 *   实现专辑内无间隙连播。
 * - Media Session API：系统媒体键 / 锁屏控制（nexttrack = 专辑下一首）。
 * - 专辑播完默认停止（产品约束），UI 提供 Replay / Repeat Album 两态。
 */

export type PlayableTrack = {
	trackId: string;
	title: string;
	artist?: string;
	albumTitle?: string;
	coverUrl?: string;
	durationSec?: number;
};

export type RepeatMode = "off" | "all";

const state = $state({
	queue: [] as PlayableTrack[],
	index: 0,
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	repeatMode: "off" as RepeatMode,
	shuffle: false,
	/** 洗牌后的播放顺序（存原索引） */
	shuffleOrder: [] as number[],
});

// 双 <audio> 元素：current 播放中，next 预载下一轨
let audioEls: [HTMLAudioElement, HTMLAudioElement] | null = null;
let activeSlot = 0;

function ensureAudioEls(): [HTMLAudioElement, HTMLAudioElement] {
	if (!audioEls) {
		audioEls = [new Audio(), new Audio()];
		for (const el of audioEls) {
			el.preload = "auto";
		}
		// 事件绑定统一由 initPlayer 完成，这里只创建
	}
	return audioEls;
}

function currentEl(): HTMLAudioElement {
	return ensureAudioEls()[activeSlot]!;
}

function bindEvents(el: HTMLAudioElement): void {
	el.addEventListener("timeupdate", () => {
		state.currentTime = el.currentTime;
	});
	el.addEventListener("loadedmetadata", () => {
		state.duration = el.duration;
	});
	el.addEventListener("play", () => {
		state.isPlaying = true;
	});
	el.addEventListener("pause", () => {
		state.isPlaying = false;
	});
	el.addEventListener("ended", () => {
		player.next();
	});
}

function loadInto(el: HTMLAudioElement, track: PlayableTrack): void {
	el.src = audioProxyUrl(track.trackId);
	el.load();
}

function preloadNext(): void {
	const nextTrack = state.queue[mapIndex(state.index) + 1];
	if (!nextTrack) return;
	const preloadEl = ensureAudioEls()[activeSlot === 0 ? 1 : 0]!;
	loadInto(preloadEl, nextTrack);
}

function safePlay(el: HTMLAudioElement): void {
	void el.play().catch(() => {
		state.isPlaying = false;
	});
}

function swapAndPlay(index: number): void {
	const target = state.queue[mapIndex(index)];
	if (!target) return;

	const nextSlot = activeSlot === 0 ? 1 : 0;
	// 若目标曲目已在预载槽，直接切槽；否则加载后切
	const preloaded = ensureAudioEls()[nextSlot]!;
	if (preloaded.src === audioProxyUrl(target.trackId)) {
		activeSlot = nextSlot;
		loadInto(preloaded, target); // 确保 metadata 就绪
	} else {
		loadInto(currentEl(), target);
	}
	state.index = index;
	state.currentTime = 0;
	state.duration = 0;
	safePlay(currentEl());
	preloadNext();
}

/** 播放顺序下的实际索引（shuffle 时映射），模块级纯函数 */
function mapIndex(playIndex: number): number {
	if (!state.shuffle || state.shuffleOrder.length === 0) return playIndex;
	return state.shuffleOrder[playIndex] ?? playIndex;
}

export const player = {
	get queue() {
		return state.queue;
	},
	get index() {
		return state.index;
	},
	get currentTrack(): PlayableTrack | null {
		return state.queue[mapIndex(state.index)] ?? null;
	},
	get isPlaying() {
		return state.isPlaying;
	},
	get currentTime() {
		return state.currentTime;
	},
	get duration() {
		return state.duration;
	},
	get progress() {
		return state.duration > 0 ? state.currentTime / state.duration : 0;
	},
	get hasNext() {
		return mapIndex(state.index) < state.queue.length - 1;
	},
	get hasPrevious() {
		return mapIndex(state.index) > 0;
	},
	get repeatMode() {
		return state.repeatMode;
	},
	get shuffle() {
		return state.shuffle;
	},

	/** 播放顺序下的实际索引（shuffle 时映射） */
	queueIndex(playIndex: number): number {
		return mapIndex(playIndex);
	},

	playQueue(queue: PlayableTrack[], startIndex = 0) {
		if (queue.length === 0) return;
		state.queue = queue;
		state.shuffleOrder = [];
		swapAndPlay(startIndex);
	},

	/** 专辑内洗牌：重新生成顺序，从当前曲目对应的新位置开始播 */
	toggleShuffle() {
		state.shuffle = !state.shuffle;
		if (!state.shuffle) {
			state.shuffleOrder = [];
			return;
		}
		const order = state.queue
			.map((_, i) => i)
			.filter((_, i) => i !== mapIndex(state.index));
		// Fisher-Yates
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[order[i], order[j]] = [order[j]!, order[i]!];
		}
		const currentPos = mapIndex(state.index);
		state.shuffleOrder = [currentPos, ...order];
		state.index = 0;
	},

	toggle() {
		const el = currentEl();
		if (el.paused) {
			safePlay(el);
		} else {
			el.pause();
		}
	},

	pause() {
		currentEl().pause();
	},

	next() {
		const nextIndex = state.index + 1;
		if (nextIndex < state.queue.length) {
			swapAndPlay(nextIndex);
		} else if (state.repeatMode === "all") {
			swapAndPlay(0);
		} else {
			// 专辑播完默认停止（产品约束：不自动接下一张）
			currentEl().pause();
			state.isPlaying = false;
		}
	},

	prev() {
		if (state.currentTime > 3) {
			this.seek(0);
			return;
		}
		if (state.index > 0) {
			swapAndPlay(state.index - 1);
		} else {
			this.seek(0);
		}
	},

	seek(seconds: number) {
		currentEl().currentTime = seconds;
	},

	/** 播完后的重播整张专辑（从第 1 首） */
	replayAlbum() {
		this.playQueue(state.queue, 0);
	},

	toggleRepeat() {
		state.repeatMode = state.repeatMode === "off" ? "all" : "off";
	},
};

/** 初始化：绑定事件 + Media Session（需在浏览器环境调用一次） */
export function initPlayer(): void {
	const els = ensureAudioEls();
	bindEvents(els[0]!);
	bindEvents(els[1]!);

	if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
		navigator.mediaSession.setActionHandler("play", () => player.toggle());
		navigator.mediaSession.setActionHandler("pause", () => player.toggle());
		navigator.mediaSession.setActionHandler("nexttrack", () => player.next());
		navigator.mediaSession.setActionHandler("previoustrack", () =>
			player.prev(),
		);
	}
	updateMediaSession();
}

function updateMediaSession(): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator))
		return;
	const track = state.queue[state.index];
	if (!track) return;

	navigator.mediaSession.metadata = new MediaMetadata({
		title: track.title,
		artist: track.artist ?? "",
		album: track.albumTitle ?? "",
		artwork: track.coverUrl
			? [{ src: track.coverUrl, sizes: "512x512", type: "image/jpeg" }]
			: [],
	});
	navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
}

// 播放状态变化时同步 Media Session（由组件在 $effect 中调用）
export function syncMediaSession(): void {
	updateMediaSession();
}
