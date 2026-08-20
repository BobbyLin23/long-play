<script lang="ts">
/**
 * Cover color extraction: offscreen canvas samples a dominant color
 * for CSS background gradients. Computed once and cached in memory.
 */

const cache = new Map<string, string>();

async function extractColor(src: string): Promise<string> {
	const hit = cache.get(src);
	if (hit) return hit;
	try {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = src;
		await img.decode();
		const canvas = document.createElement("canvas");
		canvas.width = 40;
		canvas.height = 40;
		const ctx = canvas.getContext("2d");
		if (!ctx) return "rgb(30, 30, 34)";
		ctx.drawImage(img, 0, 0, 40, 40);
		const data = ctx.getImageData(0, 0, 40, 40).data;
		// Simple average of the dominant color (skip near-black / near-white pixels)
		let r = 0;
		let g = 0;
		let b = 0;
		let n = 0;
		for (let i = 0; i < data.length; i += 4) {
			const rr = data[i]!;
			const gg = data[i + 1]!;
			const bb = data[i + 2]!;
			const alpha = data[i + 3]!;
			if (alpha < 128) continue;
			if (rr < 20 && gg < 20 && bb < 20) continue;
			if (rr > 235 && gg > 235 && bb > 235) continue;
			r += rr;
			g += gg;
			b += bb;
			n++;
		}
		if (n === 0) return "rgb(30, 30, 34)";
		const color = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
		cache.set(src, color);
		return color;
	} catch {
		return "rgb(30, 30, 34)";
	}
}

let { src } = $props();
let accentColor = $state("rgb(30, 30, 34)");

$effect(() => {
	if (src) {
		void extractColor(src).then((c) => {
			accentColor = c;
		});
	}
});
</script>

{#if src}
	<div
		class="relative overflow-hidden"
		style:--album-accent={accentColor}
	>
		<img
			src={src}
			alt=""
			class="h-full w-full object-cover"
			loading="lazy"
		/>
	</div>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-[var(--color-surface-2)] text-4xl">
		♪
	</div>
{/if}
