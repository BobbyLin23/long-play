import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		JAMENDO_CLIENT_ID: z.string().optional(),
		// L2 音频磁盘缓存（临时加速层；容量 0 表示禁用）
		AUDIO_CACHE_DIR: z.string().default("./.audio-cache"),
		AUDIO_CACHE_MAX_MB: z.coerce.number().default(512),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
