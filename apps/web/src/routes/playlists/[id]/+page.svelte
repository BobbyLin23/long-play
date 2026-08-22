<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { toPlayableQueue } from "$lib/api/albums";
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

/** Play the whole playlist = load each album, then expand tracks by position */
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

// ── Edit (rename) dialog ──
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
		editError = "Name cannot be empty";
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
			"Couldn't save. Please try again.";
	}
});

// ── Delete confirmation dialog ──
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
			"Couldn't delete. Please try again.";
	}
});

// ── Remove album ──
function onRemove(albumId: string) {
	removeAlbum.mutate({ playlistId, albumId });
}
</script>

<svelte:head>
	<title>{playlist?.name ?? "Playlist"} — Long Play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if isPending}
		<div class="text-text-secondary">Loading…</div>
	{:else if playlist}
		<!-- Header -->
		<div class="mb-8 flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
					Playlist
				</div>
				<h1 class="mb-2 text-4xl font-bold tracking-tight">{playlist.name}</h1>
				<div class="text-text-secondary">
					{playlist.albums.length} albums
				</div>
				{#if playlist.description}
					<p class="mt-2 max-w-xl text-sm text-text-secondary">
						{playlist.description}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-3">
				<button
					class="rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-hover"
					onclick={openEdit}
				>Edit</button
				>
				<button
					class="rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400"
					onclick={openDelete}
				>Delete playlist</button
				>
			</div>
		</div>

		<!-- Primary actions -->
		<div class="mb-8 flex items-center gap-3">
			<button
				class="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
				onclick={playWholePlaylist}
				disabled={playlist.albums.length === 0}
			>Play playlist</button
			>
		</div>

		<!-- Album list -->
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
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-surface-2) text-3xl">
					♪
				</div>
				<h2 class="mb-2 text-xl font-semibold tracking-tight">This playlist is empty</h2>
				<p class="mb-6 text-sm text-text-secondary">
					Browse albums and add the ones you want to keep here
				</p>
				<a
					href="/"
					class="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
				>Go to Browse</a
				>
			</div>
		{/if}
	{:else}
		<div class="py-16 text-center text-text-secondary">
			Playlist not found or already deleted
		</div>
	{/if}
</div>

<!-- Edit dialog -->
<dialog
	bind:this={editDialog}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-bg-surface p-6 text-text-primary backdrop:bg-black/60 backdrop:backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === editDialog) closeEdit();
	}}
>
	<form class="space-y-4" method="dialog" onsubmit={submitEdit}>
		<h2 class="text-lg font-semibold tracking-tight">Edit playlist</h2>

		<div>
			<label for="edit-name" class="mb-1 block text-sm font-medium">Name</label>
			<input
				id="edit-name"
				type="text"
				bind:value={editName}
				required
				maxlength={100}
				class="w-full rounded-lg border border-border bg-bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
			/>
		</div>

		<div>
			<label for="edit-desc" class="mb-1 block text-sm font-medium">Description (optional)</label>
			<textarea
				id="edit-desc"
				bind:value={editDescription}
				maxlength={500}
				rows={3}
				class="w-full resize-none rounded-lg border border-border bg-bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
			></textarea>
		</div>

		{#if editError}
			<div class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{editError}</div>
		{/if}

		<div class="flex justify-end gap-3 pt-1">
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
				onclick={closeEdit}
			>Cancel</button
			>
			<button
				type="submit"
				disabled={renamePlaylist.isPending}
				class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{renamePlaylist.isPending ? "Saving…" : "Save"}
			</button>
		</div>
	</form>
</dialog>

<!-- Delete confirmation dialog -->
<dialog
	bind:this={deleteDialog}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-bg-surface p-6 text-text-primary backdrop:bg-black/60 backdrop:backdrop-blur-sm"
>
	<h2 class="mb-2 text-lg font-semibold tracking-tight">Delete this playlist?</h2>
	<p class="mb-6 text-sm text-text-secondary">
		This cannot be undone. Albums in the playlist will not be deleted.
	</p>

	{#if deleteError}
		<div class="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{deleteError}</div>
	{/if}

	<div class="flex justify-end gap-3">
		<button
			type="button"
			class="rounded-full px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
			onclick={() => deleteDialog?.close()}
		>Cancel</button
		>
		<button
			type="button"
			disabled={deletePlaylist.isPending}
			class="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
			onclick={confirmDelete}
		>
			{deletePlaylist.isPending ? "Deleting…" : "Delete"}
		</button>
	</div>
</dialog>
