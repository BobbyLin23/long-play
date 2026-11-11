# Search

Search is a primary nav item that opens `/search`. Today the page is a title-only stub: there is no search field on that route. Home optionally filters the first shelf page when `?q=` is present, but nothing in the UI writes that query param.

## Sub-features

- `search-nav` opens `/search` from the sidebar.
- `search-stub` shows the Search page shell without an input.
- `search-home-q` — client filter on Home when `?q=` is set (no UI entry point).

## How to get to it (user POV)

- Choose `Search` in primary navigation.
- Open `/search` directly.
- (Non-UI) Open `/?q=<term>` manually to exercise the Home client filter.

## Driving it with control-long-play

Preconditions:

- Stack healthy per `doctor`.

- **Nav entry.** From Home, run `browser click --role link --name Search`. URL is `/search` and document title includes Search.
- **Stub proof.** Run `browser snapshot --path search/stub.aria.txt` and `browser screenshot --path search/stub.png`. Confirm there is **no** searchbox/textbox for queries on this page.
- **Home filter (optional, not a nav journey).** Run `browser goto --url "/?q=Verify"`. Heading becomes a search-results style title and only matching shelf albums on the first page remain. Snapshot `search/home-q.aria.txt`.
- **Reporting.** Mark `search-nav` + `search-stub` as verified for current behavior. Do **not** report full product search as working. If a journey required typed search from `/search`, fail with unmet precondition: stub has no input.

## Gotchas

- Do not weaken the map to treat `/?q=` as the Search nav feature — different entry point.
- Home filter only applies to the already-fetched page (limit 24), not a server search RPC.
- When real search ships, update this file and add a `drive search` shortcut; until then keep proving the stub honestly.
