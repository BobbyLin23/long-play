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

// M1/M2 integration page: map SoundHelix placeholder albums to proxy track IDs (sh-<n>)
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
	// Sync system media controls when playback state changes
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
	<title>Player Test — Long Play</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<h1 class="mb-4 text-2xl font-bold">Player Test (M1/M2)</h1>

	<div class="mb-6 rounded-lg border p-4">
		<p class="mb-1 font-medium">
			{#if player.currentTrack}
				{player.currentTrack.title}
			{:else}
				Not playing
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
					onclick={() => player.toggle()}>{player.isPlaying ? "Pause" : "Play"}</button
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

	<h2 class="mb-2 text-lg font-semibold">Placeholder albums (SoundHelix)</h2>
	<ul class="grid gap-2">
		{#each albums as album, i (album.externalId)}
			<li>
				<button
					class="w-full rounded-lg border p-3 text-left hover:border-red-500"
					onclick={() => playAlbum(i)}
				>
					<span class="font-medium">{album.title}</span>
					<span class="ml-2 text-sm opacity-60">{album.tracks.length} tracks</span>
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
				aria-pressed={repeatMode === "all"}>🔁 {repeatMode === "all" ? "Repeat all" : "No repeat"}</button
			>
		</div>
		<p class="mt-6 text-xs opacity-50">
			M1/M2 uses SoundHelix direct links. Playback stops after the last track. Drag the progress bar to test 206 seek.
	</p>
</div>
