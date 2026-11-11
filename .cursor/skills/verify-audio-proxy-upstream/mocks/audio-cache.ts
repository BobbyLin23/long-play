/** L2 cache stub: always miss so every hit path exercises upstream `fetch`. */

export function shouldCacheRange(_start: number, _end: number): boolean {
	return false;
}

export async function getCachedRange(
	_trackId: string,
	_start: number,
	_end: number,
): Promise<null> {
	return null;
}

export async function putCachedRange(): Promise<void> {}

export async function cleanUpCache(): Promise<void> {}
