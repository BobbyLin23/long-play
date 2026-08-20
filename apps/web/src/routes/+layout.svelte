<script lang="ts">
import { QueryClientProvider } from "@tanstack/svelte-query";
import { SvelteQueryDevtools } from "@tanstack/svelte-query-devtools";
import "../app.css";
import { onMount } from "svelte";
import MiniPlayer from "$lib/components/MiniPlayer.svelte";
import NowPlaying from "$lib/components/NowPlaying.svelte";
import Sidebar from "$lib/components/Sidebar.svelte";
import { queryClient } from "$lib/orpc";
import { initPlayer, player } from "$lib/player/player.svelte";

const { children } = $props();
let nowPlayingOpen = $state(false);

onMount(() => {
	initPlayer();

	// 全局快捷键：空格/K 播放暂停、N/P 前后曲目（输入框聚焦时不拦截）
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
			<!-- 桌面 Sidebar（隐藏于移动端） -->
			<div class="hidden md:block">
				<Sidebar />
			</div>

			<!-- 内容区 -->
			<main class="flex-1 overflow-y-auto">
				{@render children()}
			</main>
		</div>

		<!-- 底部迷你条：点击打开全屏 Now Playing -->
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
			class="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg-base)]"
			role="dialog"
			aria-modal="true"
			aria-label="正在播放"
		>
			<button
				class="fixed right-4 top-4 z-10 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
				onclick={() => (nowPlayingOpen = false)}
			>✕ 关闭</button
			>
			<NowPlaying />
		</div>
	{/if}
	<SvelteQueryDevtools />
</QueryClientProvider>
