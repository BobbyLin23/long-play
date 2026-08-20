<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { toPlayableQueue, useAlbumDetail } from "$lib/api/albums";
import {
	useDeletePlaylist,
	usePlaylistDetail,
	useRemoveAlbumFromPlaylist,
	useRenamePlaylist,
} from "$lib/api/playlists";
import { player } from "$lib/player/player.svelte";
import AlbumRow from "./AlbumRow.svelte";

const playlistId = $derived(page.params.id as string);

const playlistQuery = usePlaylistDetail(playlistId);
const playlist = $derived(playlistQuery.data);
const isPending = $derived(playlistQuery.isPending);
const renamePlaylist = useRenamePlaylist();
const deletePlaylist = useDeletePlaylist();
const removeAlbum = useRemoveAlbumFromPlaylist();

/** 播放整个列表 = 逐张拉专辑详情 → 按 position 展开成曲目队列 */
const albumQueue = new Map<
	string,
	{
		id: string;
		title: string;
		artist: string;
		coverUrl?: string | null;
		tracks: Array<{ id: string; title: string; durationSec?: number | null }>;
	}
>();

function onAlbumLoaded(
	albumId: string,
	detail: {
		id: string;
		title: string;
		artist: string;
		coverUrl?: string | null;
		tracks: Array<{ id: string; title: string; durationSec?: number | null }>;
	},
) {
	albumQueue.set(albumId, detail);
}

function playWholePlaylist() {
	const albums = playlist?.albums ?? [];
	const queue = albums.flatMap((album) => {
		const detail = albumQueue.get(album.id);
		return detail ? toPlayableQueue(detail) : [];
	});
	if (queue.length === 0) return;
	player.playQueue(queue, 0);
}

// ── 编辑（改名）对话框 ──
let editDialog = $state<HTMLDialogElement | null>(null);
let editName = $state("");
let editDescription = $state("");
let editError = $state("");

function openEdit() {
	if (!playlist) return;
	editName = playlist.name;
	editDescription = playlist.description ?? "";
	editError = "";
	editDialog?.showModal();
}

function closeEdit() {
	editDialog?.close();
}

function submitEdit(event: SubmitEvent) {
	event.preventDefault();
	if (!editName.trim()) {
		editError = "名称不能为空";
		return;
	}
	renamePlaylist.mutate({
		id: playlistId,
		name: editName.trim(),
		description: editDescription.trim() || undefined,
	});
}

$effect(() => {
	if (renamePlaylist.isSuccess) {
		closeEdit();
	} else if (renamePlaylist.isError) {
		editError =
			(renamePlaylist.error as Error | undefined)?.message ??
			"保存失败，请重试";
	}
});

// ── 删除确认对话框 ──
let deleteDialog = $state<HTMLDialogElement | null>(null);
let deleteError = $state("");

function openDelete() {
	deleteError = "";
	deleteDialog?.showModal();
}

function confirmDelete() {
	deletePlaylist.mutate({ id: playlistId });
}

$effect(() => {
	if (deletePlaylist.isSuccess) {
		goto("/playlists");
	} else if (deletePlaylist.isError) {
		deleteError =
			(deletePlaylist.error as Error | undefined)?.message ??
			"删除失败，请重试";
	}
});

// ── 移除专辑 ──
function onRemove(albumId: string) {
	removeAlbum.mutate({ playlistId, albumId });
}
</script>

<svelte:head>
	<title>{playlist?.name ?? "收藏列表"} — long-play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if isPending}
		<div class="text-[var(--color-text-secondary)]">加载中…</div>
	{:else if playlist}
		<!-- 头部 -->
		<div class="mb-8 flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
					收藏列表
				</div>
				<h1 class="mb-2 text-4xl font-bold tracking-tight">{playlist.name}</h1>
				<div class="text-[var(--color-text-secondary)]">
					{playlist.albums.length} 张专辑
				</div>
				{#if playlist.description}
					<p class="mt-2 max-w-xl text-sm text-[var(--color-text-secondary)]">
						{playlist.description}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-3">
				<button
					class="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-white/50 hover:bg-white/5"
					onclick={openEdit}
				>✏️ 编辑</button
				>
				<button
					class="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400"
					onclick={openDelete}
				>🗑 删除列表</button
				>
			</div>
		</div>

		<!-- 主操作 -->
		<div class="mb-8 flex items-center gap-3">
			<button
				class="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
				onclick={playWholePlaylist}
				disabled={playlist.albums.length === 0}
			>▶ 播放整个列表</button
			>
		</div>

		<!-- 专辑列表 -->
		{#if playlist.albums.length}
			<div class="max-w-3xl">
				{#each playlist.albums as album (album.id)}
					<AlbumRow
						{album}
						onLoaded={onAlbumLoaded}
						onRemove={onRemove}
					/>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-3xl">
					♪
				</div>
				<h2 class="mb-2 text-xl font-semibold tracking-tight">列表还是空的</h2>
				<p class="mb-6 text-sm text-[var(--color-text-secondary)]">
					去 Browse 逛逛，把喜欢的专辑收藏进来吧
				</p>
				<a
					href="/"
					class="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
				>去 Browse</a
				>
			</div>
		{/if}
	{:else}
		<div class="py-16 text-center text-[var(--color-text-secondary)]">
			列表不存在或已删除
		</div>
	{/if}
</div>

<!-- 编辑对话框 -->
<dialog
	bind:this={editDialog}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[var(--color-bg-surface)] p-6 text-[var(--color-text-primary)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === editDialog) closeEdit();
	}}
>
	<form class="space-y-4" method="dialog" onsubmit={submitEdit}>
		<h2 class="text-lg font-semibold tracking-tight">编辑收藏列表</h2>

		<div>
			<label for="edit-name" class="mb-1 block text-sm font-medium">名称</label>
			<input
				id="edit-name"
				type="text"
				bind:value={editName}
				required
				maxlength={100}
				class="w-full rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
			/>
		</div>

		<div>
			<label for="edit-desc" class="mb-1 block text-sm font-medium">描述（可选）</label>
			<textarea
				id="edit-desc"
				bind:value={editDescription}
				maxlength={500}
				rows={3}
				class="w-full resize-none rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
			></textarea>
		</div>

		{#if editError}
			<div class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{editError}</div>
		{/if}

		<div class="flex justify-end gap-3 pt-1">
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--color-text-primary)]"
				onclick={closeEdit}
			>取消</button
			>
			<button
				type="submit"
				disabled={renamePlaylist.isPending}
				class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
			>
				{renamePlaylist.isPending ? "保存中…" : "保存"}
			</button>
		</div>
	</form>
</dialog>

<!-- 删除确认对话框 -->
<dialog
	bind:this={deleteDialog}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[var(--color-bg-surface)] p-6 text-[var(--color-text-primary)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
>
	<h2 class="mb-2 text-lg font-semibold tracking-tight">删除这个列表？</h2>
	<p class="mb-6 text-sm text-[var(--color-text-secondary)]">
		删除后无法恢复，列表内的专辑不会被删除。
	</p>

	{#if deleteError}
		<div class="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{deleteError}</div>
	{/if}

	<div class="flex justify-end gap-3">
		<button
			type="button"
			class="rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--color-text-primary)]"
			onclick={() => deleteDialog?.close()}
		>取消</button
		>
		<button
			type="button"
			disabled={deletePlaylist.isPending}
			class="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
			onclick={confirmDelete}
		>
			{deletePlaylist.isPending ? "删除中…" : "删除"}
		</button>
	</div>
</dialog>
