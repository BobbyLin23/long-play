<script lang="ts">
import { useAlbumDetail } from "$lib/api/albums";

/**
 * 列表详情页的单张专辑行。
 * 自行拉取专辑详情以显示曲数，并把完整详情上报给父级
 * （用于"播放整个列表"时展开 tracks 队列）。
 */

type AlbumQueueSource = {
	id: string;
	title: string;
	artist: string;
	coverUrl?: string | null;
	tracks: Array<{ id: string; title: string; durationSec?: number | null }>;
};

let { album, onLoaded, onRemove } = $props<{
	album: {
		id: string;
		title: string;
		artist: string;
		coverUrl: string | null;
		position: number;
	};
	onLoaded: (albumId: string, detail: AlbumQueueSource) => void;
	onRemove: (albumId: string) => void;
}>();

const detailQuery = useAlbumDetail(album.id);
const detail = $derived(detailQuery.data);

$effect(() => {
	if (detail) onLoaded(album.id, detail);
});
</script>

<div class="group flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5">
	<a
		href={`/album/${album.id}`}
		class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--color-surface-2)]"
	>
		{#if album.coverUrl}
			<img src={album.coverUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<span class="text-xl text-[var(--color-text-secondary)]">♪</span>
		{/if}
	</a>
	<div class="min-w-0 flex-1">
		<div class="truncate text-sm font-medium">
			<a href={`/album/${album.id}`} class="hover:underline">{album.title}</a>
		</div>
		<div class="truncate text-xs text-[var(--color-text-secondary)]">
			{album.artist}
			{#if detail}
				· {detail.tracks.length} 首
			{/if}
		</div>
	</div>
	<button
		class="rounded-full border border-white/20 px-3 py-1 text-xs text-[var(--color-text-secondary)] opacity-100 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
		onclick={() => onRemove(album.id)}
		aria-label={`从列表移除 ${album.title}`}
	>移除</button
	>
</div>
