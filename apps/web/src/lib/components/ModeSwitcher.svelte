<script lang="ts">
	import IconDeviceDesktop from "@tabler/icons-svelte/icons/device-desktop";
	import IconMoon from "@tabler/icons-svelte/icons/moon";
	import IconSun from "@tabler/icons-svelte/icons/sun";
	import { theme, type ThemePreference } from "$lib/theme.svelte";

	const options: { value: ThemePreference; label: string }[] = [
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" },
		{ value: "system", label: "System" },
	];
</script>

<div class="mode-switcher" role="radiogroup" aria-label="Color theme">
	{#each options as option (option.value)}
		<button
			type="button"
			class={["mode-option", theme.preference === option.value && "active"]}
			role="radio"
			aria-checked={theme.preference === option.value}
			aria-label={option.label}
			onclick={() => theme.set(option.value)}
		>
			{#if option.value === "light"}
				<IconSun size={16} stroke={1.8} aria-hidden="true" />
			{:else if option.value === "dark"}
				<IconMoon size={16} stroke={1.8} aria-hidden="true" />
			{:else}
				<IconDeviceDesktop size={16} stroke={1.8} aria-hidden="true" />
			{/if}
		</button>
	{/each}
</div>

<style>
	.mode-switcher {
		display: flex;
		width: 100%;
		gap: 2px;
		border: 1px solid var(--lp-border);
		border-radius: 12px;
		background: var(--lp-hover);
		padding: 3px;
	}

	.mode-option {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: 32px;
		border-radius: 9px;
		color: var(--color-text-secondary);
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.mode-option:hover {
		color: var(--color-text-primary);
	}

	.mode-option.active {
		background: var(--lp-sidebar-active);
		color: var(--color-text-primary);
	}
</style>
