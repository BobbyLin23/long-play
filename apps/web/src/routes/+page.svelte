<script lang="ts">
import { useAlbumList } from "$lib/api/albums";
import AlbumCover from "$lib/components/AlbumCover.svelte";

const albumQuery = useAlbumList();
const albumList = $derived(albumQuery.data);
const isPending = $derived(albumQuery.isPending);
const isError = $derived(albumQuery.isError);
const error = $derived(albumQuery.error);
</script>

<svelte:head>
	<title>Browse — long-play</title>
</svelte:head>

<div class="px-6 py-8">
	<h1 class="mb-6 text-3xl font-bold tracking-tight">Browse</h1>

	{#if isError}
		<div class="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
			加载失败: {error?.message}
		</div>
	{:else if isPending}
		<div class="text-[var(--color-text-secondary)]">加载中…</div>
	{:else if albumList?.albums.length}
		<div class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each albumList.albums as album (album.id)}
				<a
					href={`/album/${album.id}`}
					class="group block"
				>
					<div class="relative aspect-square overflow-hidden rounded-lg bg-[var(--color-surface-2)] shadow-lg transition-transform group-hover:scale-[1.02]">
						<AlbumCover src={album.coverUrl} />
					</div>
					<div class="mt-2 truncate text-sm font-medium">{album.title}</div>
					<div class="truncate text-xs text-[var(--color-text-secondary)]">
						{album.artist} · {album.trackCount} 首
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="py-16 text-center text-[var(--color-text-secondary)]">
			目录为空。请先运行 <code class="rounded bg-white/10 px-1">pnpm --filter @long-play/db seed</code>
		</div>
	{/if}
</div>
