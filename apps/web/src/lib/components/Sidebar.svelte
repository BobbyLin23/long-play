<script lang="ts">
import { page } from "$app/state";
import { authClient } from "$lib/auth-client";

const session = authClient.useSession();
$: sessionUser = $session.data?.user;
</script>

<nav class="flex h-full w-56 flex-col border-r border-white/5 bg-black/30 px-3 py-4">
	<div class="mb-6 flex items-center gap-2 px-2">
		<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">
			♪
		</span>
		<span class="text-lg font-semibold tracking-tight">long-play</span>
	</div>

	<div class="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
		浏览
	</div>
	<a
		href="/"
		class="mb-0.5 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/5 {page.url.pathname === '/' ? 'bg-white/10 text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}"
	>
		<span class="text-base">🖼️</span>
		Browse
	</a>
	<a
		href="/playlists"
		class="mb-0.5 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/5 {page.url.pathname.startsWith('/playlists') ? 'bg-white/10 text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}"
	>
		<span class="text-base">🎧</span>
		Playlists
	</a>

	<div class="mt-auto">
		<div class="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
			设置
		</div>
		{#if sessionUser}
			<div class="flex items-center gap-3 rounded-md px-2 py-1.5">
				<div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold">
					{sessionUser.name?.slice(0, 1).toUpperCase() ?? "U"}
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm">{sessionUser.name}</div>
					<button
						class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
						onclick={() => authClient.signOut()}
					>退出登录</button
					>
				</div>
			</div>
		{:else}
			<a
				href="/login"
				class="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text-primary)]"
			>登录</a
			>
		{/if}
	</div>
</nav>
