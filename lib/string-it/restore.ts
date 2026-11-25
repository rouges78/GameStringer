/**
 * Annulla String it: wrapper dei comandi Rust in
 * src-tauri/src/commands/string_it_restore.rs.
 *
 * `probeStringItRestore` non tocca nulla e dice cosa si può annullare (per
 * mostrare o nascondere il pulsante); `restoreStringIt` lo annulla e riporta,
 * metodo per metodo, cosa ha ripristinato, cosa ha lasciato a mano e perché.
 */
import { invoke } from '@/lib/tauri-api';

/** Metodo del piano di String it (unreal-locres, renpy, rpgmaker, …). */
export interface RestoreMethodDetail {
  method: string;
  detail: string;
}

export interface RestoreMethodReason {
  method: string;
  reason: string;
}

export interface RestoreMethodError {
  method: string;
  error: string;
}

export interface StringItRestoreProbe {
  /** Metodi con qualcosa che GameStringer può annullare da solo. */
  restorable: RestoreMethodDetail[];
  /** Cose trovate che non si annullano da sole (non provate nostre). */
  manual: RestoreMethodReason[];
}

export interface StringItRestoreReport {
  restored: RestoreMethodDetail[];
  skipped: RestoreMethodReason[];
  errors: RestoreMethodError[];
}

export function probeStringItRestore(gamePath: string): Promise<StringItRestoreProbe> {
  return invoke<StringItRestoreProbe>('string_it_restore_probe', { gamePath });
}

export function restoreStringIt(gamePath: string): Promise<StringItRestoreReport> {
  return invoke<StringItRestoreReport>('string_it_restore', { gamePath });
}
