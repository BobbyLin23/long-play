# Log in

Log in lets a listener sign in with email and password so Favourites appears in the sidebar and playlist APIs accept the session cookie.

## Sub-features

- `login-open` opens the login form from the sidebar.
- `login-submit` signs in with email/password and lands on playlists.
- `login-session` shows the signed-in account control instead of `Log in`.
- `login-reject` surfaces an error for bad credentials.

## How to get to it (user POV)

- Choose `Log in` in the sidebar account area.
- Open `/login` directly.
- From `/register`, use the link to switch to log in after creating an account.

## Driving it with control-long-play

Preconditions:

- Stack healthy per `doctor`.
- A real Better Auth user already exists in the shared Neon DB, **or** you create one via `/register` for this run and record the email in Gotchas/evidence.
- Do not overwrite unknown users. Prefer a dedicated `verify-*@example.com` account created for verification.

- **Open login.** Run `browser goto --url /login` (or `browser click` the `Log in` link from Home). Heading reads `Log in to Long Play`.
- **Fill credentials.** Run `browser fill --label Email --value "<email>"` and `browser fill --label Password --value "<password>"`.
- **Submit.** Run `browser click --role button --name "Log in"`. On success, URL becomes `/playlists` and sidebar shows `Favourites`.
- **Proof session.** Run `browser snapshot --path log-in/session.aria.txt` and `browser screenshot --path log-in/session.png --full-page`. Artifacts show account name/email chrome, not the login CTA.
- **Reject path.** With a wrong password, the red error region appears and Favourites stays hidden.

## Gotchas

- Cookies use `SameSite=None; Secure`. Localhost Chromium is expected to store them; a non-localhost `http://` web origin will not.
- `CORS_ORIGIN` must exactly match the web origin (`http://localhost:5173`).
- There is no `drive log-in` shortcut yet — drive with `browser` commands and keep credentials out of committed artifacts (redact email in proof notes if needed).
- Shared Neon means verification accounts persist until deleted; prefer namespaced emails.
