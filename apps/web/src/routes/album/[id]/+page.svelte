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
	<title>{album?.title ?? "专辑"} — long-play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if isPending}
		<div class="text-[var(--color-text-secondary)]">加载中…</div>
	{:else if album}
		<!-- 头部：大封面 + Large Title -->
		<div class="mb-8 flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:text-left">
			{#if album.coverUrl}
				<img
					src={album.coverUrl}
					alt=""
					class="h-48 w-48 shrink-0 rounded-xl object-cover shadow-2xl md:h-56 md:w-56"
				/>
			{:else}
				<div class="flex h-48 w-48 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-6xl md:h-56 md:w-56">
					♪
				</div>
			{/if}
			<div>
				<div class="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
					专辑
				</div>
				<h1 class="mb-2 text-4xl font-bold tracking-tight md:text-5xl">
					{album.title}
				</h1>
				<div class="text-[var(--color-text-secondary)]">
					{album.artist}
					{#if album.year} · {album.year}{/if} · {album.tracks.length} 首
				</div>
			</div>
		</div>

		<!-- 主操作行 -->
		<div class="mb-6 flex items-center gap-3">
			<button
				class="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
				onclick={() => playAlbum(album)}
			>
				{isCurrentAlbum && isPlaying ? "⏸ 暂停" : "▶ 播放整张专辑"}
			</button>
			<button
				class="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-white/50"
				onclick={() => player.toggleShuffle()}
				aria-pressed={player.shuffle}
			>🔀 洗牌</button
			>
		</div>

			<!-- 曲目列表 -->
			<div class="max-w-3xl">
				<TrackList tracks={album.tracks} onPlay={(i) => playAlbum(album, i)} />
			</div>
	{:else}
		<div class="py-16 text-center text-[var(--color-text-secondary)]">
			专辑不存在或已删除
		</div>
	{/if}
</div>
