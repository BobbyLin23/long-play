<script lang="ts">
import { player } from "$lib/player/player.svelte";

let {
	tracks,
	onPlay,
	albumTitle,
	artist,
}: {
	tracks: Array<{ id: string; title: string; durationSec?: number | null }>;
	onPlay: (index: number) => void;
	albumTitle?: string;
	artist?: string;
} = $props();

const currentTrackId = $derived(player.currentTrack?.trackId);
const isPlaying = $derived(player.isPlaying);

function formatTime(seconds?: number | null): string {
	if (!seconds || !Number.isFinite(seconds)) return "–:––";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}
</script>

<style>
	@keyframes eq-bounce {
		0%,
		100% {
			height: 4px;
		}
		50% {
			height: 14px;
		}
	}
	.eq-bar {
		width: 3px;
		background: var(--color-accent);
		animation: eq-bounce 0.9s ease-in-out infinite;
	}
	.eq-bar:nth-child(2) {
		animation-delay: 0.15s;
	}
	.eq-bar:nth-child(3) {
		animation-delay: 0.3s;
	}
	.eq-bar:nth-child(4) {
		animation-delay: 0.45s;
	}
	@media (prefers-reduced-motion: reduce) {
		.eq-bar {
			animation: none;
			height: 8px;
		}
	}
</style>

<ol>
	{#each tracks as track, i (track.id)}
		{@const isCurrent = currentTrackId === track.id}
		<li>
			<button
				class="group flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5 {isCurrent ? 'bg-white/10' : ''}"
				onclick={() => onPlay(i)}
				aria-current={isCurrent ? "true" : undefined}
				aria-label={`Play ${track.title}`}
			>
				<span class="w-6 text-center text-sm text-[var(--color-text-secondary)] group-hover:hidden">
					{i + 1}
				</span>
				<span class="hidden w-6 items-center justify-center text-sm group-hover:flex">
					▶
				</span>

				<span class="flex flex-1 items-center gap-2 truncate text-sm font-medium">
					<span class="truncate">{track.title}</span>
					{#if isCurrent}
						<span class="flex h-4 items-end gap-[2px]" aria-hidden="true">
							<span class="eq-bar"></span>
							<span class="eq-bar"></span>
							<span class="eq-bar"></span>
							<span class="eq-bar"></span>
						</span>
					{/if}
				</span>

				<span class="text-xs text-[var(--color-text-secondary)]">
					{formatTime(track.durationSec)}
				</span>
			</button>
		</li>
	{/each}
</ol>
