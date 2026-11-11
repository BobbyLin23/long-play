/**
 * Test double for `@long-play/db` used only by the no-open-proxy check.
 * Mimics the drizzle chain in `resolveUpstream` (select → from → where → limit).
 */

const streamUrls = new Map<string, string>();

export function mockSetStreamUrl(trackId: string, streamUrl: string): void {
	streamUrls.set(trackId, streamUrl);
}

export function mockClearStreamUrls(): void {
	streamUrls.clear();
}

function clauseMentionsTrackId(clause: unknown, trackId: string): boolean {
	const seen = new WeakSet<object>();
	function walk(node: unknown): boolean {
		if (node === trackId) return true;
		if (!node || typeof node !== "object") return false;
		if (seen.has(node)) return false;
		seen.add(node);
		if ("value" in node && (node as { value: unknown }).value === trackId) {
			return true;
		}
		if (Array.isArray(node)) return node.some(walk);
		return Object.values(node).some(walk);
	}
	return walk(clause);
}

export const db = {
	select(_projection?: unknown) {
		return {
			from(_table?: unknown) {
				return {
					where(clause: unknown) {
						return {
							async limit(_n: number) {
								for (const [trackId, streamUrl] of streamUrls) {
									if (clauseMentionsTrackId(clause, trackId)) {
										return [{ streamUrl }];
									}
								}
								return [];
							},
						};
					},
				};
			},
		};
	},
};
