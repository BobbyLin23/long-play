# Long Play

An online music app with an Apple Music–like interface, for album-first listeners. The unit of discovery and listening is the album: find a great album on the shelf, then listen to it. Audio is streamed, not kept as the listener's files. The product ships on the web first.

## Language

**Long Play**:
The product: a public online music app whose interface resembles Apple Music, but whose listening unit is the album.
_Avoid_: Spotify clone, track player, music library (as the product name)

**Listener**:
A person using Long Play to find and play albums. Album-first: they pick a record and stay with it, not shuffle singles in the background. Playing does not require an account. Saving does.
_Avoid_: user (for the person listening), customer, subscriber

**Shelf**:
The finite set of albums the operator has admitted. Legal free/CC is required to be eligible; being eligible is not enough to be on the shelf. Ranking can reorder the shelf; it cannot add or remove albums. Admission is from Jamendo now; Internet Archive is later, and only for items that work as a record.
_Avoid_: library, catalog (as a dump of everything upstream), marketplace, search index

**Album**:
A complete recorded work, legally free to stream (CC or equivalent), that works as a record: a listenable whole you would put on and stay with. You find one on the shelf, then listen to it as a whole. When the last Track of a single Album finishes, playback stops, unless Repeat Album is on.
_Avoid_: single, track list, playlist (as the catalog unit)

**Artist**:
The recording artist of an Album. Shown on the Album and in Now Playing as part of the credit. A Listener may name Artists as a ranking preference. Browse may filter the shelf by artist name.
_Avoid_: performer, creator, user

**Genre**:
A kind of music, as a label on an Album and as an optional ranking preference. Not a Browse filter and not a separate catalog.
_Avoid_: mood, tag (as the product noun), radio

**Track**:
A numbered chapter of an Album. You may start, skip, or shuffle Tracks once you are in that Album. Shuffle never leaves the Album. You do not find, save, or queue a Track on its own.
_Avoid_: song (as a catalog entry), single

**Browse**:
How a Listener finds an Album: walking the shelf as covers. Filtering by album or artist name is allowed. Filtering by Genre and searching by Track are not.
_Avoid_: track search, genre browser, Discovery (as a separate product)

**Taste**:
Optional Genres and Artists a Listener may pick (skippable on first login, editable later). Used only to rank the shared shelf until Saves exist. Skipping Taste shows the same order as logged-out Browse (global Save popularity). Taste never admits albums to the shelf.
_Avoid_: onboarding as a gate, personal catalog, Spotify quiz (as filling a library)

**Ranking**:
Ordering of the shelf. Does not decide shelf membership.
- Logged-out, skipped Taste, or no Saves yet: global popularity (how often albums are Saved).
- Signed-in with Taste and no Saves yet: Taste.
- Signed-in with Saves: that Listener's Saves, and later album completes.
_Avoid_: generate the shelf, ingest, rating, like

**Save**:
Keeping an Album for later. Grain is Album only. Requires an account.
_Avoid_: like, favorite a track, queue

**Favourites**:
A Listener's single saved set of Albums, in save order. Play Favourites plays those albums back-to-back (each Album in Track order, then the next Album, then stop). Opening one Album from Favourites still stops at that Album's end.
_Avoid_: playlist, playlists, library, likes

**Repeat Album**:
When the last Track finishes, start the Album from the first Track again. On or off. There is no repeat-one-Track.
_Avoid_: repeat track, loop song, radio

**License**:
The CC (or equivalent) terms of an Album. Shown on the Album and in Now Playing, with the Artist, as the credit. Not a catalog to browse.
_Avoid_: legal browser, terms page, copyright notice (as a separate product)
