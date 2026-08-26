import { auth } from "@long-play/auth";
import type { Database } from "@long-play/db";
import { db } from "@long-play/db";
import type { Context as ElysiaContext } from "elysia";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export type Context = {
	auth: null;
	session: Awaited<ReturnType<typeof auth.api.getSession>>;
	db: Database;
};

export async function createContext({
	context,
}: CreateContextOptions): Promise<Context> {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		auth: null,
		session,
		db,
	};
}
