<script lang="ts">
import { useAlbumDetail } from "$lib/api/albums";

/**
 * Album row on the playlist detail page.
 * Loads album details for track count, then reports the full album to the parent
 * so "Play playlist" can expand the tracks queue.
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
		class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-(--color-surface-2)"
	>
		{#if album.coverUrl}
			<img src={album.coverUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<span class="text-xl text-text-secondary">♪</span>
		{/if}
	</a>
	<div class="min-w-0 flex-1">
		<div class="truncate text-sm font-medium">
			<a href={`/album/${album.id}`} class="hover:underline">{album.title}</a>
		</div>
		<div class="truncate text-xs text-text-secondary">
			{album.artist}
			{#if detail}
				· {detail.tracks.length} tracks
			{/if}
		</div>
	</div>
	<button
		class="rounded-full border border-white/20 px-3 py-1 text-xs text-text-secondary opacity-100 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
		onclick={() => onRemove(album.id)}
		aria-label={`Remove ${album.title} from playlist`}
	>Remove</button
	>
</div>
