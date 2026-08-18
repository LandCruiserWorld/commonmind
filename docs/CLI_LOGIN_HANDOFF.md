# `commonmind login` — handoff

Goal: `commonmind login` should feel like `wrangler login` or the OpenAI
CLI — run the command, approve once in a browser, done. No pasting a token
into the terminal.

Status: **our side is built, deployed, and verified end-to-end. His side
(the CLI itself) is not started.**

## What we built (commonmind.agent9.dev, shipped 2026-08-18)

Three new pieces, all live in production:

**`GET /cli-auth/?port=<port>&state=<state>&label=<name>`**
A page that:
- Rejects the request outright if `port` isn't a valid 1–65535 number or `state` is missing.
- If the visitor isn't signed in: shows an email field, sends a magic link (existing auth system, unchanged), and on return lands them right back on this same page, now signed in.
- If signed in: shows "A CLI on this computer wants to connect — creates a project key named `<label>`. Authorize / Cancel."
- On Authorize: creates a new project (`POST /api/projects`), mints a short-lived handoff code for it, and redirects the browser to `http://localhost:<port>/callback?code=<code>&state=<state>`.
- The real project token is **never** shown on this page and never appears in the redirect — only an opaque code does.

**`POST /api/cli/code`** — cookie-session only (same rule as project creation: a project token can't mint another credential). Body `{projectId}`, returns `{code}`. Code is single-use, 2-minute TTL, stored in a new D1 table (`cli_auth_codes`).

**`POST /api/cli/exchange`** — no auth required, this is the one the CLI calls itself. Body `{code}` → `{token, url}` on success, `400 {"error":...}` if the code is invalid, expired, or already used. Burned atomically on read — replay is blocked.

### Why the code/token split
The browser hop (`commonmind.agent9.dev` → `localhost:<port>`) only ever carries the opaque code. The real `cm_...` token is fetched by the CLI process itself, server-to-server, via `/api/cli/exchange`, right after it receives the code. That keeps the actual secret out of the URL bar, browser history, and any local server access log.

### Verified today
Ran the full loop live: real project created, real code minted, real redirect, caught by a real local listener on `127.0.0.1`, code exchanged for a real `cm_...` token, replay of the same code correctly rejected with `400`. Test project revoked afterward — nothing left behind.

## What's needed on his side (CLI, not started)

**`commonmind login`**
1. Bind a local server to `127.0.0.1:<port>` — loopback only, never `0.0.0.0`.
2. Generate a random `state` (16+ random bytes, hex).
3. Open the browser to `https://commonmind.agent9.dev/cli-auth/?port=<port>&state=<state>&label=<hostname>` (`label` optional, defaults to "CLI").
4. Print `Opening https://commonmind.agent9.dev/cli-auth/ in your browser… waiting for authorization.`
5. Wait for `GET /callback?code=...&state=...` — timeout at ~5 minutes with a clear message, don't hang forever.
6. **Check `state` matches exactly** what was generated in step 2 — mismatch means abort, do not proceed to exchange.
7. Respond to that request with a simple "Connected — you can close this tab." HTML page.
8. Call `POST https://commonmind.agent9.dev/api/cli/exchange` with `{"code": "<code>"}`. On `200`, you get `{"token": "cm_...", "url": "https://commonmind.agent9.dev"}`.
9. Write `url` + `token` to `~/.commonmind/config` (JSON, `chmod 600` — it's a live credential).
10. Print `Logged in. Try 'commonmind capture "..."' or 'commonmind ask "..."'.` Shut the local server down, exit 0.

**`commonmind logout`** — delete/clear `~/.commonmind/config`, confirm.

**`capture` / `ask` in hosted mode** — when `~/.commonmind/config` exists, use it instead of the raw `.env`/CockroachDB path:

```
POST https://commonmind.agent9.dev/api/memory/capture
Authorization: Bearer <token>
Content-Type: application/json
{"content": "..."}          — "content" must be a string; it's what the dashboard ledger keys off

GET https://commonmind.agent9.dev/api/memory/search?q=<query>&limit=<n>
Authorization: Bearer <token>
→ {"results": [...]}
```

This is the **hosted REST bridge** — same local-vs-hosted distinction already drawn for MCP. A `cm_` token only ever talks to `commonmind.agent9.dev`, never the direct CockroachDB connection. Existing `.env`-based direct mode is untouched for anyone not using `login`.

## Open question for him
None outstanding — every URL, request/response shape, and security requirement above is already implemented and live on our end. This should be closer to "wire it up" than "figure it out."
