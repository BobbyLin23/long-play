import { env } from "@long-play/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function createDb() {
	const client = neon(env.DATABASE_URL);

	return drizzle({ client, schema });
}

export const db = createDb();
