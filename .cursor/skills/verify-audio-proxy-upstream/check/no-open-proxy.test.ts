/**
 * Property: every upstream `fetch` URL is exactly `tracks.streamUrl` for
 * `params.trackId` — never a client-supplied URL from query, header, or body.
 *
 * Covers: apps/server/src/audio-proxy.ts (`resolveUpstream`, route handler).
 */

import { Elysia } from "elysia";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { mockClearStreamUrls, mockSetStreamUrl } from "../mocks/db";

const REPO_AUDIO_PROXY = new URL(
	"../../../../apps/server/src/audio-proxy.ts",
	import.meta.url,
).pathname;

const ALLOWED_STREAM = "https://cdn.example.test/legal/track.mp3";
const EVIL_STREAM = "https://evil.example.test/steal";
const TRACK_ID = "11111111-1111-1111-1111-111111111111";
const UNKNOWN_TRACK_ID = "22222222-2222-2222-2222-222222222222";

type FetchCall = { url: string; headers: Headers };

const fetchCalls: FetchCall[] = [];

beforeEach(() => {
	fetchCalls.length = 0;
	mockClearStreamUrls();
	mockSetStreamUrl(TRACK_ID, ALLOWED_STREAM);
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;
			fetchCalls.push({
				url,
				headers: new Headers(init?.headers),
			});
			return new Response(new Uint8Array([1, 2, 3, 4]), {
				status: 206,
				headers: {
					"content-type": "audio/mpeg",
					"content-range": "bytes 0-3/4",
					"accept-ranges": "bytes",
					"content-length": "4",
				},
			});
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// Load once so the in-process `trackCache` and the mock DB Map stay the same
// instance the tests write into (vi.resetModules would split them).
const { audioProxyRoutes } = await import(REPO_AUDIO_PROXY);

async function loadApp() {
	return new Elysia().use(audioProxyRoutes);
}

async function requestProxy(
	app: Elysia,
	trackId: string,
	init: RequestInit & { query?: Record<string, string> } = {},
) {
	const { query, ...rest } = init;
	const qs = query ? `?${new URLSearchParams(query)}` : "";
	return app.handle(
		new Request(`http://verify.test/proxy/audio/${trackId}${qs}`, rest),
	);
}

test("known trackId fetches only the DB streamUrl", async () => {
	const app = await loadApp();
	const res = await requestProxy(app, TRACK_ID, {
		headers: { range: "bytes=0-3" },
	});
	expect(res.status).toBe(206);
	expect(fetchCalls.map((c) => c.url)).toEqual([ALLOWED_STREAM]);
});

test("unknown trackId returns 404 and never fetches", async () => {
	const app = await loadApp();
	const res = await requestProxy(app, UNKNOWN_TRACK_ID);
	expect(res.status).toBe(404);
	expect(fetchCalls).toEqual([]);
});

test("client query url= cannot redirect upstream fetch", async () => {
	const app = await loadApp();
	await requestProxy(app, TRACK_ID, {
		query: { url: EVIL_STREAM, streamUrl: EVIL_STREAM },
		headers: { range: "bytes=0-3" },
	});
	expect(fetchCalls.map((c) => c.url)).toEqual([ALLOWED_STREAM]);
	expect(fetchCalls.some((c) => c.url.includes("evil"))).toBe(false);
});

test("client headers cannot supply the upstream URL", async () => {
	const app = await loadApp();
	await requestProxy(app, TRACK_ID, {
		headers: {
			range: "bytes=0-3",
			"x-upstream-url": EVIL_STREAM,
			forward: EVIL_STREAM,
			"x-original-url": EVIL_STREAM,
		},
	});
	expect(fetchCalls.map((c) => c.url)).toEqual([ALLOWED_STREAM]);
});

test("path that is not a DB id never fetches a client URL from query", async () => {
	const app = await loadApp();
	const res = await requestProxy(app, encodeURIComponent(EVIL_STREAM), {
		query: { url: EVIL_STREAM },
	});
	expect(res.status).toBe(404);
	expect(fetchCalls).toEqual([]);
});

test("exhaustive: every (trackId, injection) pair keeps fetch ⊆ DB urls", async () => {
	const app = await loadApp();
	const trackIds = [TRACK_ID, UNKNOWN_TRACK_ID, "not-a-uuid", ""];
	const injections: Array<RequestInit & { query?: Record<string, string> }> = [
		{},
		{ query: { url: EVIL_STREAM } },
		{ query: { streamUrl: EVIL_STREAM, redirect: EVIL_STREAM } },
		{ headers: { "x-upstream-url": EVIL_STREAM } },
		{
			headers: {
				range: "bytes=0-1",
				referer: EVIL_STREAM,
			},
		},
		{
			method: "POST",
			headers: {
				range: "bytes=0-1",
				"content-type": "application/json",
			},
			body: JSON.stringify({ url: EVIL_STREAM }),
		},
	];

	const allowed = new Set([ALLOWED_STREAM]);

	for (const trackId of trackIds) {
		for (const init of injections) {
			fetchCalls.length = 0;
			const pathId = trackId === "" ? "empty-id" : trackId;
			await requestProxy(app, pathId, init);
			for (const call of fetchCalls) {
				expect(
					allowed.has(call.url),
					`fetch(${call.url}) for trackId=${pathId}`,
				).toBe(true);
			}
		}
	}
});
