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

test("logged-out Listener sees Jamendo albums on the shelf and not SoundHelix or Archive albums", async () => {
	const { client, db, close } = await createProcedureClient();
	try {
		await db.insert(albums).values([
			{
				source: "jamendo",
				externalId: "jamendo-1",
				title: "Night Drive",
				artist: "Aero",
			},
			{
				source: "soundhelix",
				externalId: "1",
				title: "SoundHelix Vol. 1",
				artist: "SoundHelix",
			},
			{
				source: "archive",
				externalId: "ia-1",
				title: "Cylinder Record",
				artist: "Unknown",
			},
		]);

		const result = await client.albumList({});

		expect(result.albums.map((album) => album.title)).toEqual(["Night Drive"]);
		expect(result.total).toBe(1);
	} finally {
		await close();
	}
});

test("Listener sees Artist and License on Album detail", async () => {
	const { client, db, close } = await createProcedureClient();
	try {
		const [album] = await db
			.insert(albums)
			.values({
				source: "jamendo",
				externalId: "jamendo-1",
				title: "Night Drive",
				artist: "Aero",
				license: "https://creativecommons.org/licenses/by-nc-nd/3.0/",
			})
			.returning({ id: albums.id });
		if (!album) throw new Error("expected album row");

		const result = await client.albumDetail({ id: album.id });

		expect(result.artist).toBe("Aero");
		expect(result.license).toBe(
			"https://creativecommons.org/licenses/by-nc-nd/3.0/",
		);
	} finally {
		await close();
	}
});

test("Listener sees Genre labels on an admitted Album", async () => {
	const { client, db, close } = await createProcedureClient();
	try {
		const [album] = await db
			.insert(albums)
			.values({
				source: "jamendo",
				externalId: "jamendo-1",
				title: "Night Drive",
				artist: "Aero",
				genres: ["electronic", "jazz"],
			})
			.returning({ id: albums.id });
		if (!album) throw new Error("expected album row");

		const result = await client.albumDetail({ id: album.id });

		expect(result.genres).toEqual(["electronic", "jazz"]);
	} finally {
		await close();
	}
});

test("Listener cannot open a SoundHelix Album", async () => {
	const { client, db, close } = await createProcedureClient();
	try {
		const [album] = await db
			.insert(albums)
			.values({
				source: "soundhelix",
				externalId: "1",
				title: "SoundHelix Vol. 1",
				artist: "SoundHelix",
			})
			.returning({ id: albums.id });
		if (!album) throw new Error("expected album row");

		await expect(client.albumDetail({ id: album.id })).rejects.toThrow(
			"Album not found",
		);
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
