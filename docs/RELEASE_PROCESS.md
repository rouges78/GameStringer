# GameStringer — Release Process

Complete procedure to ship a new version **with working auto-update** on all platforms (Windows / macOS / Linux).

> If auto-update is broken for end users, **90% of the time** the cause is in one of the first three sections below. Read them carefully.

---

## 1. Prerequisites (one-time setup)

### 1.1 Minisign signing key

Tauri's updater requires every release artifact to be signed with a minisign keypair. The private key lives only on the maintainer's machine + in GitHub Secrets; the public key is hardcoded in `src-tauri/tauri.conf.json`.

**Generate (only once, ever):**

```bash
npm run tauri -- signer generate -w ~/.tauri/gamestringer.key
```

This produces:
- `~/.tauri/gamestringer.key` — **private key** (password-protected). Keep offline. Back up.
- `~/.tauri/gamestringer.key.pub` — public key.

**Sync the public key** into the app so installed clients can verify updates:

```jsonc
// src-tauri/tauri.conf.json
"plugins": {
  "updater": {
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFDQTcwNjNGQTQzNjk4NjIKUldSaW1EYWtQd2FuSEpEYmFpMGRMblJZcjFYOEJBcFRtWDlWdGFiQ0VxTUV3WFdtOW96NmZXaVQK",
    "endpoints": ["https://github.com/rouges78/GameStringer/releases/latest/download/latest.json"]
  }
}
```

> ⚠️ If you regenerate the key you **break auto-update for all existing installs**. They will have to download the next version manually. Don't do this unless the old key is compromised.

### 1.2 GitHub repo secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and create:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Full content of `~/.tauri/gamestringer.key` (the whole file, multi-line) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you set during `signer generate` |

Without these two secrets, `tauri-action` will still build binaries but **will NOT emit `latest.json`**, and the release workflow will fail at the "Locate latest.json" step (by design — see Guardrails below).

### 1.3 Verify pubkey/privkey match

Before trusting anything, run a sanity check locally:

```bash
npm run tauri -- signer sign -k ~/.tauri/gamestringer.key some-file.txt
# then verify the generated .sig matches the pubkey embedded in tauri.conf.json
```

---

## 2. Cutting a release

### 2.1 Bump versions

Every release must update **all** of:

- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `version`
- `CHANGELOG.md` → new section at the top

Use the same SemVer string everywhere (e.g. `1.6.1`, without the `v` prefix).

### 2.2 Tag and dispatch

```bash
git commit -am "chore(release): v1.6.1"
git tag v1.6.1
git push origin main --tags
```

Then trigger the workflow:

- **Actions → Release → Run workflow**
- Input `version`: `v1.6.1` (with the `v`)
- Leave `create_release` default

The workflow runs three parallel jobs (Windows / Linux / macOS) + a final **merge-updater** job.

### 2.3 What the workflow does

```
build-windows ─┐
build-linux   ─┼──► merge-updater ──► uploads unified latest.json
build-macos   ─┘
```

Each platform job:
1. Builds binaries via `tauri-apps/tauri-action@v0.5`
2. `tauri-action` signs each artifact with minisign and generates a **per-platform** `latest.json` in `src-tauri/target/**`
3. A "Locate latest.json" step finds it and uploads it as a workflow artifact

The `merge-updater` job:
1. Downloads all three per-platform updater files
2. Merges their `platforms.*` keys into a single unified `latest.json`
3. **Guard step**: fails the build if any required platform is missing OR has an empty signature OR has an invalid URL
4. Uploads the unified `latest.json` to the GitHub release

> Previously, each platform job uploaded its own `latest.json` to the same release, **overwriting** the others. That left end users with an updater manifest that only pointed at one OS (or none, depending on race conditions). The merge job eliminates that.

---

## 3. Post-release verification (MANDATORY)

Do **all** of these before announcing the release. It takes 2 minutes and catches the exact class of bugs that caused the v1.6.0 outage.

### 3.1 Check all assets are present

```bash
gh release view v1.6.1 --json assets -q '.assets[].name'
```

You should see **at minimum**:

- `GameStringer_1.6.1_x64-setup.exe`
- `GameStringer_1.6.1_x64-setup.exe.sig`
- `GameStringer_1.6.1_x64_en-US.msi`
- `GameStringer_1.6.1_x64_en-US.msi.sig`
- `GameStringer_1.6.1_x64-portable.zip`
- `GameStringer_1.6.1_amd64.deb`
- `GameStringer_1.6.1_amd64.AppImage`
- `GameStringer_1.6.1_amd64.AppImage.tar.gz`
- `GameStringer_1.6.1_amd64.AppImage.tar.gz.sig`
- `GameStringer_1.6.1_amd64.rpm`
- `GameStringer_1.6.1_aarch64.dmg`
- `GameStringer_1.6.1_x64.dmg`
- `GameStringer_1.6.1_universal.app.tar.gz` (or per-arch)
- `*.app.tar.gz.sig`
- **`latest.json`** ← non-negotiable

If `latest.json` is missing or any `.sig` file is absent, **the release is broken** and auto-update will 404 for every existing user. Do not announce. Go to section 5.

### 3.2 Fetch and inspect `latest.json`

```bash
curl -sL https://github.com/rouges78/GameStringer/releases/latest/download/latest.json | jq .
```

Expected shape:

```json
{
  "version": "1.6.1",
  "notes": "...",
  "pub_date": "2026-04-05T...",
  "platforms": {
    "windows-x86_64": { "signature": "dW50cnVzdGVkI...", "url": "https://.../GameStringer_1.6.1_x64-setup.exe" },
    "linux-x86_64":   { "signature": "dW50cnVzdGVkI...", "url": "https://.../GameStringer_1.6.1_amd64.AppImage.tar.gz" },
    "darwin-aarch64": { "signature": "dW50cnVzdGVkI...", "url": "https://.../GameStringer_1.6.1_aarch64.app.tar.gz" },
    "darwin-x86_64":  { "signature": "dW50cnVzdGVkI...", "url": "https://.../GameStringer_1.6.1_x64.app.tar.gz" }
  }
}
```

**Red flags:**
- Any `signature` is an empty string → CI secrets wrong, rebuild.
- Any platform missing → merge job bug, open issue.
- URL points to a file that returns 404 → asset upload raced with something; re-upload manually.

### 3.3 End-to-end updater test

On a machine with an **older** GameStringer version installed:

1. Launch the app.
2. The in-app updater should detect v1.6.1 within a few seconds.
3. Click "Download & install".
4. The app should download, verify minisign, install, and relaunch.
5. Confirm the About screen shows the new version.

If step 2 works but step 3 fails with a signature error → pubkey in `tauri.conf.json` doesn't match the private key that signed the release. Fix and ship `1.6.2`.

---

## 4. Rolling back

If a release goes out and is broken (crash on launch, data loss, etc.):

1. **Mark the GitHub release as pre-release** (not draft — pre-release hides it from `/releases/latest`):
   ```bash
   gh release edit v1.6.1 --prerelease
   ```
   This immediately stops Tauri's updater endpoint from serving the broken `latest.json` (because the endpoint uses `/releases/latest/download/...` which skips pre-releases).

2. Existing users who already updated are stuck on the broken version — **there is no downgrade path**. Your only remedy is to ship a hotfix `1.6.2` ASAP.

3. Do **not** delete the release or the tag. Deleting breaks `git bisect` and confuses users who linked to it.

4. After the hotfix ships and is verified, you may re-promote the bad release out of pre-release only if you've confirmed nothing still consumes it. In practice, just leave it marked as pre-release forever.

---

## 5. Common failures and fixes

### 5.1 "latest.json not produced by tauri-action"
**Cause:** `TAURI_SIGNING_PRIVATE_KEY` or `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret is missing, empty, or wrong.
**Fix:** Regenerate the secret from your local key file, re-run workflow.

### 5.2 Release has binaries but no `latest.json`
**Cause:** The merge-updater job failed or was skipped. Check the workflow logs for the guard step.
**Fix:** Re-run just the failed job. If the guard flagged an empty signature, see 5.1.

### 5.3 Users get "signature verification failed" on update
**Cause:** Pubkey in `tauri.conf.json` of the **installed** app doesn't match the private key that signed the **new** release. This usually means someone regenerated the key.
**Fix:** You cannot fix existing installs. Publish a blog post telling users to download the new version manually. Never rotate the key without a migration plan.

### 5.4 Workflow succeeds but users don't get notified
**Cause 1:** They're on an old version whose updater plugin is broken (e.g. they installed the very first release before the updater was wired up).
**Cause 2:** The custom in-app notification (`hooks/use-update-check.ts`) hits the GitHub API which is rate-limited per-IP. Usually self-heals.
**Fix:** Nothing actionable from our side. Document the manual download path in the release notes.

### 5.5 Orphan `latest.json` in repo root
We used to keep a hand-edited `latest.json` at the repo root. **This is no longer the case** — the file is generated by CI and lives only as a release asset. If you find one committed to the repo, delete it. It's a footgun.

---

## 6. Reference

- Tauri updater docs: https://tauri.app/plugin/updater/
- minisign: https://jedisct1.github.io/minisign/
- Workflow file: `.github/workflows/release.yml`
- Updater hook (real): `hooks/use-tauri-updater.ts`
- Updater hook (GH API fallback for notifications only): `hooks/use-update-check.ts`
- Updater UI: `components/notifications/update-bell.tsx`
- Current pubkey ID: `B61C7704C9F3B554` (rotated 2026-04-05 — the previous key `1CA7063FA4369862` was never actually usable because signing never worked in CI)
