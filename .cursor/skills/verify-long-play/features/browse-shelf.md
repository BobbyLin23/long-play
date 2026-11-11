# Browse shelf

Browse shelf lets a listener see albums on the curated shelf from Home (or Discovery), open one album, and see its title, artist, tracks, and license before playing.

## Sub-features

- `shelf-home` shows the Home heading and album covers with title/artist/track counts.
- `shelf-discovery` shows the same grid under Discovery copy via `/?view=discovery`.
- `shelf-open-album` opens album detail from a cover/title link.
- `shelf-album-detail` shows heading, Play album, Shuffle, and track list.

## How to get to it (user POV)

- Open Home from the brand link `Long Play home` or the `Home` nav item.
- Open Discovery from the `Discovery` nav item (`/?view=discovery`).
- Choose an album cover or title on the grid to open `/album/<id>`.

## Driving it with control-long-play

Preconditions:

- Stack healthy per `doctor`.
- Shelf includes `Verify Night Drive` (launch/seed scaffolding).
- Start from a cold browser page (daemon `goto /`).

- **Open Home.** Go to `/`. Run `browser goto --url /` then `browser wait --role heading --name Home`. The brand link `Long Play home` is visible.
- **See shelf.** Wait for the scaffolding album. Run `browser wait --text "Verify Night Drive"`. The grid lists at least that title.
- **Proof Home.** Capture list state. Run `browser snapshot --path browse-shelf/home.aria.txt` and `browser screenshot --path browse-shelf/home.png --full-page`. Artifacts show Long Play branding and `Verify Night Drive`.
- **Open album.** Choose the album title. Run `browser click --text "Verify Night Drive"`. URL becomes `/album/<uuid>` and heading is `Verify Night Drive`.
- **Confirm detail.** Wait for play. Run `browser wait --role button --name "Play album"`. Track titles such as `Verify Track 1` appear.
- **Proof album.** Run `browser snapshot --path browse-shelf/album.aria.txt` and `browser screenshot --path browse-shelf/album.png --full-page`.
- **Shortcut.** `drive browse-shelf` runs the Home → album journey and writes `proof.json`.
- **Side effect.** `rpc albumList '{"limit":24}'` includes `Verify Night Drive` in `json.albums`.

## Gotchas

- Home loads at most 24 albums with no pagination UI. If a large product shelf pushes `Verify Night Drive` past the first page (title sort), seed alone is not enough — fail the journey and record that precondition rather than clicking a random album.
- Discovery is the same grid with different copy, not a ranked feed.
- Album Pause label still calls play-from-start when the current album is already playing — do not treat that label as pause transport.
- Empty product DB without scaffolding shows Loading then an empty main — doctor must fail before drive.
