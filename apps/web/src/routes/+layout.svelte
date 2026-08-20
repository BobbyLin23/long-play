<script lang="ts">
	import { QueryClientProvider } from "@tanstack/svelte-query";
	import { SvelteQueryDevtools } from "@tanstack/svelte-query-devtools";
	import "../app.css";
	import { queryClient } from "$lib/orpc";

	const { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
	<div class="grid h-svh grid-rows-[auto_1fr]">
		{@render children()}
	</div>
	<SvelteQueryDevtools />
</QueryClientProvider>
