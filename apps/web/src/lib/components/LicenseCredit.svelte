<script lang="ts">
import { formatLicense, licenseHref } from "$lib/license";

let {
	license,
	class: className,
}: {
	license?: string | null;
	class?: string;
} = $props();

const label = $derived(formatLicense(license));
const href = $derived(licenseHref(license));
</script>

{#if label}
	{#if href}
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			class={className}
		>{label}</a>
	{:else}
		{label}
	{/if}
{/if}
