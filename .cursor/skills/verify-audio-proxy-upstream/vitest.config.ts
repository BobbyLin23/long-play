import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(skillDir, "../../..");
const serverSrc = path.join(repoRoot, "apps/server/src");

export default defineConfig({
	root: skillDir,
	resolve: {
		alias: [
			{
				find: "@long-play/db/schema/music",
				replacement: path.join(repoRoot, "packages/db/src/schema/music.ts"),
			},
			{
				find: "@long-play/db/schema/auth",
				replacement: path.join(repoRoot, "packages/db/src/schema/auth.ts"),
			},
			{
				find: "@long-play/db",
				replacement: path.join(skillDir, "mocks/db.ts"),
			},
			{
				find: path.join(serverSrc, "audio-cache.ts"),
				replacement: path.join(skillDir, "mocks/audio-cache.ts"),
			},
			{
				find: path.join(serverSrc, "audio-cache"),
				replacement: path.join(skillDir, "mocks/audio-cache.ts"),
			},
		],
	},
	test: {
		environment: "node",
		include: ["check/**/*.test.ts"],
		fileParallelism: false,
		server: {
			deps: {
				inline: ["elysia", "@long-play/db", "drizzle-orm"],
			},
		},
	},
});
