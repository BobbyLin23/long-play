<script lang="ts">
import { player } from "$lib/player/player.svelte";

const currentTrack = $derived(player.currentTrack);
const isPlaying = $derived(player.isPlaying);
const progress = $derived(player.progress);
const currentTime = $derived(player.currentTime);
const duration = $derived(player.duration);

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
	<div class="flex h-16 items-center gap-4 border-t border-white/5 bg-black/60 px-4 backdrop-blur-xl">
		{#if currentTrack.coverUrl}
			<img
				src={currentTrack.coverUrl}
				alt=""
				class="h-11 w-11 shrink-0 rounded-md object-cover"
			/>
		{:else}
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-lg">
				♪
			</div>
		{/if}

		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium">{currentTrack.title}</div>
			<div class="truncate text-xs text-[var(--color-text-secondary)]">
				{currentTrack.albumTitle} — {currentTrack.artist}
			</div>
		</div>

		<div class="hidden items-center gap-2 text-xs text-[var(--color-text-secondary)] sm:flex">
			<span>{formatTime(currentTime)}</span>
			<input
				type="range"
				class="w-40"
				min="0"
				max={duration || 0}
				value={currentTime}
				oninput={onSeek}
				aria-label="播放进度"
			/>
			<span>{formatTime(duration)}</span>
			<span class="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
				{player.index + 1} / {player.queue.length}
			</span>
		</div>

		<div class="flex shrink-0 items-center gap-1">
			<button
				class="rounded p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
				onclick={(e) => {
					e.stopPropagation();
					player.prev();
				}}
				aria-label="上一首"
			>⏮</button
			>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-bg-base)] hover:scale-105 transition-transform"
				onclick={(e) => {
					e.stopPropagation();
					player.toggle();
				}}
				aria-label={isPlaying ? "暂停" : "播放"}
			>
				{isPlaying ? "⏸" : "▶"}
			</button>
			<button
				class="rounded p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
				onclick={(e) => {
					e.stopPropagation();
					player.next();
				}}
				aria-label="下一首"
			>⏭</button
			>
		</div>
	</div>
{/if}
