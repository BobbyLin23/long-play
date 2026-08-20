import { db } from "@long-play/db";
import { tracks } from "@long-play/db/schema/music";
import { eq } from "drizzle-orm";
import type { Elysia } from "elysia";

import {
	getCachedRange,
	putCachedRange,
	shouldCacheRange,
} from "./audio-cache";

/**
 * 音频 Range 代理。
 *
 * 浏览器 `<audio>` 的 src 指向本路由，代理转发客户端的 Range 请求到上游，
 * 透传 206 / Content-Range，seek 端到端可用。
 *
 * - trackId = DB tracks.id（UUID）；查库拿上游 streamUrl，不做任意 URL 透传。
 * - L1 浏览器缓存（Cache-Control: private + ETag）。
 * - L2 服务器磁盘缓存（按字节区间，LRU 驱逐，见 audio-cache.ts）。
 * - 客户端断开时 abort 上游请求。
 */

const PROXY_PASS_HEADERS = [
	"content-type",
	"content-range",
	"accept-ranges",
	"content-length",
	"last-modified",
	"etag",
] as const;

/** L1 浏览器缓存：重复播放/seek 回看本地命中，零服务器流量 */
const CACHE_CONTROL = "private, max-age=3600";

const trackCache = new Map<string, string>();

async function resolveUpstream(trackId: string): Promise<string | null> {
	const cached = trackCache.get(trackId);
	if (cached) return cached;
	const row = await db
		.select({ streamUrl: tracks.streamUrl })
		.from(tracks)
		.where(eq(tracks.id, trackId))
		.limit(1);
	if (!row[0]) return null;
	trackCache.set(trackId, row[0].streamUrl);
	return row[0].streamUrl;
}

function parseRange(
	range: string | null,
): { start: number; end: number } | null {
	if (!range?.startsWith("bytes=")) return null;
	const [startStr, endStr] = range.slice(6).split("-");
	if (!startStr) return null;
	const start = Number.parseInt(startStr, 10);
	const end = endStr ? Number.parseInt(endStr, 10) : Number.POSITIVE_INFINITY;
	if (Number.isNaN(start)) return null;
	return { start, end };
}

export function audioProxyRoutes(app: Elysia) {
	return app.get("/proxy/audio/:trackId", async ({ request, params, set }) => {
		const upstreamUrl = await resolveUpstream(params.trackId);
		if (!upstreamUrl) {
			set.status = 404;
			return new Response("Not Found", { status: 404 });
		}

		const range = parseRange(request.headers.get("range"));

		// L2：有界区间命中缓存则直接返回，不回源
		if (range && Number.isFinite(range.end)) {
			const cached = await getCachedRange(
				params.trackId,
				range.start,
				range.end,
			);
			if (cached) {
				set.status = 206;
				return new Response(cached.body, {
					status: 206,
					headers: {
						"content-type": cached.contentType,
						"content-range": `bytes ${range.start}-${range.end}/${cached.total}`,
						"cache-control": CACHE_CONTROL,
					},
				});
			}
		}

		const upstreamHeaders = new Headers();
		if (range) {
			upstreamHeaders.set(
				"range",
				Number.isFinite(range.end)
					? `bytes=${range.start}-${range.end}`
					: `bytes=${range.start}-`,
			);
		}

		// 客户端断开时中止上游请求，避免 Node 侧长连接泄漏
		const controller = new AbortController();
		const onAbort = () => controller.abort();
		request.signal.addEventListener("abort", onAbort, { once: true });

		try {
			const upstream = await fetch(upstreamUrl, {
				headers: upstreamHeaders,
				signal: controller.signal,
			});

			const headers = new Headers();
			for (const name of PROXY_PASS_HEADERS) {
				const value = upstream.headers.get(name);
				if (value) {
					headers.set(name, value);
				}
			}
			headers.set("cache-control", CACHE_CONTROL);

			// 完整资源大小（用于 L2 缓存 total 与 Content-Range 兜底）
			const contentRange = upstream.headers.get("content-range");
			const total = contentRange
				? Number.parseInt(contentRange.split("/")[1] ?? "", 10)
				: undefined;

			// L2 写入：仅小有界区间 + 拿到 total 时
			if (
				upstream.ok &&
				range &&
				Number.isFinite(range.end) &&
				total &&
				shouldCacheRange(range.start, range.end)
			) {
				const bodyBuffer = await upstream.arrayBuffer();
				void putCachedRange(params.trackId, range.start, range.end, {
					body: new Uint8Array(bodyBuffer),
					contentType: upstream.headers.get("content-type") ?? "audio/mpeg",
					total,
					etag: upstream.headers.get("etag") ?? undefined,
					lastModified: upstream.headers.get("last-modified") ?? undefined,
				});
				set.status = upstream.status;
				return new Response(bodyBuffer, {
					status: upstream.status,
					headers,
				});
			}

			set.status = upstream.status;
			return new Response(upstream.body, {
				status: upstream.status,
				headers,
			});
		} finally {
			request.signal.removeEventListener("abort", onAbort);
		}
	});
}
