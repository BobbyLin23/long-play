import { PUBLIC_SERVER_URL } from "$env/static/public";

export function audioProxyUrl(trackId: string): string {
	return `${PUBLIC_SERVER_URL}/proxy/audio/${encodeURIComponent(trackId)}`;
}
