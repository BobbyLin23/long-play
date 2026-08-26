import { albums } from "@long-play/db/schema/music";
import { ORPCError } from "@orpc/server";
import { expect, test } from "vitest";

import { createProcedureClient, listenerSession } from "./testing";

test("logged-out Listener can list albums from the test DB", async () => {
	const { client, db, close } = await createProcedureClient();
	try {
		await db.insert(albums).values({
			source: "jamendo",
			externalId: "jamendo-1",
			title: "Night Drive",
			artist: "Aero",
		});

		const result = await client.albumList({});

		expect(result.albums.map((album) => album.title)).toEqual(["Night Drive"]);
	} finally {
		await close();
	}
});

test("signed-out Listener is unauthorized on a protected procedure", async () => {
	const { client, close } = await createProcedureClient();
	try {
		await expect(client.privateData()).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof ORPCError && error.code === "UNAUTHORIZED",
		);
	} finally {
		await close();
	}
});

test("signed-in Listener can call a protected procedure with a session fixture", async () => {
	const session = listenerSession();
	const { client, close } = await createProcedureClient({ session });
	try {
		const result = await client.privateData();
		expect(result.user?.id).toBe(session.user.id);
		expect(result.user?.email).toBe("ada@example.com");
	} finally {
		await close();
	}
});
