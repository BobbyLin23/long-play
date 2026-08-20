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
		formError = "请填写列表名称";
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
			"创建失败，请重试";
	}
});
</script>

<svelte:head>
	<title>Playlists — long-play</title>
</svelte:head>

<div class="px-6 py-8">
	{#if !user}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-3xl">
				🎧
			</div>
			<h1 class="mb-2 text-2xl font-bold tracking-tight">请先登录</h1>
			<p class="mb-6 text-sm text-[var(--color-text-secondary)]">
				登录后即可创建和整理你的收藏列表
			</p>
			<a
				href="/login"
				class="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
			>前往登录</a
			>
		</div>
	{:else}
		<div class="mb-6 flex items-center justify-between gap-4">
			<h1 class="text-3xl font-bold tracking-tight">我的收藏列表</h1>
			<button
				class="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
				onclick={openCreate}
			>＋ 新建列表</button
			>
		</div>

		{#if isPending}
			<div class="text-[var(--color-text-secondary)]">加载中…</div>
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
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-3xl">
					♪
				</div>
				<h2 class="mb-2 text-xl font-semibold tracking-tight">还没有收藏列表</h2>
				<p class="mb-6 text-sm text-[var(--color-text-secondary)]">
					创建第一个列表，把喜欢的专辑收进同一个地方，随时连播
				</p>
				<button
					class="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-white/50 hover:bg-white/5"
					onclick={openCreate}
				>＋ 新建列表</button
				>
			</div>
		{/if}
	{/if}
</div>

<dialog
	bind:this={dialogEl}
	class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[var(--color-bg-surface)] p-6 text-[var(--color-text-primary)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === dialogEl) closeCreate();
	}}
>
	<form class="space-y-4" method="dialog" onsubmit={submitCreate}>
		<h2 class="text-lg font-semibold tracking-tight">新建收藏列表</h2>

		<div>
			<label for="playlist-name" class="mb-1 block text-sm font-medium">名称</label>
			<input
				id="playlist-name"
				bind:this={nameInput}
				type="text"
				bind:value={name}
				required
				maxlength={100}
				class="w-full rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
				placeholder="例如：通勤精选"
			/>
		</div>

		<div>
			<label for="playlist-desc" class="mb-1 block text-sm font-medium">描述（可选）</label>
			<textarea
				id="playlist-desc"
				bind:value={description}
				maxlength={500}
				rows={3}
				class="w-full resize-none rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
				placeholder="简单描述这个列表…"
			></textarea>
		</div>

		{#if formError}
			<div class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>
		{/if}

		<div class="flex justify-end gap-3 pt-1">
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--color-text-primary)]"
				onclick={closeCreate}
			>取消</button
			>
			<button
				type="submit"
				disabled={createPlaylist.isPending}
				class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
			>
				{createPlaylist.isPending ? "创建中…" : "创建"}
			</button>
		</div>
	</form>
</dialog>
