import { audioProxyUrl } from "./audio";
import {
	createPlayer,
	createPlayerState,
	type PlayableTrack,
	type RepeatMode,
} from "./player";

/**
 * Browser adapter for the player module: dual <audio> elements, Media Session,
 * and Svelte 5 reactive state. Queue, skip, and `ended` live in `./player`.
 */

export type { PlayableTrack, RepeatMode };

const state = $state(createPlayerState());
const engine = createPlayer(state);

let audioEls: [HTMLAudioElement, HTMLAudioElement] | null = null;
let activeSlot = 0;

function ensureAudioEls(): [HTMLAudioElement, HTMLAudioElement] {
	if (!audioEls) {
		audioEls = [new Audio(), new Audio()];
		for (const el of audioEls) {
			el.preload = "auto";
		}
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
		engine.ended();
		syncAudio();
	});
}

function loadInto(el: HTMLAudioElement, track: PlayableTrack): void {
	el.src = audioProxyUrl(track.trackId);
	el.load();
}

function preloadNext(): void {
	const nextTrack = state.queue[engine.queueIndex(state.index) + 1];
	if (!nextTrack) return;
	const preloadEl = ensureAudioEls()[activeSlot === 0 ? 1 : 0]!;
	loadInto(preloadEl, nextTrack);
}

function safePlay(el: HTMLAudioElement): void {
	void el.play().catch(() => {
		engine.pause();
	});
}

function playCurrent(): void {
	const target = engine.currentTrack;
	if (!target) return;

	const nextSlot = activeSlot === 0 ? 1 : 0;
	const preloaded = ensureAudioEls()[nextSlot]!;
	if (preloaded.src === audioProxyUrl(target.trackId)) {
		activeSlot = nextSlot;
		loadInto(preloaded, target);
	} else {
		loadInto(currentEl(), target);
	}
	safePlay(currentEl());
	preloadNext();
}

function syncAudio(): void {
	if (engine.isPlaying) {
		playCurrent();
	} else {
		currentEl().pause();
	}
}

export const player = {
	get queue() {
		return engine.queue;
	},
	get index() {
		return engine.index;
	},
	get currentTrack(): PlayableTrack | null {
		return engine.currentTrack;
	},
	get isPlaying() {
		return engine.isPlaying;
	},
	get currentTime() {
		return engine.currentTime;
	},
	get duration() {
		return engine.duration;
	},
	get progress() {
		return engine.progress;
	},
	get hasNext() {
		return engine.hasNext;
	},
	get hasPrevious() {
		return engine.hasPrevious;
	},
	get repeatMode() {
		return engine.repeatMode;
	},
	get shuffle() {
		return engine.shuffle;
	},

	queueIndex(playIndex: number): number {
		return engine.queueIndex(playIndex);
	},

	playQueue(queue: PlayableTrack[], startIndex = 0) {
		engine.playQueue(queue, startIndex);
		syncAudio();
	},

	toggleShuffle() {
		engine.toggleShuffle();
	},

	toggle() {
		engine.toggle();
		if (engine.isPlaying) {
			safePlay(currentEl());
		} else {
			currentEl().pause();
		}
	},

	pause() {
		engine.pause();
		currentEl().pause();
	},

	next() {
		engine.next();
		syncAudio();
	},

	prev() {
		const indexBefore = engine.index;
		engine.prev();
		if (engine.index !== indexBefore) {
			syncAudio();
		} else {
			currentEl().currentTime = engine.currentTime;
		}
	},

	seek(seconds: number) {
		engine.seek(seconds);
		currentEl().currentTime = seconds;
	},

	replayAlbum() {
		engine.replayAlbum();
		syncAudio();
	},

	toggleRepeat() {
		engine.toggleRepeat();
	},
};

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
	const track = engine.currentTrack;
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

export function syncMediaSession(): void {
	updateMediaSession();
}
