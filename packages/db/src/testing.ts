import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "./database";
import * as schema from "./schema";

/** In-memory Postgres for procedure tests. Do not import from production code. */

const migrationsFolder = join(
	dirname(fileURLToPath(import.meta.url)),
	"migrations",
);

export async function createTestDb() {
	const client = new PGlite();
	const db = drizzle({ client, schema });
	await migrate(db, { migrationsFolder });
	return {
		db: db as Database,
		async close() {
			await client.close();
		},
	};
}
