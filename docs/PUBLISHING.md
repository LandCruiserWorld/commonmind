# PUBLISHING — the `commonmind` npm package

How we ship `npm install -g commonmind`. Read this before publishing anything; the packaging config has a footgun in it that is easy to reintroduce.

---

## 1. The name

We publish as **`commonmind`** — unscoped, no `@org/` prefix. Verified unclaimed on the registry, along with every variant npm's similarity rule would use to block it (`common-mind`, `commonminds`, `common_mind` all return 404).

There is no application or approval process for an unscoped npm name. If it is unclaimed, the first `npm publish` takes it. That also means **it is not reserved until we publish** — anyone can take it before we do, and `README.md` already advertises `npm install -g commonmind` as the front door.

Optional and free: create the **`commonmind` npm org** too, so `@commonmind/mcp-server` and friends are ours later. It costs nothing for public packages and takes a minute at <https://www.npmjs.com/org/create>.

---

## 2. Prerequisites

You need an npm account that is a listed maintainer of the package.

```bash
npm whoami          # confirms you're logged in, prints your username
npm login           # if not — opens a browser, needs your 2FA device
```

If your account has 2FA set to *auth-and-writes* (it should), every publish needs a one-time code — pass it as `--otp=123456` or npm will prompt.

**Never paste an npm token into the repo, a script, or a chat.** Tokens belong in your own keychain or `~/.npmrc` with `0600` permissions.

---

## 3. The packaging config, and why it looks like that

Three fields in `package.json` do real work. Do not remove them.

```jsonc
"bin":   { "commonmind": "./dist/cli.js" },  // the global command
"files": ["dist"],                            // what actually ships
"scripts": { "prepublishOnly": "npm run build" }
```

**`files` is load-bearing.** `dist/` is in `.gitignore`, and when there is no `.npmignore`, npm falls back to `.gitignore` to decide what to pack. Without `"files": ["dist"]`, npm **silently excludes the compiled output** — `npm install -g commonmind` then succeeds and the `commonmind` command fails with "no such file or directory", because `bin` points at a file that was never shipped. The `files` allowlist overrides `.gitignore` and fixes it.

It also keeps the package honest. Before the fix the tarball carried 386 kB of cover art, the landing page, and every internal strategy document — `BUILD_LOG`, `CHECKLIST`, `ROADMAP`, `STRATEGIC_PLAN`, the cut ladder and the risk register. Public, but not what an install should pull down. Current tarball: **17 files, 21 kB packed**.

**`prepublishOnly` is the safety net.** It rebuilds before every publish, so a stale or missing `dist/` aborts the publish instead of shipping.

`src/cli.ts` starts with `#!/usr/bin/env node`. That shebang is required for `bin` to work — keep it on line 1.

---

## 4. Pre-publish checklist

Run all four. Any failure stops the publish.

```bash
npm install            # deps in sync with package-lock.json
npm run build          # must exit 0 — a TS error here aborts prepublishOnly
npm test               # must be green
npm pack --dry-run     # inspect the file list
```

The `--dry-run` output should contain `dist/`, `README.md`, `LICENSE`, `package.json` — **and nothing from `docs/`, `assets/`, `src/`, or `tests/`**. If you see strategy docs or PNGs, `files` has been broken.

> Common failure: `Cannot find module '@aws-sdk/client-bedrock-runtime'`. You pulled a manifest change without re-installing. Run `npm install`.

---

## 5. Publish

```bash
npm publish            # unscoped packages default to public access
```

For a scoped package it would need `--access public`; unscoped does not.

Then verify from a clean directory, as a user would:

```bash
cd "$(mktemp -d)"
npm install -g commonmind
commonmind
```

Expected output — usage text on stderr, **exit code 1**:

```
Usage: commonmind capture "<text>" | commonmind ask "<text>"
```

That exit 1 is correct, not a failure. It proves the binary resolved, the shebang worked, and the compiled entrypoint shipped. There is no `--help` flag. Do not smoke-test with a real `capture`, which needs `DATABASE_URL` and live Bedrock credentials.

---

## 6. Versioning while we're building

`0.x.y` until submission — semver treats `0.x` as unstable, which is honest for a package this young.

```bash
npm version patch      # 0.1.0 -> 0.1.1, commits and tags
git push --follow-tags
npm publish
```

**A published version number can never be reused**, even after unpublishing. Always move forward.

---

## 7. If you publish something wrong

Within **72 hours** you may unpublish a version freely:

```bash
npm unpublish commonmind@0.1.0
```

After 72 hours, unpublishing is restricted — no dependents, low download count, sole owner, or a support request. Prefer `npm deprecate` after that window:

```bash
npm deprecate commonmind@0.1.0 "Broken bin path — use 0.1.1"
```

Remember the version can't be republished either way. Bump and ship forward rather than trying to fix in place.

---

## 8. Who publishes

Keep the maintainer list small and deliberate — anyone with publish rights can ship to every user of the package.

```bash
npm owner ls commonmind
npm owner add <username> commonmind
```

Judges do check whether an advertised install command actually works. It is worth one person owning that check before Aug 18.
