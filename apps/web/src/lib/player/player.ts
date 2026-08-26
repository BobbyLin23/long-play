export type PlayableTrack = {
	trackId: string;
	title: string;
	artist?: string;
	albumTitle?: string;
	coverUrl?: string;
	durationSec?: number;
};

export type RepeatMode = "off" | "all";

/** Seam 2: Album queue, skip, and `ended`. Audio is an adapter, not this module. */

export type PlayerState = {
	queue: PlayableTrack[];
	index: number;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	repeatMode: RepeatMode;
	shuffle: boolean;
	shuffleOrder: number[];
};

export function createPlayerState(): PlayerState {
	return {
		queue: [],
		index: 0,
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		repeatMode: "off",
		shuffle: false,
		shuffleOrder: [],
	};
}

export function createPlayer(state: PlayerState = createPlayerState()) {
	function mapIndex(playIndex: number): number {
		if (!state.shuffle || state.shuffleOrder.length === 0) return playIndex;
		return state.shuffleOrder[playIndex] ?? playIndex;
	}

	function goTo(index: number) {
		state.index = index;
		state.currentTime = 0;
		state.duration = 0;
		state.isPlaying = true;
	}

	function advance() {
		const nextIndex = state.index + 1;
		if (nextIndex < state.queue.length) {
			goTo(nextIndex);
		} else if (state.repeatMode === "all") {
			goTo(0);
		} else {
			state.isPlaying = false;
		}
	}

	return {
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
		queueIndex(playIndex: number) {
			return mapIndex(playIndex);
		},
		playQueue(tracks: PlayableTrack[], startIndex = 0) {
			if (tracks.length === 0) return;
			state.queue = tracks;
			state.shuffleOrder = [];
			goTo(startIndex);
		},
		ended() {
			advance();
		},
		next() {
			advance();
		},
		prev() {
			if (state.currentTime > 3) {
				state.currentTime = 0;
				return;
			}
			if (state.index > 0) {
				goTo(state.index - 1);
			} else {
				state.currentTime = 0;
			}
		},
		toggle() {
			state.isPlaying = !state.isPlaying;
		},
		pause() {
			state.isPlaying = false;
		},
		seek(seconds: number) {
			state.currentTime = seconds;
		},
		replayAlbum() {
			if (state.queue.length === 0) return;
			state.shuffleOrder = [];
			goTo(0);
		},
		toggleRepeat() {
			state.repeatMode = state.repeatMode === "off" ? "all" : "off";
		},
		toggleShuffle() {
			state.shuffle = !state.shuffle;
			if (!state.shuffle) {
				state.shuffleOrder = [];
				return;
			}
			const order = state.queue
				.map((_, i) => i)
				.filter((_, i) => i !== mapIndex(state.index));
			for (let i = order.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[order[i], order[j]] = [order[j]!, order[i]!];
			}
			const currentPos = mapIndex(state.index);
			state.shuffleOrder = [currentPos, ...order];
			state.index = 0;
		},
	};
}

export type Player = ReturnType<typeof createPlayer>;
