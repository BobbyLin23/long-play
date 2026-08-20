import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { env } from "@long-play/env/server";

/**
 * L2 服务器磁盘缓存（临时加速层，不存放"源文件"语义）：
 * - 按 `trackId + 字节区间` 缓存上游响应片段，seek 区间可复用。
 * - LRU 驱逐（按最近访问时间）+ 容量水位（AUDIO_CACHE_MAX_MB）+ 启动清理。
 * - 缓存仅为性能加速；命中率低、缓存损坏、上游更新都只会回源，功能不受影响。
 */

export type CachedEntry = {
	body: Uint8Array;
	contentType: string;
	/** 完整资源字节数（用于构造 Content-Range total） */
	total: number;
	etag?: string;
	lastModified?: string;
};

const MAX_BYTES = env.AUDIO_CACHE_MAX_MB * 1024 * 1024;
/** 只缓存 ≤ 1MB 的有界区间（seek 探测/小跳转区间），大区间直接流式转发 */
const MAX_CACHE_RANGE = 1024 * 1024;

export function shouldCacheRange(start: number, end: number): boolean {
	return end - start <= MAX_CACHE_RANGE;
}

function cachePath(trackId: string, start: number, end: number): string {
	const key = createHash("sha1")
		.update(`${trackId}:${start}-${end}`)
		.digest("hex");
	return join(env.AUDIO_CACHE_DIR, `${key}.cache`);
}

async function ensureDir(): Promise<void> {
	await mkdir(env.AUDIO_CACHE_DIR, { recursive: true });
}

function parseEntry(buffer: Uint8Array): CachedEntry | null {
	try {
		const headerEnd = buffer.indexOf(0x0a, buffer.indexOf(0x0a) + 1);
		if (headerEnd === -1) return null;
		const header = JSON.parse(
			new TextDecoder().decode(buffer.subarray(0, headerEnd)),
		) as Omit<CachedEntry, "body">;
		return { ...header, body: buffer.subarray(headerEnd + 1) };
	} catch {
		return null;
	}
}

async function readEntry(path: string): Promise<CachedEntry | null> {
	try {
		const s = await stat(path);
		if (s.size === 0) return null;
		const buffer = await readFile(path);
		return parseEntry(buffer);
	} catch {
		return null;
	}
}

export async function getCachedRange(
	trackId: string,
	start: number,
	end: number,
): Promise<CachedEntry | null> {
	return readEntry(cachePath(trackId, start, end));
}

export async function putCachedRange(
	trackId: string,
	start: number,
	end: number,
	entry: CachedEntry,
): Promise<void> {
	await ensureDir();
	const header = new TextEncoder().encode(
		`${JSON.stringify({
			contentType: entry.contentType,
			total: entry.total,
			etag: entry.etag,
			lastModified: entry.lastModified,
		})}\n`,
	);
	const out = new Uint8Array(header.length + entry.body.length);
	out.set(header, 0);
	out.set(entry.body, header.length);
	await writeFile(cachePath(trackId, start, end), out);
	void evictIfNeeded();
}

async function evictIfNeeded(): Promise<void> {
	try {
		const files = await readDirWithSize(env.AUDIO_CACHE_DIR);
		let total = files.reduce((sum, f) => sum + f.size, 0);
		if (total <= MAX_BYTES) return;

		// LRU：按最近访问时间从旧到新驱逐，直到低于水位
		files.sort((a, b) => a.mtimeMs - b.mtimeMs);
		for (const file of files) {
			if (total <= MAX_BYTES) break;
			await unlink(join(env.AUDIO_CACHE_DIR, file.name)).catch(() => {});
			total -= file.size;
		}
	} catch {
		// 驱逐失败不影响主流程
	}
}

type FileSizeInfo = { name: string; size: number; mtimeMs: number };

async function readDirWithSize(dir: string): Promise<FileSizeInfo[]> {
	const { readdir } = await import("node:fs/promises");
	const entries = await readdir(dir);
	const files: FileSizeInfo[] = [];
	for (const name of entries) {
		const full = join(dir, name);
		try {
			const s = await stat(full);
			if (s.isFile()) files.push({ name, size: s.size, mtimeMs: s.mtimeMs });
		} catch {
			// 忽略并发删除
		}
	}
	return files;
}

/** 启动时清空缓存目录（临时层，不留持久状态） */
export async function cleanUpCache(): Promise<void> {
	try {
		const { rm } = await import("node:fs/promises");
		await rm(env.AUDIO_CACHE_DIR, { recursive: true, force: true });
	} catch {
		// 清理失败不阻塞启动
	}
}
