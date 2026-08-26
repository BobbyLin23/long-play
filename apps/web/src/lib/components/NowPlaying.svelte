<script lang="ts">
import LicenseCredit from "$lib/components/LicenseCredit.svelte";
import { formatLicense } from "$lib/license";
import { player } from "$lib/player/player.svelte";

const currentTrack = $derived(player.currentTrack);
const isPlaying = $derived(player.isPlaying);
const progress = $derived(player.progress);
const currentTime = $derived(player.currentTime);
const duration = $derived(player.duration);
const shuffle = $derived(player.shuffle);
const repeatMode = $derived(player.repeatMode);
const licenseLabel = $derived(formatLicense(currentTrack?.license));
// True when the album has finished: last track has ended
const atAlbumEnd = $derived(
	player.queue.length > 0 &&
		player.index >= player.queue.length - 1 &&
		!isPlaying &&
		duration > 0 &&
		progress >= 0.99,
);

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

{#if currentTrack}
	<div class="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
		{#if currentTrack.coverUrl}
			<img
				src={currentTrack.coverUrl}
				alt=""
				class="aspect-square w-full max-w-sm rounded-2xl object-cover shadow-2xl"
			/>
		{:else}
			<div class="flex aspect-square w-full max-w-sm items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-8xl">
				♪
			</div>
		{/if}

		<div class="w-full max-w-lg text-center">
			<h2 class="truncate text-2xl font-bold tracking-tight">
				{currentTrack.title}
			</h2>
			<p class="mt-1 truncate text-[var(--color-text-secondary)]">
				{currentTrack.albumTitle} — {currentTrack.artist}
			</p>
			{#if licenseLabel}
				<p class="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
					<LicenseCredit
						license={currentTrack.license}
						class="underline decoration-border-strong underline-offset-2 hover:text-[var(--color-text-primary)]"
					/>
				</p>
			{/if}
		</div>

		<div class="w-full max-w-lg">
			{#if atAlbumEnd}
				<div class="mb-3 flex flex-col items-center gap-2 rounded-lg bg-hover py-4">
					<span class="text-sm text-[var(--color-text-secondary)]">Album finished</span>
					<button
						class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
						onclick={() => player.replayAlbum()}
					>Replay album</button
					>
				</div>
			{:else}
				<div class="mb-2 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
					<span>{formatTime(currentTime)}</span>
					<span>{formatTime(duration)}</span>
				</div>
				<input
					type="range"
					class="w-full"
					min="0"
					max={duration || 0}
					value={currentTime}
					oninput={onSeek}
					aria-label="Playback progress"
				/>
			{/if}

			<div class="mt-4 flex items-center justify-center gap-6">
				<button
					class="rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] {shuffle ? 'text-[var(--color-accent)]' : ''}"
					onclick={() => player.toggleShuffle()}
					aria-pressed={shuffle}
					aria-label="Shuffle"
				>🔀</button
				>
				<button
					class="rounded-full p-3 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
					onclick={() => player.prev()}
					aria-label="Previous track"
				>⏮</button
				>
				<button
					class="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-2xl text-[var(--color-bg-base)] transition-transform hover:scale-105"
					onclick={() => player.toggle()}
					aria-label={isPlaying ? "Pause" : "Play"}
				>
					{isPlaying ? "⏸" : "▶"}
				</button>
				<button
					class="rounded-full p-3 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
					onclick={() => player.next()}
					aria-label="Next track"
				>⏭</button
				>
				<button
					class="rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] {repeatMode === 'all' ? 'text-[var(--color-accent)]' : ''}"
					onclick={() => player.toggleRepeat()}
					aria-pressed={repeatMode === "all"}
					aria-label="Repeat mode"
				>🔁</button
				>
			</div>
		</div>
	</div>
{/if}
