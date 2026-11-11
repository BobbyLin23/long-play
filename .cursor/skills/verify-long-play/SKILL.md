---
name: verify-long-play
description: Drive the Long Play web app (SvelteKit UI + Elysia API) the way a listener does — launch the local stack, browse the shelf, play an album through the audio proxy, and capture proof. Use when proving UI/API behavior, after shelf/player/auth changes, or when a run needs scripted end-to-end evidence for Long Play.
---

# Verify Long Play

Long Play is an album-first music web app. Listeners browse a curated Jamendo shelf, open an album, and stream tracks via the server audio proxy. Auth/Favourites exist but Saving from an album page is not wired in the UI yet. This skill drives the **primary surface: the web UI** at `http://localhost:5173` against the API at `http://localhost:5172`. Desktop (Electrobun) and Scalar `/api-reference` are secondary — do not treat them as the proof target unless a feature file says so.

Read `features/README.md` before driving. The feature map is the maintained source of journeys; do not invent a shorter path that skips listed entry points.

## Launch

Ports **5172** (server) and **5173** (web) are hardcoded in the product. Two verification stacks cannot run side by side on one machine. If those ports already listen and this skill did not start them, **refuse** — do not drive a shared developer session.

From the repo root, with `apps/server/.env` (`DATABASE_URL`, `BETTER_AUTH_*`, `CORS_ORIGIN`) and `apps/web/.env` (`PUBLIC_SERVER_URL=http://localhost:5172`) present:

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs launch
```

Ready means all of:

1. `GET http://localhost:5172/` returns body `OK`
2. `GET http://localhost:5173/` returns HTTP 200
3. `POST http://localhost:5172/rpc/healthCheck` with `{"json":{}}` returns `{"json":"OK"}`
4. `albumList` reports `total >= 1` (launch upserts verification scaffolding albums with `external_id` prefix `verify-` and SoundHelix stream URLs when needed — marked scaffolding, removed on cleanup)

Launch writes `.cursor/skills/verify-long-play/.run-state.json` and creates `artifacts/<runId>/` (including `dev.log`). Attach to an instance you already own only with `VERIFY_ATTACH=1`.

Teardown (keeps evidence):

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs cleanup
```

## Doctor

Read-only health before any drive:

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs doctor
```

Expect `ok: true`, both ports listening, `shelfTotal >= 1`, and preferably `hasVerifyAlbum: true`. Exit code `2` means do not drive — fix launch/seed first.

## Drive

Harness: Playwright Chromium (or system Chrome) behind a Unix-socket browser daemon managed by `control-long-play`. Prefer ARIA roles and visible text from this app:

| Handle | Meaning |
| --- | --- |
| `link` name `Long Play home` | Brand / home |
| `navigation` name `Primary navigation` | Sidebar nav |
| `link` name `Home` / `Discovery` / `Search` / `Favourites` | Nav items (Favourites only when signed in) |
| `heading` name `Home` | Shelf page |
| Text `Verify Night Drive` | Scaffolding album on the shelf |
| `button` name `Play album` | Album primary action |
| `button` name `Play` / `Pause` (mini player) | Transport |
| `link` name `Log in` | Auth entry |

Examples:

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser start
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser goto --url /
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser wait --role heading --name Home
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser click --text "Verify Night Drive"
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser snapshot --path browse/home.aria.txt
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs browser screenshot --path browse/home.png --full-page
```

Scripted feature recipes:

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs drive browse-shelf
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs drive play-album
```

Raw oRPC (not a UI substitute for mapped UI journeys):

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs rpc albumList '{"limit":5}'
```

Optional seed without relaunch:

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs seed
```

## Evidence

Proof artifacts live under:

`.cursor/skills/verify-long-play/artifacts/<runId>/`

Standards:

- Exercise the **real listener path** in the browser (Home → album → Play). Do not call internal player setters or invent test-only endpoints as proof of UI.
- Capture **action + resulting state**: ARIA snapshot and screenshot before/after where the journey mutates; for play, also capture `<audio>` `src` containing `/proxy/audio/` and non-idle playback state.
- Verify side effects alongside UI: shelf rows via `albumList`, streamed bytes via proxy URL on the audio element.
- Mocks only at production boundaries already isolated (Jamendo is seed-time only; SoundHelix URLs in `verify-*` rows are scaffolding for empty DBs).
- Record feature id and entry point with every artifact (`proof.json` from `drive`).

Cleanup **must not** delete this directory. After cleanup, confirm the run's artifact folder still exists.

## Cleanup

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs cleanup
```

- Stops the browser daemon this run started.
- Deletes only albums whose `external_id` starts with `verify-` (and cascaded tracks).
- SIGTERM/SIGKILL only PIDs recorded in `.run-state.json` when not in attach mode — never kill by process name.
- Clears `.run-state.json` and daemon sock/pid files.
- Leaves `artifacts/<runId>/` intact.

## Helpers

Executable harness (Node ESM, no build step):

```bash
node .cursor/skills/verify-long-play/scripts/control-long-play.mjs <launch|doctor|seed|cleanup|rpc|browser|drive>
```

On first browser use it may run `pnpm install --ignore-workspace` in `.cursor/skills/verify-long-play/` (local `package.json` with Playwright only) and `playwright install chromium` — that is verification scaffolding, not an app dependency. Skill `node_modules/` is gitignored.

## Isolate

Ports are fixed at 5172/5173. Concurrent verification on one host is unsupported. Neon `DATABASE_URL` is shared with local dev — scaffolding is namespaced to `verify-*` external ids so cleanup cannot wipe product Jamendo rows. Do not run `db:push` destructive ops as part of verification.

## Maintenance

After product changes that move routes, labels, or shelf rules, run `/maintain-verification-skill` against this skill so the feature map stays honest.
