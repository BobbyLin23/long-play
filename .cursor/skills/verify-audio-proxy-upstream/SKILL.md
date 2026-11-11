---
name: verify-audio-proxy-upstream
description: Formally check that Long Play's audio proxy never fetches a client-supplied URL — only tracks.streamUrl for the path trackId. Use when changing apps/server/src/audio-proxy.ts or resolveUpstream, when touching /proxy/audio, or when a change could turn the Range proxy into an open proxy/SSRF.
---

# Verify audio proxy upstream binding

**Property (one sentence):** Every upstream `fetch` the audio proxy makes uses exactly `tracks.streamUrl` for `params.trackId`, never a URL from the query string, headers, or body.

**Harm if broken:** The route becomes an open proxy / SSRF gadget: a listener (or anyone who can hit the server) can make Long Play's server fetch arbitrary URLs.

## When this skill applies

Run this check when a change touches any of:

| Path | Why |
| --- | --- |
| `apps/server/src/audio-proxy.ts` | `resolveUpstream` + `GET /proxy/audio/:trackId` |
| `apps/server/src/index.ts` | mounts `audioProxyRoutes` |
| `apps/web/src/lib/player/audio.ts` | builds `/proxy/audio/${trackId}` |

If the change is only L2 disk cache (`audio-cache.ts`) and does not alter how `upstreamUrl` is chosen, this property is unchanged — still safe to re-run; expect a pass.

## Coverage record

| Item | Value |
| --- | --- |
| Property | No open URL proxy: `fetch` target ∈ `{ streamUrl(trackId) }` or no `fetch` (404) |
| Tool | Vitest property tests against the real `audioProxyRoutes` (TypeScript has no in-repo code verifier; generated inputs on the real handler) |
| Tool version | `vitest@3.2.7` (pinned by this skill's `package.json` / lockfile on first `npm install`) |
| Covered code | `resolveUpstream`, `audioProxyRoutes` in `apps/server/src/audio-proxy.ts` |
| Sync commit | `c72595d68d74b0cb30d62d06b2ef291476c474d5` — last commit at which this skill's check was confirmed to describe that file |
| Out of scope | Range/206 correctness, L2 cache concurrency/eviction, stale in-process `trackCache` after DB updates, auth on the proxy |

Move **Sync commit** forward only after you re-read `audio-proxy.ts` and confirm the check still describes how `upstreamUrl` is chosen, then re-run the check.

## How to run

From the repo root:

```bash
node .cursor/skills/verify-audio-proxy-upstream/scripts/check.mjs
```

First run may `npm install` inside this skill directory (vitest + elysia). Expect all tests green in under a few seconds.

Exit code `0` = property held on the bounded input set. Non-zero = property broken or the harness cannot load the proxy.

## How to read a failure

A failing assertion means: for some request, `globalThis.fetch` was called with a URL that is not the mocked DB `streamUrl` for that track — or a known track produced no fetch when one was required by the scenario.

Tell the failure as steps in product words, for example:

1. Listener (or attacker) requests `GET /proxy/audio/<trackId>?url=https://evil…`
2. Proxy looks up the track (or should)
3. Proxy `fetch`es `https://evil…` instead of the album's stream URL

That is an open-proxy break. Do **not** weaken the tests to make them pass. Do not change product code unless asked to fix the bug.

If the harness cannot import `audio-proxy.ts` (missing file, unresolved deps), fix the skill or the workspace install — that is not a property violation.

## Modeling vs code (keep them aligned)

The check imports the real module under Vite aliases:

- `@long-play/db` → `mocks/db.ts` (in-memory `trackId → streamUrl`)
- `apps/server/src/audio-cache.ts` → `mocks/audio-cache.ts` (always miss, so every hit path hits `fetch`)

What the verification treats as one step matches the handler: resolve upstream from DB by `trackId`, then `fetch(upstreamUrl, …)`. Client query/header/body values are available on the `Request` but must not become the fetch target.

## Distinguishing a real bug from a harness error

| Symptom | Likely cause |
| --- | --- |
| `fetch(…evil…)` or URL not in the allowlist | Real open-proxy regression |
| Known track → 404 / empty fetch when DB mock has the id | Mock/alias broken, or `resolveUpstream` no longer queries by id |
| Cannot find `audio-proxy.ts` / drizzle / elysia | Workspace or skill install problem |

## After an intentional change

If you **intentionally** change how upstream URLs are chosen (for example binding to a new column), update `check/no-open-proxy.test.ts` and this skill's coverage table so they describe the new promise, then run the check, then advance **Sync commit**.

For bringing a drifted verification back in line after unrelated edits, use `/maintain-formal-verification-skill`.

## Second target (not covered here)

Concurrent L2 Range cache + eviction in `audio-cache.ts` is the next formal-methods candidate (TLA+ / `/statechart`). Playlist `count+1` position allocation is a cheaper property-test bug, not a TLA+ target.
