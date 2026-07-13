# Pack Integrity & Moderation — Patch Hub / .gspack

> A malicious or tampered community pack is an existential risk for the
> project. This is the defense-in-depth put in place on 13/07/2026.

## Integrity chain (SHA-256, WebCrypto)

1. **Publish** (`publishPack`): every file is hashed (`pack_files.sha256`),
   filenames are reduced to safe basenames, and an aggregated
   `translation_packs.content_sha256` is stored (hash of the sorted
   `name:sha256` list — see `lib/pack-integrity.ts`).
2. **Download** (`downloadPackFiles`): every file is re-hashed and compared.
   A mismatch **aborts the whole download** — tampered content in storage or
   in transit is never installed. Legacy packs without hashes still work.
3. **.gspack manifest**: `createGspack` adds `manifest.sha256` over
   files+glossary (the old 32-bit `checksum` stays for legacy readers).
   `importGspack` **blocks** the import on SHA-256 mismatch (the legacy
   checksum only warns, as before).
4. **Path safety**: pack file paths are validated (`isSafePackPath`) — no
   absolute paths, drive letters, UNC or `..` traversal. Hostile paths are
   reduced to their basename with a warning (or the import is rejected).
   The Rust `save_gspack` command sanitizes filenames too (defense in depth).

## Moderation

- Publishing already lands in `status='pending'` (human review before public).
- **Auto-flag** (new): the `pack_reports_autoflag` trigger pulls a published
  pack back to `pending` at the **3rd distinct report** and logs an
  `auto-flag` action in `moderation_log`. Existing RLS hides pending packs
  from public listings; the moderation queue (`getModerationQueue`) then
  decides approve/reject.

## UI

Packs published with hashes show a **ShieldCheck "Integrity verified"** badge
in Patch Hub cards and detail (i18n: `patchHubPage.integrityBadge/-Desc`).

## Tests

`__tests__/lib/pack-integrity.test.ts` (21): SHA-256 FIPS vector, aggregate
determinism, path sanitization matrix, and the end-to-end .gspack tamper test
(export → tamper → import **blocked**).

## Next (future)

Author-level cryptographic signatures (minisign per publisher — the unused
root key `gamestringer.key.pub` is a starting point) once translator
reputation/keys are worth managing.
