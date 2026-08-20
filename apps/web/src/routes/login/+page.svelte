<script lang="ts">
import { goto } from "$app/navigation";
import { authClient } from "$lib/auth-client";

let email = $state("");
let password = $state("");
let error = $state("");
let submitting = $state(false);

async function onSubmit(event: SubmitEvent) {
	event.preventDefault();
	error = "";
	submitting = true;
	const { error: err } = await authClient.signIn.email({
		email,
		password,
	});
	submitting = false;
	if (err) {
		error = err.message ?? "登录失败，请检查邮箱和密码";
		return;
	}
	await goto("/playlists");
}
</script>

<svelte:head>
	<title>登录 — long-play</title>
</svelte:head>

<div class="flex min-h-full items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-2xl font-bold text-white">
				♪
			</div>
			<h1 class="text-2xl font-bold tracking-tight">登录 long-play</h1>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
				登录后即可创建和收藏你的专辑列表
			</p>
		</div>

		<form class="space-y-4" onsubmit={onSubmit}>
			<div>
				<label for="email" class="mb-1 block text-sm font-medium">邮箱</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					class="w-full rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
					placeholder="you@example.com"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-sm font-medium">密码</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
					class="w-full rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
					placeholder="••••••••"
				/>
			</div>

			{#if error}
				<div class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
			>
				{submitting ? "登录中…" : "登录"}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
			还没有账号？
			<a href="/register" class="text-[var(--color-accent)] hover:underline">注册</a>
		</p>
	</div>
</div>
