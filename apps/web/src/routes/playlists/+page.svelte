<script lang="ts">
import { useCreatePlaylist, usePlaylistList } from "$lib/api/playlists";
import { authClient } from "$lib/auth-client";
import PlaylistCard from "$lib/components/PlaylistCard.svelte";

const session = authClient.useSession();
const user = $derived($session?.data?.user ?? null);

const playlistQuery = usePlaylistList();
const playlistList = $derived(playlistQuery.data);
const isPending = $derived(playlistQuery.isPending);
const createPlaylist = useCreatePlaylist();

let dialogEl = $state<HTMLDialogElement | null>(null);
let nameInput = $state<HTMLInputElement | null>(null);
let name = $state("");
let description = $state("");
let formError = $state("");

function openCreate() {
	name = "";
	description = "";
	formError = "";
	dialogEl?.showModal();
}

$effect(() => {
	if (dialogEl?.open) nameInput?.focus();
});

function closeCreate() {
	dialogEl?.close();
}

function submitCreate(event: SubmitEvent) {
	event.preventDefault();
	if (!name.trim()) {
		formError = "Please enter a playlist name";
		return;
	}
	createPlaylist.mutate({
		name: name.trim(),
		description: description.trim() || undefined,
	});
}

$effect(() => {
	if (createPlaylist.isSuccess) {
		closeCreate();
	} else if (createPlaylist.isError) {
		formError =
			(createPlaylist.error as Error | undefined)?.message ??
			"Couldn't create playlist. Please try again.";
	}
});
</script>

<svelte:head>
	<title>Playlists — Long Play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if !user}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-surface-2) text-3xl">
				🎧
			</div>
			<h1 class="mb-2 text-2xl font-bold tracking-tight">Please log in</h1>
			<p class="mb-6 text-sm text-text-secondary">
				Sign in to create and organize your playlists
			</p>
			<a
				href="/login"
				class="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
			>Go to log in</a>
			>
		</div>
	{:else}
		<div class="mb-6 flex items-center justify-between gap-4">
			<h1 class="text-3xl font-bold tracking-tight">Your playlists</h1>
			<button
				class="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
				onclick={openCreate}
			>＋ New playlist</button>
			>
		</div>

		{#if isPending}
			<div class="text-text-secondary">Loading…</div>
		{:else if playlistList?.length}
			<div class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{#each playlistList as playlist (playlist.id)}
					<a href={`/playlists/${playlist.id}`} class="group block">
						<PlaylistCard {playlist} />
					</a>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-surface-2) text-3xl">
					♪
				</div>
				<h2 class="mb-2 text-xl font-semibold tracking-tight">No playlists yet</h2>
				<p class="mb-6 text-sm text-text-secondary">
					Create your first playlist to collect albums and play them in one place
				</p>
				<button
					class="rounded-full border border-border-strong px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-hover"
					onclick={openCreate}
				>＋ New playlist</button
				>
			</div>
		{/if}
	{/if}
</div>

<dialog
	bind:this={dialogEl}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-bg-surface p-6 text-text-primary backdrop:bg-black/60 backdrop:backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === dialogEl) closeCreate();
	}}
>
	<form class="space-y-4" method="dialog" onsubmit={submitCreate}>
		<h2 class="text-lg font-semibold tracking-tight">New playlist</h2>

		<div>
			<label for="playlist-name" class="mb-1 block text-sm font-medium">Name</label>
			<input
				id="playlist-name"
				bind:this={nameInput}
				type="text"
				bind:value={name}
				required
				maxlength={100}
				class="w-full rounded-lg border border-border bg-bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
				placeholder="e.g. Commute picks"
			/>
		</div>

		<div>
			<label for="playlist-desc" class="mb-1 block text-sm font-medium">Description (optional)</label>
			<textarea
				id="playlist-desc"
				bind:value={description}
				maxlength={500}
				rows={3}
				class="w-full resize-none rounded-lg border border-border bg-bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
				placeholder="A short description…"
			></textarea>
		</div>

		{#if formError}
			<div class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>
		{/if}

		<div class="flex justify-end gap-3 pt-1">
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
				onclick={closeCreate}
			>Cancel</button
			>
			<button
				type="submit"
				disabled={createPlaylist.isPending}
				class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{createPlaylist.isPending ? "Creating…" : "Create"}
			</button>
		</div>
	</form>
</dialog>
