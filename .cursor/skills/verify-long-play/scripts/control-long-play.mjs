#!/usr/bin/env node
/**
 * control-long-play — verification harness for the Long Play web app.
 *
 * From repo root:
 *   node .cursor/skills/verify-long-play/scripts/control-long-play.mjs <command> ...
 *
 * Commands: launch | doctor | seed | cleanup | rpc | browser | drive
 *
 * Verification scaffolding: when the product shelf is empty (or always on
 * `seed`), inserts jamendo-source rows with external_id prefix `verify-` and
 * SoundHelix stream URLs. Cleanup deletes only those rows — never product data.
 */

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createConnection, createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(SKILL_DIR, "../../..");
const STATE_PATH = join(SKILL_DIR, ".run-state.json");
const DAEMON_SOCK = join(SKILL_DIR, ".browser-daemon.sock");
const DAEMON_PID = join(SKILL_DIR, ".browser-daemon.pid");
const WEB_URL = process.env.VERIFY_WEB_URL || "http://localhost:5173";
const SERVER_URL = process.env.VERIFY_SERVER_URL || "http://localhost:5172";
const WEB_PORT = 5173;
const SERVER_PORT = 5172;
const VERIFY_EXTERNAL_PREFIX = "verify-";
const VERIFY_ALBUM_TITLE = "Verify Night Drive";
const requireFromDb = createRequire(
	join(REPO_ROOT, "packages/db/package.json"),
);

loadEnv({ path: join(REPO_ROOT, "apps/server/.env") });
loadEnv({ path: join(REPO_ROOT, "apps/web/.env") });

function die(msg, code = 1) {
	console.error(`control-long-play: ${msg}`);
	process.exit(code);
}

function readState() {
	if (!existsSync(STATE_PATH)) return null;
	try {
		return JSON.parse(readFileSync(STATE_PATH, "utf8"));
	} catch {
		return null;
	}
}

function writeState(state) {
	writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function clearState() {
	if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
}

function artifactDir(state) {
	const dir = state?.artifactDir;
	if (!dir) die("no artifactDir in run state — run launch first");
	mkdirSync(dir, { recursive: true });
	return dir;
}

function portOwner(port) {
	try {
		const out = execFileSync(
			"lsof",
			["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
			{ encoding: "utf8" },
		).trim();
		if (!out) return null;
		return out
			.split("\n")
			.map((s) => Number(s.trim()))
			.filter(Boolean);
	} catch {
		return null;
	}
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, init) {
	const res = await fetch(url, init);
	const text = await res.text();
	return { res, text };
}

async function rpc(procedure, input = {}) {
	const { res, text } = await fetchText(`${SERVER_URL}/rpc/${procedure}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ json: input }),
	});
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = { raw: text };
	}
	return { ok: res.ok, status: res.status, body };
}

async function waitReady({ timeoutMs = 90_000 } = {}) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const health = await fetchText(`${SERVER_URL}/`);
			const web = await fetchText(WEB_URL);
			const rpcHealth = await rpc("healthCheck", {});
			if (
				health.res.ok &&
				health.text.trim() === "OK" &&
				web.res.ok &&
				rpcHealth.ok &&
				rpcHealth.body?.json === "OK"
			) {
				return true;
			}
		} catch {
			/* retry */
		}
		await sleep(500);
	}
	return false;
}

async function getDbSql() {
	const url = process.env.DATABASE_URL;
	if (!url) die("DATABASE_URL missing from apps/server/.env");
	// Resolve from packages/db so pnpm workspace deps are visible to this skill script.
	const neonPath = requireFromDb.resolve("@neondatabase/serverless");
	const { pathToFileURL } = await import("node:url");
	const mod = await import(pathToFileURL(neonPath).href);
	const neon = mod.neon ?? mod.default?.neon;
	if (typeof neon !== "function") {
		die("failed to load neon() from @neondatabase/serverless");
	}
	return neon(url);
}

async function seedVerifyShelf() {
	const sql = await getDbSql();
	const albums = [
		{
			externalId: `${VERIFY_EXTERNAL_PREFIX}night-drive`,
			title: VERIFY_ALBUM_TITLE,
			artist: "Verify Aero",
			year: 2024,
			license: "https://creativecommons.org/licenses/by/3.0/",
			tracks: [
				{
					title: "Verify Track 1",
					position: 1,
					durationSec: 30,
					streamUrl:
						"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
				},
				{
					title: "Verify Track 2",
					position: 2,
					durationSec: 30,
					streamUrl:
						"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
				},
			],
		},
		{
			externalId: `${VERIFY_EXTERNAL_PREFIX}morning-light`,
			title: "Verify Morning Light",
			artist: "Verify Quill",
			year: 2023,
			license: "https://creativecommons.org/licenses/by-sa/3.0/",
			tracks: [
				{
					title: "Verify Dawn",
					position: 1,
					durationSec: 30,
					streamUrl:
						"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
				},
			],
		},
	];

	const inserted = [];
	for (const album of albums) {
		const rows = await sql`
			INSERT INTO albums (source, external_id, title, artist, year, license, genres)
			VALUES ('jamendo', ${album.externalId}, ${album.title}, ${album.artist}, ${album.year}, ${album.license}, '{}')
			ON CONFLICT (source, external_id) DO UPDATE SET
				title = EXCLUDED.title,
				artist = EXCLUDED.artist,
				year = EXCLUDED.year,
				license = EXCLUDED.license,
				updated_at = NOW()
			RETURNING id, title
		`;
		const albumId = rows[0].id;
		await sql`DELETE FROM tracks WHERE album_id = ${albumId}`;
		for (const t of album.tracks) {
			await sql`
				INSERT INTO tracks (album_id, position, title, duration_sec, stream_url)
				VALUES (${albumId}, ${t.position}, ${t.title}, ${t.durationSec}, ${t.streamUrl})
			`;
		}
		inserted.push({
			id: albumId,
			title: album.title,
			externalId: album.externalId,
		});
	}
	return inserted;
}

async function unseedVerifyShelf() {
	const sql = await getDbSql();
	return sql`
		DELETE FROM albums
		WHERE source = 'jamendo' AND external_id LIKE ${VERIFY_EXTERNAL_PREFIX + "%"}
		RETURNING id, title, external_id
	`;
}

async function ensureShelf() {
	const list = await rpc("albumList", { limit: 5 });
	const total = list.body?.json?.total ?? 0;
	if (total > 0) {
		const titles = (list.body?.json?.albums || []).map((a) => a.title);
		if (titles.includes(VERIFY_ALBUM_TITLE) || total >= 1) {
			// Prefer deterministic verify albums for drive recipes.
			const seeded = await seedVerifyShelf();
			const again = await rpc("albumList", { limit: 24 });
			return {
				source: "existing+verify",
				total: again.body?.json?.total ?? 0,
				seeded,
			};
		}
	}
	console.error(
		"control-long-play: shelf empty — applying verification scaffolding seed",
	);
	const seeded = await seedVerifyShelf();
	const again = await rpc("albumList", { limit: 5 });
	return {
		source: "verify-scaffold",
		total: again.body?.json?.total ?? 0,
		seeded,
	};
}

async function cmdLaunch() {
	const existing = readState();
	const webPids = portOwner(WEB_PORT);
	const serverPids = portOwner(SERVER_PORT);

	if (
		(webPids || serverPids) &&
		!existing?.ownedPids &&
		process.env.VERIFY_ATTACH !== "1"
	) {
		die(
			`ports ${SERVER_PORT}/${WEB_PORT} are in use by pids web=${(webPids || []).join(",")} server=${(serverPids || []).join(",")}, and this skill did not start them. Refuse to double-drive a shared instance. Stop those processes, then re-run launch (or set VERIFY_ATTACH=1 only for an instance you own).`,
		);
	}

	if (
		process.env.VERIFY_ATTACH === "1" ||
		(existing?.ownedPids && (webPids || serverPids))
	) {
		const runId = existing?.runId || `attach-${Date.now()}`;
		const artifactDirPath =
			existing?.artifactDir || join(SKILL_DIR, "artifacts", runId);
		mkdirSync(artifactDirPath, { recursive: true });
		const state = {
			runId,
			artifactDir: artifactDirPath,
			webUrl: WEB_URL,
			serverUrl: SERVER_URL,
			ownedPids: existing?.ownedPids || [
				...(webPids || []),
				...(serverPids || []),
			],
			attached: process.env.VERIFY_ATTACH === "1",
			startedAt: existing?.startedAt || new Date().toISOString(),
		};
		writeState(state);
		if (!(await waitReady({ timeoutMs: 15_000 }))) {
			die("stack not ready at localhost:5172 / localhost:5173");
		}
		const shelf = await ensureShelf();
		console.log(
			JSON.stringify(
				{
					ok: true,
					mode: state.attached ? "attach" : "reuse",
					shelf,
					...state,
				},
				null,
				2,
			),
		);
		return;
	}

	const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
	const artifactDirPath = join(SKILL_DIR, "artifacts", runId);
	mkdirSync(artifactDirPath, { recursive: true });
	const logPath = join(artifactDirPath, "dev.log");
	writeFileSync(logPath, "");
	const logFd = openSync(logPath, "a");

	const child = spawn("pnpm", ["run", "dev"], {
		cwd: REPO_ROOT,
		detached: true,
		stdio: ["ignore", logFd, logFd],
		env: { ...process.env },
	});
	child.unref();
	// Parent no longer needs the fd; child keeps its dup.
	try {
		closeSync(logFd);
	} catch {
		/* */
	}

	const state = {
		runId,
		artifactDir: artifactDirPath,
		webUrl: WEB_URL,
		serverUrl: SERVER_URL,
		devPid: child.pid,
		ownedPids: [child.pid],
		attached: false,
		startedAt: new Date().toISOString(),
		logPath,
	};
	writeState(state);

	if (!(await waitReady())) {
		await cmdCleanup({ keepEvidence: true });
		die(
			"launch timed out waiting for usable stack (GET / == OK, web 200, rpc healthCheck OK)",
		);
	}

	const listen = [
		...(portOwner(WEB_PORT) || []),
		...(portOwner(SERVER_PORT) || []),
	];
	state.ownedPids = Array.from(new Set([child.pid, ...listen]));
	writeState(state);

	const shelf = await ensureShelf();
	console.log(
		JSON.stringify({ ok: true, mode: "launch", shelf, ...state }, null, 2),
	);
}

async function cmdSeed() {
	const inserted = await seedVerifyShelf();
	const list = await rpc("albumList", { limit: 24 });
	console.log(
		JSON.stringify(
			{
				ok: true,
				inserted,
				total: list.body?.json?.total,
				albums: list.body?.json?.albums?.map((a) => a.title),
			},
			null,
			2,
		),
	);
}

async function cmdDoctor() {
	const state = readState();
	const webPids = portOwner(WEB_PORT);
	const serverPids = portOwner(SERVER_PORT);
	const issues = [];

	let health = null;
	let web = null;
	let rpcHealth = null;
	let albumList = null;
	try {
		health = await fetchText(`${SERVER_URL}/`);
	} catch (e) {
		issues.push(`server unreachable: ${e.message}`);
	}
	try {
		web = await fetchText(WEB_URL);
	} catch (e) {
		issues.push(`web unreachable: ${e.message}`);
	}
	try {
		rpcHealth = await rpc("healthCheck", {});
	} catch (e) {
		issues.push(`healthCheck failed: ${e.message}`);
	}
	try {
		albumList = await rpc("albumList", { limit: 5 });
	} catch (e) {
		issues.push(`albumList failed: ${e.message}`);
	}

	if (!health?.res?.ok || health?.text?.trim() !== "OK") {
		issues.push("GET / did not return OK");
	}
	if (!web?.res?.ok) issues.push("web did not return 200");
	if (rpcHealth?.body?.json !== "OK") issues.push("rpc healthCheck not OK");
	const total = albumList?.body?.json?.total ?? 0;
	if (total < 1) {
		issues.push("shelf empty (albumList.total < 1) — not worth driving");
	}

	const owned = state?.ownedPids || [];
	const listenPids = [...(webPids || []), ...(serverPids || [])];
	const ownedListen =
		state?.attached ||
		(listenPids.length > 0 &&
			listenPids.every(
				(pid) => owned.includes(pid) || owned.includes(state?.devPid),
			));

	const titles = (albumList?.body?.json?.albums || []).map((a) => a.title);
	const report = {
		ok: issues.length === 0,
		webUrl: WEB_URL,
		serverUrl: SERVER_URL,
		webPids,
		serverPids,
		runId: state?.runId ?? null,
		artifactDir: state?.artifactDir ?? null,
		ownedPids: owned,
		ownedListen: Boolean(ownedListen),
		shelfTotal: total,
		sampleTitles: titles,
		hasVerifyAlbum: titles.includes(VERIFY_ALBUM_TITLE),
		issues,
	};
	console.log(JSON.stringify(report, null, 2));
	if (!report.ok) process.exit(2);
}

async function cmdCleanup({ keepEvidence = true } = {}) {
	const state = readState();

	await stopBrowserDaemon().catch(() => {});

	let unseeded = [];
	try {
		unseeded = await unseedVerifyShelf();
	} catch (e) {
		console.error(`control-long-play: unseed warning: ${e.message}`);
	}

	if (state?.ownedPids?.length && !state.attached) {
		for (const pid of state.ownedPids) {
			try {
				process.kill(-pid, "SIGTERM");
			} catch {
				try {
					process.kill(pid, "SIGTERM");
				} catch {
					/* already gone */
				}
			}
		}
		await sleep(800);
		for (const pid of state.ownedPids) {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				/* gone */
			}
		}
		// Also clear any leftover listeners on the verification ports if we owned them.
		for (const port of [WEB_PORT, SERVER_PORT]) {
			const leftover = portOwner(port) || [];
			for (const pid of leftover) {
				if (state.ownedPids.includes(pid) || state.ownedPids.includes(-pid)) {
					try {
						process.kill(pid, "SIGKILL");
					} catch {
						/* */
					}
				}
			}
		}
	} else if (state?.attached) {
		console.error(
			"control-long-play: attached mode — not killing listen processes; only removed verify-* seed rows and browser daemon",
		);
	}

	const evidence = state?.artifactDir;
	clearState();
	console.log(
		JSON.stringify(
			{
				ok: true,
				unseeded: unseeded.map((r) => ({
					id: r.id,
					title: r.title,
					external_id: r.external_id,
				})),
				evidencePreserved: keepEvidence ? evidence : null,
				note: "Proof artifacts were not deleted",
			},
			null,
			2,
		),
	);
}

async function cmdRpc(args) {
	const procedure = args[0];
	if (!procedure) die("usage: rpc <procedure> [json-input]");
	const input = args[1] ? JSON.parse(args[1]) : {};
	const result = await rpc(procedure, input);
	console.log(JSON.stringify(result, null, 2));
	if (!result.ok) process.exit(1);
}

async function importPlaywright() {
	try {
		return await import("playwright");
	} catch {
		/* resolve from skill-local node_modules */
	}
	const localEntry = join(SKILL_DIR, "node_modules/playwright/index.js");
	if (existsSync(localEntry)) {
		const { pathToFileURL } = await import("node:url");
		return import(pathToFileURL(localEntry).href);
	}
	return null;
}

async function ensurePlaywright() {
	if (await importPlaywright()) return;
	console.error(
		"control-long-play: installing playwright into skill dir (verification scaffolding)…",
	);
	execFileSync("pnpm", ["install", "--ignore-workspace"], {
		cwd: SKILL_DIR,
		stdio: "inherit",
	});
	execFileSync("pnpm", ["exec", "playwright", "install", "chromium"], {
		cwd: SKILL_DIR,
		stdio: "inherit",
	});
	if (!(await importPlaywright())) {
		die("playwright still missing after skill-local install");
	}
}

async function launchChromium() {
	const pw = await importPlaywright();
	if (!pw?.chromium) die("playwright chromium export missing");
	const headed = process.env.VERIFY_HEADED === "1";
	try {
		return await pw.chromium.launch({
			channel: "chrome",
			headless: !headed,
		});
	} catch {
		return await pw.chromium.launch({ headless: !headed });
	}
}

async function startBrowserDaemon() {
	if (existsSync(DAEMON_PID)) {
		try {
			const pid = Number(readFileSync(DAEMON_PID, "utf8"));
			process.kill(pid, 0);
			return;
		} catch {
			try {
				unlinkSync(DAEMON_PID);
			} catch {
				/* */
			}
			try {
				unlinkSync(DAEMON_SOCK);
			} catch {
				/* */
			}
		}
	}

	await ensurePlaywright();
	const browser = await launchChromium();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		locale: "en-US",
	});
	const page = await context.newPage();
	await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });

	if (existsSync(DAEMON_SOCK)) {
		try {
			unlinkSync(DAEMON_SOCK);
		} catch {
			/* */
		}
	}

	const server = createServer((socket) => {
		const rl = createInterface({ input: socket });
		rl.on("line", async (line) => {
			let msg;
			try {
				msg = JSON.parse(line);
			} catch (e) {
				socket.write(`${JSON.stringify({ ok: false, error: String(e) })}\n`);
				return;
			}
			try {
				const result = await handleBrowserCommand(page, msg);
				socket.write(`${JSON.stringify({ ok: true, ...result })}\n`);
			} catch (e) {
				socket.write(
					`${JSON.stringify({ ok: false, error: e.message || String(e) })}\n`,
				);
			}
		});
	});

	await new Promise((resolvePromise, reject) => {
		server.listen(DAEMON_SOCK, (err) => (err ? reject(err) : resolvePromise()));
	});
	writeFileSync(DAEMON_PID, String(process.pid));

	const shutdown = async () => {
		try {
			server.close();
		} catch {
			/* */
		}
		try {
			await browser.close();
		} catch {
			/* */
		}
		try {
			unlinkSync(DAEMON_SOCK);
		} catch {
			/* */
		}
		try {
			unlinkSync(DAEMON_PID);
		} catch {
			/* */
		}
		process.exit(0);
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	await new Promise(() => {});
}

function buildLocator(page, msg) {
	if (msg.role) {
		const opts = {};
		if (msg.name) opts.name = msg.name;
		if (msg.exact != null) opts.exact = msg.exact;
		return page.getByRole(msg.role, opts).nth(msg.nth ?? 0);
	}
	if (msg.text) {
		return page
			.getByText(msg.text, { exact: msg.exact ?? false })
			.nth(msg.nth ?? 0);
	}
	if (msg.label) {
		return page
			.getByLabel(msg.label, { exact: msg.exact ?? false })
			.nth(msg.nth ?? 0);
	}
	if (msg.testId) {
		return page.getByTestId(msg.testId);
	}
	if (msg.css) {
		return page.locator(msg.css).nth(msg.nth ?? 0);
	}
	throw new Error(
		"locator requires --role/--name, --text, --label, --test-id, or --css",
	);
}

async function handleBrowserCommand(page, msg) {
	const { cmd } = msg;
	switch (cmd) {
		case "goto": {
			await page.goto(
				msg.url.startsWith("http") ? msg.url : `${WEB_URL}${msg.url}`,
				{
					waitUntil: "domcontentloaded",
				},
			);
			await page.waitForLoadState("networkidle").catch(() => {});
			return { url: page.url(), title: await page.title() };
		}
		case "click": {
			const locator = buildLocator(page, msg);
			await locator.click({ timeout: msg.timeoutMs ?? 15_000 });
			await page.waitForLoadState("networkidle").catch(() => {});
			return { url: page.url(), title: await page.title() };
		}
		case "fill": {
			const locator = buildLocator(page, msg);
			await locator.fill(msg.value ?? "", { timeout: msg.timeoutMs ?? 15_000 });
			return { filled: true };
		}
		case "press": {
			await page.keyboard.press(msg.key);
			return { pressed: msg.key };
		}
		case "wait": {
			if (msg.text) {
				await page
					.getByText(msg.text, { exact: msg.exact ?? false })
					.first()
					.waitFor({ timeout: msg.timeoutMs ?? 15_000 });
			} else if (msg.role) {
				await buildLocator(page, msg).waitFor({
					timeout: msg.timeoutMs ?? 15_000,
				});
			} else if (msg.ms) {
				await page.waitForTimeout(msg.ms);
			}
			return { waited: true };
		}
		case "screenshot": {
			const state = readState();
			const dir = artifactDir(state);
			const path = resolve(
				msg.path?.startsWith("/")
					? msg.path
					: join(dir, msg.path || "shot.png"),
			);
			mkdirSync(dirname(path), { recursive: true });
			await page.screenshot({ path, fullPage: Boolean(msg.fullPage) });
			return { path };
		}
		case "snapshot": {
			const state = readState();
			const dir = artifactDir(state);
			const path = resolve(
				msg.path?.startsWith("/")
					? msg.path
					: join(dir, msg.path || "aria.txt"),
			);
			mkdirSync(dirname(path), { recursive: true });
			const snapshot = await page.locator("body").ariaSnapshot();
			const title = await page.title();
			const url = page.url();
			const text = [`# url: ${url}`, `# title: ${title}`, "", snapshot].join(
				"\n",
			);
			writeFileSync(path, text);
			return { path, title, url };
		}
		case "eval": {
			const value = await page.evaluate(msg.expression);
			return { value };
		}
		case "content": {
			return {
				url: page.url(),
				title: await page.title(),
				text: await page.locator("body").innerText(),
			};
		}
		default:
			throw new Error(`unknown browser cmd: ${cmd}`);
	}
}

function sendBrowser(msg) {
	return new Promise((resolvePromise, reject) => {
		const sock = createConnection(DAEMON_SOCK);
		let buf = "";
		sock.on("connect", () => {
			sock.write(`${JSON.stringify(msg)}\n`);
		});
		sock.on("data", (chunk) => {
			buf += chunk.toString("utf8");
			if (buf.includes("\n")) {
				const line = buf.split("\n")[0];
				sock.end();
				try {
					const parsed = JSON.parse(line);
					if (!parsed.ok)
						reject(new Error(parsed.error || "browser command failed"));
					else resolvePromise(parsed);
				} catch (e) {
					reject(e);
				}
			}
		});
		sock.on("error", reject);
	});
}

async function stopBrowserDaemon() {
	if (existsSync(DAEMON_PID)) {
		const pid = Number(readFileSync(DAEMON_PID, "utf8"));
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			/* */
		}
		await sleep(400);
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			/* */
		}
		try {
			unlinkSync(DAEMON_PID);
		} catch {
			/* */
		}
	}
	if (existsSync(DAEMON_SOCK)) {
		try {
			unlinkSync(DAEMON_SOCK);
		} catch {
			/* */
		}
	}
}

async function ensureBrowserDaemon() {
	if (existsSync(DAEMON_SOCK)) {
		try {
			await sendBrowser({ cmd: "content" });
			return;
		} catch {
			await stopBrowserDaemon();
		}
	}
	await ensurePlaywright();
	const child = spawn(
		process.execPath,
		[fileURLToPath(import.meta.url), "_browser-daemon"],
		{
			cwd: REPO_ROOT,
			detached: true,
			stdio: "ignore",
			env: { ...process.env },
		},
	);
	child.unref();
	const start = Date.now();
	while (Date.now() - start < 45_000) {
		if (existsSync(DAEMON_SOCK)) {
			try {
				await sendBrowser({ cmd: "content" });
				return;
			} catch {
				/* retry */
			}
		}
		await sleep(250);
	}
	die("browser daemon failed to start");
}

function parseBrowserArgs(argv) {
	const cmd = argv[0];
	const out = { cmd };
	for (let i = 1; i < argv.length; i++) {
		const a = argv[i];
		const next = argv[i + 1];
		const take = () => {
			i++;
			return next;
		};
		switch (a) {
			case "--url":
				out.url = take();
				break;
			case "--role":
				out.role = take();
				break;
			case "--name":
				out.name = take();
				break;
			case "--text":
				out.text = take();
				break;
			case "--label":
				out.label = take();
				break;
			case "--value":
				out.value = take();
				break;
			case "--key":
				out.key = take();
				break;
			case "--path":
				out.path = take();
				break;
			case "--css":
				out.css = take();
				break;
			case "--test-id":
				out.testId = take();
				break;
			case "--expression":
				out.expression = take();
				break;
			case "--ms":
				out.ms = Number(take());
				break;
			case "--nth":
				out.nth = Number(take());
				break;
			case "--timeout-ms":
				out.timeoutMs = Number(take());
				break;
			case "--full-page":
				out.fullPage = true;
				break;
			case "--exact":
				out.exact = true;
				break;
			case "start":
			case "stop":
				out.cmd = a;
				break;
			default:
				if (!out.url && cmd === "goto") out.url = a;
				break;
		}
	}
	return out;
}

async function cmdBrowser(argv) {
	const msg = parseBrowserArgs(argv);
	if (msg.cmd === "start") {
		await ensureBrowserDaemon();
		console.log(JSON.stringify({ ok: true, daemon: true }, null, 2));
		return;
	}
	if (msg.cmd === "stop") {
		await stopBrowserDaemon();
		console.log(JSON.stringify({ ok: true, stopped: true }, null, 2));
		return;
	}
	await ensureBrowserDaemon();
	const result = await sendBrowser(msg);
	console.log(JSON.stringify(result, null, 2));
}

async function cmdDrive(argv) {
	const feature = argv[0];
	if (feature === "browse-shelf") {
		await driveBrowseShelf();
		return;
	}
	if (feature === "play-album") {
		await drivePlayAlbum();
		return;
	}
	die(
		`drive implements: browse-shelf | play-album (got ${feature ?? "nothing"})`,
	);
}

async function driveBrowseShelf() {
	const state = readState();
	if (!state) die("run launch first");
	const dir = join(artifactDir(state), "browse-shelf");
	mkdirSync(dir, { recursive: true });
	await ensureBrowserDaemon();

	const steps = [];
	const record = async (name, fn) => {
		const result = await fn();
		steps.push({ name, ...result });
		return result;
	};

	await record("goto-home", () => sendBrowser({ cmd: "goto", url: "/" }));
	await record("wait-brand", () =>
		sendBrowser({
			cmd: "wait",
			role: "link",
			name: "Long Play home",
			timeoutMs: 20_000,
		}),
	);
	await record("wait-heading", () =>
		sendBrowser({
			cmd: "wait",
			role: "heading",
			name: "Home",
			timeoutMs: 20_000,
		}),
	);
	await record("wait-album", () =>
		sendBrowser({
			cmd: "wait",
			text: VERIFY_ALBUM_TITLE,
			timeoutMs: 20_000,
		}),
	);
	await record("snapshot-home", () =>
		sendBrowser({ cmd: "snapshot", path: join(dir, "home.aria.txt") }),
	);
	await record("screenshot-home", () =>
		sendBrowser({
			cmd: "screenshot",
			path: join(dir, "home.png"),
			fullPage: true,
		}),
	);
	await record("open-album", () =>
		sendBrowser({ cmd: "click", text: VERIFY_ALBUM_TITLE, nth: 0 }),
	);
	await record("wait-album-page", () =>
		sendBrowser({
			cmd: "wait",
			role: "heading",
			name: VERIFY_ALBUM_TITLE,
			timeoutMs: 20_000,
		}),
	);
	await record("wait-play", () =>
		sendBrowser({
			cmd: "wait",
			role: "button",
			name: "Play album",
			timeoutMs: 10_000,
		}),
	);
	await record("snapshot-album", () =>
		sendBrowser({ cmd: "snapshot", path: join(dir, "album.aria.txt") }),
	);
	await record("screenshot-album", () =>
		sendBrowser({
			cmd: "screenshot",
			path: join(dir, "album.png"),
			fullPage: true,
		}),
	);

	const albumList = await rpc("albumList", { limit: 24 });
	const titles = (albumList.body?.json?.albums || []).map((a) => a.title);
	const homeAria = readFileSync(join(dir, "home.aria.txt"), "utf8");
	const albumAria = readFileSync(join(dir, "album.aria.txt"), "utf8");
	const proof = {
		ok:
			titles.includes(VERIFY_ALBUM_TITLE) &&
			homeAria.includes(VERIFY_ALBUM_TITLE) &&
			albumAria.includes("Play album") &&
			albumAria.includes(VERIFY_ALBUM_TITLE),
		feature: "browse-shelf",
		steps: steps.map((s) => ({
			name: s.name,
			url: s.url,
			title: s.title,
			path: s.path,
		})),
		shelfTitles: titles,
		artifacts: {
			homeAria: join(dir, "home.aria.txt"),
			homePng: join(dir, "home.png"),
			albumAria: join(dir, "album.aria.txt"),
			albumPng: join(dir, "album.png"),
			proof: join(dir, "proof.json"),
		},
	};
	writeFileSync(join(dir, "proof.json"), JSON.stringify(proof, null, 2));
	console.log(JSON.stringify(proof, null, 2));
	if (!proof.ok) process.exit(1);
}

async function drivePlayAlbum() {
	const state = readState();
	if (!state) die("run launch first");
	const dir = join(artifactDir(state), "play-album");
	mkdirSync(dir, { recursive: true });
	await ensureBrowserDaemon();

	const steps = [];
	const record = async (name, fn) => {
		const result = await fn();
		steps.push({ name, ...result });
		return result;
	};

	await record("goto-home", () => sendBrowser({ cmd: "goto", url: "/" }));
	await record("wait-album", () =>
		sendBrowser({
			cmd: "wait",
			text: VERIFY_ALBUM_TITLE,
			timeoutMs: 20_000,
		}),
	);
	await record("open-album", () =>
		sendBrowser({ cmd: "click", text: VERIFY_ALBUM_TITLE, nth: 0 }),
	);
	await record("wait-play", () =>
		sendBrowser({
			cmd: "wait",
			role: "button",
			name: "Play album",
			timeoutMs: 15_000,
		}),
	);
	await record("snapshot-before", () =>
		sendBrowser({ cmd: "snapshot", path: join(dir, "before.aria.txt") }),
	);
	await record("click-play", () =>
		sendBrowser({ cmd: "click", role: "button", name: "Play album" }),
	);
	await record("wait-miniplayer", () =>
		sendBrowser({
			cmd: "wait",
			text: "Verify Track 1",
			timeoutMs: 20_000,
		}),
	);
	await sleep(1500);
	const audioState = await sendBrowser({
		cmd: "eval",
		expression: `(() => {
			const audios = Array.from(document.querySelectorAll('audio'));
			return audios.map(a => ({
				src: a.currentSrc || a.src || '',
				paused: a.paused,
				readyState: a.readyState,
				currentTime: a.currentTime,
			}));
		})()`,
	});
	steps.push({ name: "audio-state", value: audioState.value });

	await record("snapshot-playing", () =>
		sendBrowser({ cmd: "snapshot", path: join(dir, "playing.aria.txt") }),
	);
	await record("screenshot-playing", () =>
		sendBrowser({
			cmd: "screenshot",
			path: join(dir, "playing.png"),
			fullPage: true,
		}),
	);

	const playingAria = readFileSync(join(dir, "playing.aria.txt"), "utf8");
	const audios = audioState.value || [];
	const proxyHit = audios.some((a) =>
		String(a.src || "").includes("/proxy/audio/"),
	);
	const progressing = audios.some(
		(a) => !a.paused || a.currentTime > 0 || a.readyState >= 2,
	);
	const proof = {
		ok:
			playingAria.includes("Verify Track 1") &&
			playingAria.includes(VERIFY_ALBUM_TITLE) &&
			proxyHit &&
			progressing,
		feature: "play-album",
		steps: steps.map((s) => ({
			name: s.name,
			url: s.url,
			title: s.title,
			path: s.path,
			value: s.value,
		})),
		audio: audios,
		artifacts: {
			beforeAria: join(dir, "before.aria.txt"),
			playingAria: join(dir, "playing.aria.txt"),
			playingPng: join(dir, "playing.png"),
			proof: join(dir, "proof.json"),
		},
	};
	writeFileSync(join(dir, "proof.json"), JSON.stringify(proof, null, 2));
	console.log(JSON.stringify(proof, null, 2));
	if (!proof.ok) process.exit(1);
}

async function main() {
	const [cmd, ...rest] = process.argv.slice(2);
	if (!cmd) {
		console.log(
			"usage: control-long-play <launch|doctor|seed|cleanup|rpc|browser|drive|_browser-daemon>",
		);
		process.exit(1);
	}
	switch (cmd) {
		case "launch":
			await cmdLaunch();
			break;
		case "doctor":
			await cmdDoctor();
			break;
		case "seed":
			await cmdSeed();
			break;
		case "cleanup":
			await cmdCleanup();
			break;
		case "rpc":
			await cmdRpc(rest);
			break;
		case "browser":
			await cmdBrowser(rest);
			break;
		case "drive":
			await cmdDrive(rest);
			break;
		case "_browser-daemon":
			await startBrowserDaemon();
			break;
		default:
			die(`unknown command: ${cmd}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
