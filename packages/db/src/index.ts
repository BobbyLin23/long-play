import { env } from "@long-play/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import type { Database } from "./database";
import * as schema from "./schema";

export type { Database } from "./database";

export function createDb(): Database {
	const client = neon(env.DATABASE_URL);

	return drizzle({ client, schema });
}

export const db = createDb();
