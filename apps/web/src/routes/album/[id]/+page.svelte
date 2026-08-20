<script lang="ts">
import { page } from "$app/state";
import { playAlbum, useAlbumDetail } from "$lib/api/albums";
import TrackList from "$lib/components/TrackList.svelte";
import { player } from "$lib/player/player.svelte";

const albumId = $derived(page.params.id);
const albumQuery = useAlbumDetail(albumId);
const album = $derived(albumQuery.data);
const isPending = $derived(albumQuery.isPending);

const isCurrentAlbum = $derived(
	player.currentTrack?.albumTitle === album?.title && player.queue.length > 0,
);
const isPlaying = $derived(player.isPlaying);
</script>

<svelte:head>
	<title>{album?.title ?? "Album"} — Long Play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if isPending}
		<div class="text-text-secondary">Loading…</div>
	{:else if album}
		<!-- Header: large cover + title -->
		<div class="mb-8 flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:text-left">
			{#if album.coverUrl}
				<img
					src={album.coverUrl}
					alt=""
					class="h-48 w-48 shrink-0 rounded-xl object-cover shadow-2xl md:h-56 md:w-56"
				/>
			{:else}
				<div class="flex h-48 w-48 shrink-0 items-center justify-center rounded-xl bg-(--color-surface-2) text-6xl md:h-56 md:w-56">
					♪
				</div>
			{/if}
			<div>
				<div class="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
					Album
				</div>
				<h1 class="mb-2 text-4xl font-bold tracking-tight md:text-5xl">
					{album.title}
				</h1>
				<div class="text-text-secondary">
					{album.artist}
					{#if album.year} · {album.year}{/if} · {album.tracks.length} tracks
				</div>
			</div>
		</div>

		<!-- Primary actions -->
		<div class="mb-6 flex items-center gap-3">
			<button
				class="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
				onclick={() => playAlbum(album)}
			>
				{isCurrentAlbum && isPlaying ? "Pause" : "Play album"}
			</button>
			<button
				class="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-white/50"
				onclick={() => player.toggleShuffle()}
				aria-pressed={player.shuffle}
			>Shuffle</button
			>
		</div>

			<!-- Track list -->
			<div class="max-w-3xl">
				<TrackList tracks={album.tracks} onPlay={(i) => playAlbum(album, i)} />
			</div>
	{:else}
		<div class="py-16 text-center text-text-secondary">
			Album not found or already deleted
		</div>
	{/if}
</div>
