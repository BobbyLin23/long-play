<script lang="ts">
import { QueryClientProvider } from "@tanstack/svelte-query";
import { SvelteQueryDevtools } from "@tanstack/svelte-query-devtools";
import "../app.css";
import { onMount } from "svelte";
import MiniPlayer from "$lib/components/MiniPlayer.svelte";
import ModeSwitcher from "$lib/components/ModeSwitcher.svelte";
import NowPlaying from "$lib/components/NowPlaying.svelte";
import Sidebar from "$lib/components/Sidebar.svelte";
import { queryClient } from "$lib/orpc";
import { initPlayer, player } from "$lib/player/player.svelte";
import { theme } from "$lib/theme.svelte";

const { children } = $props();
let nowPlayingOpen = $state(false);

onMount(() => {
	theme.init();
	initPlayer();

	const isTyping = (el: EventTarget | null) => {
		const target = el as HTMLElement | null;
		if (!target) return false;
		const tag = target.tagName;
		return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
	};
	const onKey = (event: KeyboardEvent) => {
		if (isTyping(event.target)) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (!player.currentTrack) return;
		switch (event.key) {
			case " ":
			case "k":
			case "K":
				event.preventDefault();
				player.toggle();
				break;
			case "n":
			case "N":
				player.next();
				break;
			case "p":
			case "P":
				player.prev();
				break;
		}
	};
	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
});
</script>

<QueryClientProvider client={queryClient}>
	<div class="flex h-svh flex-col">
		<div class="flex flex-1 overflow-hidden">
			<div class="hidden md:block">
				<Sidebar />
			</div>

			<main class="flex-1 overflow-y-auto">
				<div class="flex justify-end px-4 pt-4 md:hidden">
					<div class="w-36">
						<ModeSwitcher />
					</div>
				</div>
				{@render children()}
			</main>
		</div>

		<button
			class="text-left"
			onclick={() => {
				if (player.currentTrack) nowPlayingOpen = true;
			}}
		>
			<MiniPlayer />
		</button>
	</div>

	{#if nowPlayingOpen && player.currentTrack}
		<div
			class="fixed inset-0 z-50 overflow-y-auto bg-bg-base"
			role="dialog"
			aria-modal="true"
			aria-label="Now playing"
		>
			<button
				class="fixed right-4 top-4 z-10 rounded-full bg-overlay px-4 py-2 text-sm hover:bg-hover"
				onclick={() => (nowPlayingOpen = false)}>Close</button
			>
			<NowPlaying />
		</div>
	{/if}
	<SvelteQueryDevtools />
</QueryClientProvider>
