#!/usr/bin/env node
/**
 * One-command check for verify-audio-proxy-upstream.
 * From repo root:
 *   node .cursor/skills/verify-audio-proxy-upstream/scripts/check.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(skillDir, "../../..");
const proxyPath = join(repoRoot, "apps/server/src/audio-proxy.ts");

if (!existsSync(proxyPath)) {
	console.error(
		`verify-audio-proxy-upstream: missing ${proxyPath} — run from the long-play repo`,
	);
	process.exit(2);
}

if (!existsSync(join(skillDir, "node_modules/vitest"))) {
	const install = spawnSync("npm", ["install", "--no-fund", "--no-audit"], {
		cwd: skillDir,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (install.status !== 0) process.exit(install.status ?? 1);
}

const result = spawnSync(
	"npx",
	["vitest", "run", "--config", "vitest.config.ts"],
	{
		cwd: skillDir,
		stdio: "inherit",
		shell: process.platform === "win32",
		env: {
			...process.env,
			SKIP_ENV_VALIDATION: "1",
			NODE_PATH: [
				join(repoRoot, "apps/server/node_modules"),
				join(repoRoot, "packages/db/node_modules"),
				join(repoRoot, "node_modules"),
				process.env.NODE_PATH,
			]
				.filter(Boolean)
				.join(process.platform === "win32" ? ";" : ":"),
		},
	},
);

process.exit(result.status ?? 1);
