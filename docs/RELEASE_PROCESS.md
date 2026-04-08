# GameStringer -- Release Process

Complete procedure to ship a new version **with working auto-update** on
Windows, macOS, and Linux.

This document was rewritten after the v1.6.1 pipeline debugging marathon.
Every section reflects a real failure mode we hit. Read it before your
first release.

---

## 1. Prerequisites

### 1.1 Rust / Tauri crate versions

| Dependency | Minimum | Why |
|---|---|---|
| `tauri` (Cargo) | 2.10.3 | Fixes `__TAURI_BUNDLE_TYPE` marker injection bug (tauri#14186) |
| `tauri-build` (Cargo) | 2.10.3 | Must match the tauri crate |
| `@tauri-apps/cli` (npm) | 2.10.1 | Must match the crate major.minor |

### 1.2 tauri.conf.json -- updater bundle generation

The bundle config **must** include `createUpdaterArtifacts`. Without it,
`tauri-cli` will build installers but will **not** produce the updater
bundles (`.nsis.zip`, `.app.tar.gz`, `.AppImage.tar.gz`) or their `.sig`
signature files.

```jsonc
// src-tauri/tauri.conf.json
"bundle": {
  "createUpdaterArtifacts": "v1Compatible",
  // ... other bundle settings
}
```

### 1.3 tauri-action version

The GitHub Actions workflow must use **`tauri-apps/tauri-action@v0`**
(currently resolves to v0.6.2+). Do **not** pin to `@v0.5` -- that older
version has outdated file-name patterns and will fail with
"Signature not found for the updater JSON".

### 1.4 Minisign signing key

Tauri's updater requires every release artifact to carry a minisign
signature. The private key lives in GitHub Secrets; the public key is
embedded in `src-tauri/tauri.conf.json`.

Current pubkey ID: **`4A3AB8216DBA077E`**

The key was generated with `rsign2` using the `-W` flag (no password),
which avoids CI password-handling issues.

```jsonc
// src-tauri/tauri.conf.json
"plugins": {
  "updater": {
    "pubkey": "<base64 public key>",
    "endpoints": [
      "https://github.com/rouges78/GameStringer/releases/latest/download/latest.json"
    ]
  }
}
```

> WARNING: Regenerating the key breaks auto-update for every installed
> copy. Users will have to download the next version manually. Only
> rotate the key if the old one is compromised.

### 1.5 GitHub Secrets

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | **Base64-encoded** content of the private key file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Empty string (key has no password) |

**Critical detail:** the secret must contain the base64 encoding of the
key file, not the raw multi-line text and not a file path. Upload via CLI
to avoid any copy-paste or line-ending corruption:

```bash
cat priv.key | base64 -w0 | gh secret set TAURI_SIGNING_PRIVATE_KEY
printf '' | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

---

## 2. Release Procedure

### 2.1 Bump versions

Update **all four** files with the same SemVer string (e.g. `1.6.1`,
no `v` prefix):

- `package.json` -> `version`
- `src-tauri/Cargo.toml` -> `[package] version`
- `src-tauri/tauri.conf.json` -> `version`
- `version.json`

### 2.2 Commit, tag, dispatch

```bash
git commit -am "chore(release): v1.6.1"
git push origin main

# Create and push the tag BEFORE dispatching the workflow.
# The workflow checks out by ref, so the tag must already exist.
git tag v1.6.1
git push origin v1.6.1

# Dispatch
gh workflow run release.yml -f version=v1.6.1

# Monitor
gh run list --workflow=release.yml -L 1          # grab the run ID
gh run watch <run-id> --exit-status
```

### 2.3 What the workflow does

```
build-windows --\
build-linux   ---+--> merge-updater --> uploads unified latest.json
build-macos   --/
```

Each platform job builds binaries via `tauri-apps/tauri-action@v0`,
which signs every artifact with minisign and produces a per-platform
`latest.json`.

The `merge-updater` job downloads the three per-platform files, merges
their `platforms.*` keys into one unified `latest.json`, validates that
every required platform has a non-empty signature and a valid URL, then
uploads the result to the GitHub release.

---

## 3. Post-Release Verification

Do **all** of these before announcing. They take two minutes and catch
every class of bug that broke v1.6.0 and v1.6.1 early builds.

### 3.1 Check all assets are present

```bash
gh release view v1.6.1
```

Confirm the release contains installer binaries, their `.sig` files,
updater bundles, and `latest.json`.

### 3.2 Inspect latest.json

```bash
gh release download v1.6.1 -p latest.json -O -
```

Verify all **four** platform entries exist and have non-empty signatures:

| Platform key | Description |
|---|---|
| `darwin-aarch64` | macOS Apple Silicon |
| `darwin-x86_64` | macOS Intel |
| `linux-x86_64` | Linux x86_64 (AppImage) |
| `windows-x86_64` | Windows x86_64 (NSIS) |

Red flags:
- Any `signature` is an empty string -> CI secrets are wrong; rebuild.
- A platform is missing -> merge job bug; check workflow logs.
- URL returns 404 -> asset upload race; re-upload the file manually.

### 3.3 End-to-end updater test

On a machine with an older GameStringer installed:

1. Launch the app.
2. The in-app updater should detect the new version within seconds.
3. Click "Download & install".
4. The app downloads, verifies the minisign signature, installs, and
   relaunches.
5. Confirm the About screen shows the new version.

If step 3 fails with a signature error, the pubkey baked into the
installed app does not match the private key that signed the new release.
The only fix is to ship a corrected point release.

---

## 4. Rollback

If a release is broken (crash on launch, data loss, etc.):

```bash
gh release edit v1.6.1 --prerelease
```

Marking as prerelease immediately hides it from `/releases/latest`,
so the updater endpoint stops serving the broken `latest.json`.

Existing users who already updated are stuck -- there is no downgrade
path. Ship a hotfix (e.g. `1.6.2`) as fast as possible.

Do **not** delete the release or the tag. Deletion breaks `git bisect`
and confuses anyone who linked to it. Leave the bad release marked as
prerelease permanently.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `__TAURI_BUNDLE_TYPE variable not found` | tauri crate < 2.10.3 | Upgrade `tauri` and `tauri-build` in Cargo.toml |
| `Signature not found for the updater JSON` | tauri-action v0.5 file-pattern mismatch OR missing `createUpdaterArtifacts` | Upgrade to `@v0`; add `"createUpdaterArtifacts": "v1Compatible"` to bundle config |
| `failed to decode base64 secret key: Invalid symbol 32` | Secret contains raw key text instead of base64 | Re-upload: `cat key \| base64 -w0 \| gh secret set TAURI_SIGNING_PRIVATE_KEY` |
| `incorrect updater private key password` | Key was generated with `-W` (no password) but a password secret is set, or vice versa | Regenerate key with `-W`, clear the password secret |
| No `.sig` files in build output | Missing `createUpdaterArtifacts` in tauri.conf.json | Add `"createUpdaterArtifacts": "v1Compatible"` to the `bundle` object |
| Workflow fails at checkout | Tag does not exist yet when the workflow tries `ref: inputs.version` | Create and push the tag **before** dispatching the workflow |
| `latest.json` missing from release | merge-updater job failed or was skipped | Check workflow logs; usually caused by one of the above issues |

---

## 6. Key Rotation Procedure

Only rotate if the existing key is compromised. Rotation breaks
auto-update for every installed copy.

```bash
# 1. Generate a new passwordless keypair
rsign generate -p pub.key -s priv.key -W

# 2. Upload private key to GitHub Secrets (base64-encoded)
cat priv.key | base64 -w0 | gh secret set TAURI_SIGNING_PRIVATE_KEY

# 3. Clear the password secret
printf '' | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD

# 4. Update the pubkey in tauri.conf.json
#    Copy the base64-encoded public key into plugins.updater.pubkey
cat pub.key | base64 -w0
# Paste the output into src-tauri/tauri.conf.json

# 5. Commit, push, retag, and redispatch
git commit -am "chore: rotate minisign key"
git push origin main
git tag -f v1.x.x
git push origin v1.x.x --force
gh workflow run release.yml -f version=v1.x.x
```

---

## 7. Reference

- Tauri updater docs: https://tauri.app/plugin/updater/
- minisign: https://jedisct1.github.io/minisign/
- rsign2: https://github.com/nickolasgaspar/rsign2
- Workflow file: `.github/workflows/release.yml`
- Updater hook: `hooks/use-tauri-updater.ts`
- Updater hook (GitHub API fallback for notifications): `hooks/use-update-check.ts`
- Updater UI: `components/notifications/update-bell.tsx`
- Current minisign pubkey ID: `4A3AB8216DBA077E`
