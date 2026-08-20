<script lang="ts">
import { usePlaylistDetail } from "$lib/api/playlists";

/**
 * 收藏列表卡片：封面取列表内第一张专辑（无则 ♪ 占位）。
 * 仅展示元信息，跳转由父级 <a> 包裹。
 */

let { playlist } = $props<{
	playlist: {
		id: string;
		name: string;
		description?: string | null;
		createdAt: Date | string;
		albumCount: number;
	};
}>();

const detailQuery = usePlaylistDetail(playlist.id);
const detail = $derived(detailQuery.data);
const firstAlbum = $derived(detail?.albums[0]);

function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
</script>

<div class="aspect-square overflow-hidden rounded-lg bg-[var(--color-surface-2)] shadow-lg">
	{#if firstAlbum?.coverUrl}
		<img
			src={firstAlbum.coverUrl}
			alt=""
			class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
			loading="lazy"
		/>
	{:else}
		<div
			class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-surface-2)] to-black/40 text-6xl text-[var(--color-text-secondary)]"
		>
			♪
		</div>
	{/if}
</div>

<div class="mt-2 flex items-center justify-between gap-2">
	<div class="min-w-0">
		<div class="truncate text-sm font-medium">{playlist.name}</div>
		<div class="truncate text-xs text-[var(--color-text-secondary)]">
			{playlist.albumCount} 张专辑 · {formatDate(playlist.createdAt)}
		</div>
	</div>
</div>
{#if playlist.description}
	<div class="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
		{playlist.description}
	</div>
{/if}
