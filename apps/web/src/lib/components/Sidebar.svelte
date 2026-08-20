<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import IconChevronUp from "@tabler/icons-svelte/icons/chevron-up";
	import IconCompass from "@tabler/icons-svelte/icons/compass";
	import IconHeart from "@tabler/icons-svelte/icons/heart";
	import IconHome from "@tabler/icons-svelte/icons/home";
	import IconLoader2 from "@tabler/icons-svelte/icons/loader-2";
	import IconLogin2 from "@tabler/icons-svelte/icons/login-2";
	import IconLogout from "@tabler/icons-svelte/icons/logout";
	import IconSearch from "@tabler/icons-svelte/icons/search";
	import { onMount } from "svelte";
	import { authClient } from "$lib/auth-client";

	const session = authClient.useSession();
	const sessionUser = $derived($session.data?.user ?? null);
	const sessionPending = $derived($session.isPending);
	const isSearch = $derived(page.url.pathname === "/search");
	const isHome = $derived(
		page.url.pathname === "/" && page.url.searchParams.get("view") !== "discovery",
	);
	const isDiscovery = $derived(page.url.pathname === "/" && page.url.searchParams.get("view") === "discovery");

	let userMenuOpen = $state(false);
	let accountEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		const closeMenu = (event: PointerEvent) => {
			if (accountEl && !accountEl.contains(event.target as Node)) userMenuOpen = false;
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") userMenuOpen = false;
		};
		document.addEventListener("pointerdown", closeMenu);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeMenu);
			document.removeEventListener("keydown", closeOnEscape);
		};
	});

	async function signOut() {
		userMenuOpen = false;
		await authClient.signOut();
		await goto("/");
	}
</script>

<aside class="sidebar" aria-label="Main sidebar">
	<a class="brand" href="/" aria-label="Long Play home">
		<img class="brand-mark" src="/long-play-logo.png" alt="" />
		<span>Long Play</span>
	</a>

	<nav class="sidebar-nav" aria-label="Primary navigation">
		<a class:active={isSearch} class="nav-item" href="/search" aria-current={isSearch ? "page" : undefined}>
			<IconSearch size={22} stroke={1.9} aria-hidden="true" />
			<span>Search</span>
		</a>

		<a class:active={isHome} class="nav-item" href="/" aria-current={isHome ? "page" : undefined}>
			<IconHome size={22} stroke={1.8} aria-hidden="true" />
			<span>Home</span>
		</a>

		<a
			class:active={isDiscovery}
			class="nav-item"
			href="/?view=discovery"
			aria-current={isDiscovery ? "page" : undefined}
		>
			<IconCompass size={22} stroke={1.8} aria-hidden="true" />
			<span>Discovery</span>
		</a>

		{#if sessionUser}
			<div class="library-section">
				<div class="section-label">Your library</div>
				<a
					class:active={page.url.pathname.startsWith("/playlists")}
					class="nav-item"
					href="/playlists"
					aria-current={page.url.pathname.startsWith("/playlists") ? "page" : undefined}
				>
					<IconHeart size={22} stroke={1.8} aria-hidden="true" />
					<span>Favourites</span>
				</a>
			</div>
		{/if}
	</nav>

	<div class="account" bind:this={accountEl}>
		{#if sessionPending}
			<div class="account-loading" aria-label="Loading account">
				<IconLoader2 class="loading-icon" size={20} stroke={1.8} aria-hidden="true" />
				<span>Loading account…</span>
			</div>
		{:else if sessionUser}
			{#if userMenuOpen}
				<div class="user-menu" role="menu">
					<div class="user-menu-header">
						<div class="user-name">{sessionUser.name}</div>
						<div class="user-email">{sessionUser.email}</div>
					</div>
					<a href="/playlists" role="menuitem">
						<IconHeart size={18} stroke={1.8} aria-hidden="true" />
						Favourites
					</a>
					<button type="button" role="menuitem" onclick={signOut}>
						<IconLogout size={18} stroke={1.8} aria-hidden="true" />
						Log out
					</button>
				</div>
			{/if}

			<button
				type="button"
				class="user-button"
				aria-haspopup="menu"
				aria-expanded={userMenuOpen}
				onclick={() => (userMenuOpen = !userMenuOpen)}
			>
				{#if sessionUser.image}
					<img class="avatar" src={sessionUser.image} alt="" />
				{:else}
					<span class="avatar avatar-fallback" aria-hidden="true">
						{sessionUser.name?.slice(0, 1).toUpperCase() ?? "U"}
					</span>
				{/if}
				<span class="user-summary">
					<strong>{sessionUser.name}</strong>
					<small>{sessionUser.email}</small>
				</span>
				<IconChevronUp class={userMenuOpen ? "rotated" : ""} size={18} stroke={1.8} aria-hidden="true" />
			</button>
		{:else}
			<a class="login-button" href="/login">
				<IconLogin2 size={20} stroke={1.9} aria-hidden="true" />
				Log in
			</a>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		position: relative;
		display: flex;
		height: calc(100% - 16px);
		width: 264px;
		flex-direction: column;
		margin: 8px 0 8px 8px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 24px;
		background: #232323;
		padding: 22px 14px 14px;
		color: var(--color-text-primary);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		width: fit-content;
		margin: 0 8px 12px;
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.045em;
		line-height: 1;
	}

	.brand-mark {
		width: 38px;
		height: 38px;
		object-fit: contain;
	}

	.sidebar-nav {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		gap: 5px;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 13px;
		border: 1px solid transparent;
		border-radius: 12px;
		padding: 0 13px;
		color: #c5c5ca;
		font-size: 15px;
		font-weight: 520;
		transition:
			background-color 160ms ease,
			color 160ms ease,
			border-color 160ms ease;
	}

	.nav-item:hover {
		background: rgba(255, 255, 255, 0.055);
		color: #fff;
	}

	.nav-item.active {
		background: #303030;
		color: var(--color-accent);
	}

	.library-section {
		margin-top: 28px;
	}

	.section-label {
		margin: 0 13px 9px;
		color: #74747d;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.account {
		position: relative;
		margin-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		padding-top: 13px;
	}

	.login-button,
	.account-loading,
	.user-button {
		display: flex;
		width: 100%;
		min-height: 46px;
		align-items: center;
		border-radius: 12px;
	}

	.login-button {
		justify-content: center;
		gap: 9px;
		background: var(--color-accent);
		color: white;
		font-size: 14px;
		font-weight: 700;
		transition:
			background-color 160ms ease,
			transform 160ms ease;
	}

	.login-button:hover {
		background: var(--color-accent-hover);
		transform: translateY(-1px);
	}

	.account-loading {
		justify-content: center;
		gap: 9px;
		color: var(--color-text-secondary);
		font-size: 13px;
	}

	.account-loading :global(.loading-icon) {
		animation: spin 900ms linear infinite;
	}

	.user-button {
		gap: 10px;
		border: 1px solid transparent;
		padding: 6px 8px;
		text-align: left;
		transition: background-color 160ms ease;
	}

	.user-button:hover,
	.user-button[aria-expanded="true"] {
		background: rgba(255, 255, 255, 0.065);
	}

	.avatar {
		display: flex;
		width: 34px;
		height: 34px;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		background: color-mix(in srgb, var(--color-accent) 78%, #76263b);
		color: white;
		font-size: 13px;
		font-weight: 750;
	}

	.user-summary {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 2px;
	}

	.user-summary strong,
	.user-summary small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-summary strong {
		font-size: 13px;
		font-weight: 650;
	}

	.user-summary small {
		color: var(--color-text-secondary);
		font-size: 11px;
	}

	.user-button :global(.tabler-icon-chevron-up) {
		color: var(--color-text-secondary);
		transition: transform 160ms ease;
	}

	.user-button :global(.rotated) {
		transform: rotate(180deg);
	}

	.user-menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 9px);
		left: 0;
		z-index: 20;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		background: #252528;
		padding: 6px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.42);
	}

	.user-menu-header {
		margin: 2px 4px 6px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding: 7px 8px 11px;
	}

	.user-name,
	.user-email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-name {
		font-size: 13px;
		font-weight: 650;
	}

	.user-email {
		margin-top: 2px;
		color: var(--color-text-secondary);
		font-size: 11px;
	}

	.user-menu a,
	.user-menu button {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		border-radius: 9px;
		padding: 9px 8px;
		color: #d8d8dd;
		font-size: 13px;
		text-align: left;
	}

	.user-menu a:hover,
	.user-menu button:hover {
		background: rgba(255, 255, 255, 0.07);
		color: white;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
