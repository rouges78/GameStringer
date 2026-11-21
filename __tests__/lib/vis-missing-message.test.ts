/**
 * lib/tauri-api.ts riconosce dal TESTO l'errore «cartella senza .vis» dei
 * comandi Visionaire e lo registra come debug. Se il messaggio Rust cambia, il
 * filtro smette di combaciare in silenzio e il rosso torna in console.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('messaggio «Nessun file .vis»', () => {
  it('il testo cercato da tauri-api.ts è quello che Rust produce', () => {
    const needle = read('lib/tauri-api.ts').match(/cmd === 'scan_vis_strings' && errorMessage\.includes\('([^']+)'\)/)?.[1];
    expect(needle).toBeTruthy();
    const rustMessage = read('src-tauri/src/commands/visionaire_patcher.rs').match(/const NO_VIS_FILE: &str = "([^"]+)";/)?.[1];
    expect(rustMessage).toContain(needle);
  });
});
