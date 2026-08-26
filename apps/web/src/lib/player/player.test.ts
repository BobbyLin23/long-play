import { expect, test } from "vitest";

import { albumTracks, createPlayer } from "./testing";

test("Listener can load an Album queue and start at the first Track", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive", "Dawn"]));

	expect(player.currentTrack?.title).toBe("Intro");
	expect(player.isPlaying).toBe(true);
});

test("when a Track ends, the next Track in the Album plays", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive", "Dawn"]));

	player.ended();

	expect(player.currentTrack?.title).toBe("Night Drive");
	expect(player.isPlaying).toBe(true);
});

test("when the last Track of an Album ends, playback stops", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive"]), 1);

	player.ended();

	expect(player.currentTrack?.title).toBe("Night Drive");
	expect(player.isPlaying).toBe(false);
});

test("Listener can skip to the next Track in the Album", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive", "Dawn"]));

	player.next();

	expect(player.currentTrack?.title).toBe("Night Drive");
});

test("Listener can skip to the previous Track in the Album", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive", "Dawn"]), 1);

	player.prev();

	expect(player.currentTrack?.title).toBe("Intro");
});

test("Listener can start playback at a Track inside an Album", () => {
	const player = createPlayer();
	player.playQueue(albumTracks(["Intro", "Night Drive", "Dawn"]), 1);

	expect(player.currentTrack?.title).toBe("Night Drive");
	expect(player.isPlaying).toBe(true);
});
