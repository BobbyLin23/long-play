# Favourites / playlists

Favourites is the sidebar label for the signed-in library. The running app exposes multi-playlist screens under `/playlists`. Listeners can create named playlists when signed in; adding an album from the album page is not wired in the UI yet.

## Sub-features

- `fav-nav` shows the Favourites nav item only while signed in.
- `fav-list` lists the user's playlists at `/playlists`.
- `fav-create` creates a named playlist from the playlists page dialog.
- `fav-detail` opens `/playlists/<id>` and can play a whole playlist when album details have loaded.
- `fav-save-album` — **not available in UI** (hook exists, no caller).

## How to get to it (user POV)

- After log in, choose `Favourites` in the sidebar (or the account menu item).
- Open `/playlists` directly while signed in.
- Choose New / create controls on the playlists page to add a list.
- Open a playlist card to reach its detail page.

## Driving it with control-long-play

Preconditions:

- Completed `log-in` so session chrome is visible.
- Signed-in user may have zero playlists.

- **Open library.** Run `browser click --role link --name Favourites` (or `browser goto --url /playlists`). Title/heading context is playlists.
- **Empty or list state.** Snapshot the page. Run `browser snapshot --path favourites/list.aria.txt`. Either empty copy or existing playlist cards appear.
- **Create playlist.** Open the create dialog, fill a name such as `Verify List`, submit. Re-open `/playlists` and confirm `Verify List` is listed. Capture screenshot `favourites/created.png`.
- **Save-from-album.** From `/album/<id>` for `Verify Night Drive`, look for an Add / Save control. **Expected today: none.** Record failure with reason in proof notes — do not call `playlistAddAlbum` via raw RPC and claim the UI path works.

## Gotchas

- Product language says one Favourites set (ADR); code still uses multi-playlist CRUD. Verify what the UI actually shows.
- Empty-playlist copy may tell users to add albums they cannot add from the album page — that is a product gap, not a harness bug.
- Owner misses on playlist APIs collapse to NOT_FOUND; unsigned users must not see Favourites nav.
- Creating playlists mutates shared Neon — use `Verify …` names and delete them when cleaning human fixtures (harness cleanup does not delete playlists).
