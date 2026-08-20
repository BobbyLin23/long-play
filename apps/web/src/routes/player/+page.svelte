<script lang="ts">
import { getSoundHelixAlbums } from "@long-play/music";
import { onMount } from "svelte";
import {
	initPlayer,
	type PlayableTrack,
	player,
	syncMediaSession,
} from "$lib/player/player.svelte";

onMount(() => {
	initPlayer();
});

// M1/M2 联调页：从 SoundHelix 占位专辑反推代理 trackId（sh-<n>）
function toPlayable(
	album: ReturnType<typeof getSoundHelixAlbums>[number],
): PlayableTrack[] {
	return album.tracks.map((track) => {
		const n = /SoundHelix-Song-(\d+)\.mp3/.exec(track.streamUrl)?.[1];
		return {
			trackId: n ? `sh-${n}` : track.streamUrl,
			title: track.title,
			artist: album.artist,
			albumTitle: album.title,
		};
	});
}

const albums = getSoundHelixAlbums();
const currentTime = $derived(player.currentTime);
const duration = $derived(player.duration);
const progress = $derived(player.progress);
const shuffle = $derived(player.shuffle);
const repeatMode = $derived(player.repeatMode);

$effect(() => {
	// 播放状态变化时同步系统媒体控制
	syncMediaSession();
});

function playAlbum(albumIndex: number) {
	player.playQueue(toPlayable(albums[albumIndex]!));
}

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return "0:00";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

function onSeek(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	player.seek(Number(input.value));
}
</script>

<svelte:head>
	<title>Player Test — long-play</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<h1 class="mb-4 text-2xl font-bold">Player Test (M1/M2)</h1>

	<div class="mb-6 rounded-lg border p-4">
		<p class="mb-1 font-medium">
			{#if player.currentTrack}
				{player.currentTrack.title}
			{:else}
				未在播放
			{/if}
		</p>
		{#if player.currentTrack}
			<p class="text-sm opacity-70">
				{player.currentTrack.albumTitle} — {player.currentTrack.artist}
				({player.index + 1} / {player.queue.length})
			</p>
			<div class="mt-2 flex items-center gap-3">
				<button
					class="rounded px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700"
					onclick={() => player.prev()}>⏮</button
				>
				<button
					class="rounded px-4 py-1.5 bg-red-600 hover:bg-red-500"
					onclick={() => player.toggle()}>{player.isPlaying ? "⏸ 暂停" : "▶ 播放"}</button
				>
				<button
					class="rounded px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700"
					onclick={() => player.next()}>⏭</button
				>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs opacity-70">
				<span>{formatTime(currentTime)}</span>
				<input
					type="range"
					class="flex-1"
					min="0"
					max={duration || 0}
					value={currentTime}
					oninput={onSeek}
				/>
				<span>{formatTime(duration)}</span>
			</div>
		{/if}
	</div>

	<h2 class="mb-2 text-lg font-semibold">占位专辑（SoundHelix）</h2>
	<ul class="grid gap-2">
		{#each albums as album, i (album.externalId)}
			<li>
				<button
					class="w-full rounded-lg border p-3 text-left hover:border-red-500"
					onclick={() => playAlbum(i)}
				>
					<span class="font-medium">{album.title}</span>
					<span class="ml-2 text-sm opacity-60">{album.tracks.length} 首</span>
				</button>
			</li>
		{/each}
	</ul>

		<div class="mt-3 flex items-center gap-2 text-xs opacity-70">
			<button
				class="rounded border px-2 py-1 {shuffle ? 'border-red-500 text-red-400' : 'border-zinc-600'}"
				onclick={() => player.toggleShuffle()}
				aria-pressed={shuffle}>🔀 Shuffle</button
			>
			<button
				class="rounded border px-2 py-1 {repeatMode === 'all' ? 'border-red-500 text-red-400' : 'border-zinc-600'}"
				onclick={() => player.toggleRepeat()}
				aria-pressed={repeatMode === "all"}>🔁 {repeatMode === "all" ? "全部循环" : "不循环"}</button
			>
		</div>
		<p class="mt-6 text-xs opacity-50">
			说明：M1/M2 联调用 SoundHelix 直链；末曲播完自动停止（产品约束）。拖动进度条验证 206 seek。
	</p>
</div>
