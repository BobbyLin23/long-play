# Long Play verification map

This directory is the maintained source for verifying listener-facing behavior of Long Play. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch via `node .cursor/skills/verify-long-play/scripts/control-long-play.mjs launch` so web is at `http://localhost:5173` and API at `http://localhost:5172`.
- Require `doctor` to report `ok: true` and `shelfTotal >= 1`.
- Prefer a shelf that includes scaffolding album `Verify Night Drive` (`hasVerifyAlbum: true`). Launch upserts it; cleanup removes only `verify-*` rows.
- Never drive an instance this skill did not start (or attach with `VERIFY_ATTACH=1` only when you own that stack).
- Ports 5172/5173 cannot host two stacks at once on one machine.

## Driving conventions

- Start every recipe from Home unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names (`Long Play home`, `Play album`, nav link names) over CSS or coordinates.
- Run browser actions through `control-long-play browser` or the `drive <feature>` shortcuts.
- Use `rpc` only to confirm shelf side effects, not as a substitute for UI journeys listed below.
- Cleanup removes scaffolding rows and owned processes; it must leave proof artifacts under `artifacts/<runId>/`.

## Proof and skip reporting

- Capture the user action and the resulting state (ARIA snapshot + screenshot). Playback proof also needs audio element `/proxy/audio/` src and non-idle media state.
- Record the feature ID and entry point in `proof.json`.
- Report an unreachable path with the unmet precondition. Do not mark a skipped entry point as verified via a different path.
- `/search` is a stub (title only). Do not weaken journeys to treat the stub as working search.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior, then exactly four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with control-long-play`, `Gotchas`.

## Features

- [Browse shelf](./browse-shelf.md) — Home/Discovery album grid, open album detail.
- [Play album](./play-album.md) — Play album into the mini player through the audio proxy.
- [Log in](./log-in.md) — Email/password sign-in and session chrome.
- [Favourites / playlists](./favourites-playlists.md) — Signed-in library lists (Save-from-album still missing).
- [Search](./search.md) — Nav entry and stub page (document current empty state).
