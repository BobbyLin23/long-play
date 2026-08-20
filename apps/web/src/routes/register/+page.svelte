<script lang="ts">
import { goto } from "$app/navigation";
import { authClient } from "$lib/auth-client";

let name = $state("");
let email = $state("");
let password = $state("");
let error = $state("");
let submitting = $state(false);

async function onSubmit(event: SubmitEvent) {
	event.preventDefault();
	error = "";
	submitting = true;
	const { error: err } = await authClient.signUp.email({
		name,
		email,
		password,
	});
	submitting = false;
	if (err) {
		error = err.message ?? "Sign up failed. Please try again.";
		return;
	}
	await goto("/playlists");
}
</script>

<svelte:head>
	<title>Sign up — Long Play</title>
</svelte:head>

<div class="flex min-h-full items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<img class="mx-auto mb-3 h-16 w-16 object-contain" src="/long-play-logo.png" alt="Long Play" />
			<h1 class="text-2xl font-bold tracking-tight">Create an account</h1>
			<p class="mt-1 text-sm text-text-secondary">
				Start saving the albums you love
			</p>
		</div>

		<form class="space-y-4" onsubmit={onSubmit}>
			<div>
				<label for="name" class="mb-1 block text-sm font-medium">Display name</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					autocomplete="name"
					class="w-full rounded-lg border border-white/10 bg-(--color-surface-2) px-3 py-2.5 text-sm outline-none focus:border-accent"
					placeholder="Your name"
				/>
			</div>
			<div>
				<label for="email" class="mb-1 block text-sm font-medium">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					class="w-full rounded-lg border border-white/10 bg-(--color-surface-2) px-3 py-2.5 text-sm outline-none focus:border-accent"
					placeholder="you@example.com"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-sm font-medium">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength="8"
					autocomplete="new-password"
					class="w-full rounded-lg border border-white/10 bg-(--color-surface-2) px-3 py-2.5 text-sm outline-none focus:border-accent"
					placeholder="At least 8 characters"
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
				class="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{submitting ? "Creating account…" : "Sign up"}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-text-secondary">
			Already have an account?
			<a href="/login" class="text-accent hover:underline">Log in</a>
		</p>
	</div>
</div>
