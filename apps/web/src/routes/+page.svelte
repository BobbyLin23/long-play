<script lang="ts">
import { page } from "$app/state";
import { useAlbumList } from "$lib/api/albums";
import AlbumCover from "$lib/components/AlbumCover.svelte";

const albumQuery = useAlbumList();
const albumList = $derived(albumQuery.data);
const isPending = $derived(albumQuery.isPending);
const isError = $derived(albumQuery.isError);
const error = $derived(albumQuery.error);
const searchQuery = $derived(page.url.searchParams.get("q")?.trim() ?? "");
const isDiscovery = $derived(page.url.searchParams.get("view") === "discovery");
const pageTitle = $derived(
	searchQuery
		? `Search results for “${searchQuery}”`
		: isDiscovery
			? "Discovery"
			: "Home",
);
const visibleAlbums = $derived.by(() => {
	const albums = albumList?.albums ?? [];
	if (!searchQuery) return albums;
	const query = searchQuery.toLocaleLowerCase();
	return albums.filter((album) =>
		`${album.title} ${album.artist}`.toLocaleLowerCase().includes(query),
	);
});
</script>

<svelte:head>
	<title>{pageTitle} — Long Play</title>
</svelte:head>

<div class="px-6 py-8">
	<div class="mb-6">
		{#if isDiscovery && !searchQuery}
			<div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Made for exploring</div>
		{/if}
		<h1 class="text-3xl font-bold tracking-tight">{pageTitle}</h1>
	</div>

	{#if isError}
		<div class="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
			Failed to load: {error?.message}
		</div>
	{:else if isPending}
		<div class="text-text-secondary">Loading…</div>
	{:else if visibleAlbums.length}
		<div class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each visibleAlbums as album (album.id)}
				<a href={`/album/${album.id}`} class="group block">
					<div
						class="relative aspect-square overflow-hidden rounded-lg bg-(--color-surface-2) shadow-lg transition-transform group-hover:scale-[1.02]"
					>
						<AlbumCover src={album.coverUrl} />
					</div>
					<div class="mt-2 truncate text-sm font-medium">{album.title}</div>
					<div class="truncate text-xs text-text-secondary">
						{album.artist} · {album.trackCount} tracks
					</div>
				</a>
			{/each}
		</div>
	{:else if searchQuery}
		<div class="rounded-2xl border border-white/8 bg-white/2.5 px-6 py-14 text-center">
			<p class="text-base font-medium">No albums found</p>
			<p class="mt-1 text-sm text-text-secondary">Try another artist or album name.</p>
		</div>
	{/if}
</div>
