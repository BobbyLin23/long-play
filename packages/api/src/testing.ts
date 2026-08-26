import { user } from "@long-play/db/schema/auth";
import { createTestDb } from "@long-play/db/testing";
import { createRouterClient } from "@orpc/server";

import type { Context } from "./context";
import { appRouter } from "./routers/index";

/** Seam 1: call procedures against a test DB. Seed via `db`; assert returned albums and errors. */

export type ProcedureSession = NonNullable<Context["session"]>;

const FIXTURE_AT = new Date("2026-01-01T00:00:00.000Z");

export function listenerSession(
	overrides: { id?: string; name?: string; email?: string } = {},
): ProcedureSession {
	const id = overrides.id ?? "listener-1";
	return {
		user: {
			id,
			name: overrides.name ?? "Ada",
			email: overrides.email ?? "ada@example.com",
			emailVerified: true,
			createdAt: FIXTURE_AT,
			updatedAt: FIXTURE_AT,
			image: null,
		},
		session: {
			id: `session-${id}`,
			userId: id,
			token: `token-${id}`,
			expiresAt: new Date("2099-01-01T00:00:00.000Z"),
			createdAt: FIXTURE_AT,
			updatedAt: FIXTURE_AT,
			ipAddress: null,
			userAgent: null,
		},
	};
}

export async function createProcedureClient(
	options: { session?: ProcedureSession | null } = {},
) {
	const testDb = await createTestDb();
	const session = options.session ?? null;

	if (session) {
		await testDb.db.insert(user).values({
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			emailVerified: session.user.emailVerified,
			image: session.user.image,
			createdAt: session.user.createdAt,
			updatedAt: session.user.updatedAt,
		});
	}

	const client = createRouterClient(appRouter, {
		context: {
			auth: null,
			session,
			db: testDb.db,
		},
	});

	return {
		client,
		db: testDb.db,
		close: testDb.close,
	};
}
