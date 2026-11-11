# Play album

Play album lets a listener start an album from its detail page, see the current track in the mini player, and stream audio through the server Range proxy (never a raw upstream URL in the page).

## Sub-features

- `play-start` starts the album queue from track 1 via `Play album`.
- `play-miniplayer` shows track title, album, and transport in the bottom bar.
- `play-proxy` loads audio from `/proxy/audio/<trackId>` on the server origin.
- `play-track-row` starts from a chosen track in the track list.

## How to get to it (user POV)

- From an album detail page, choose `Play album`.
- From the same page, choose a track row to start at that index.
- With a queue loaded, use mini-player `Play` / `Pause`, or keyboard `Space` / `k` when not typing.

## Driving it with control-long-play

Preconditions:

- `browse-shelf` preconditions met; album `Verify Night Drive` opens with `Play album`.
- Upstream SoundHelix URLs for scaffolding tracks are reachable from the server (proxy will fetch them).

- **Reach album.** Open Home and the scaffolding album as in browse-shelf.
- **Capture before.** Run `browser snapshot --path play-album/before.aria.txt`. Mini player should not yet show `Verify Track 1`.
- **Start playback.** Choose `Play album`. Run `browser click --role button --name "Play album"`.
- **See mini player.** Wait for the first track. Run `browser wait --text "Verify Track 1"`. Mini player shows album `Verify Night Drive`.
- **Confirm proxy.** Evaluate audio elements. Run `browser eval` (via `drive play-album`) and require some `src` containing `/proxy/audio/` on `http://localhost:5172`, and playback not stuck idle (`paused === false` or `currentTime > 0` or `readyState >= 2`).
- **Proof.** Run `browser snapshot --path play-album/playing.aria.txt` and `browser screenshot --path play-album/playing.png --full-page`.
- **Shortcut.** `drive play-album` performs this journey and writes `proof.json`.

## Gotchas

- Autoplay policies: Chromium under Playwright usually allows play after a click; if audio stays paused with `readyState` 0, capture the state and fail — do not call internal `player.playQueue` from `eval` as a workaround for proof.
- The `/player` SoundHelix harness page uses synthetic ids the UUID proxy cannot resolve — never use it as shelf play proof.
- Album button labeled Pause while this album is current still restarts from track 0; use mini-player `Pause` for transport pause.
- L2 disk cache is wiped on every server start; first play after launch may be slower.
