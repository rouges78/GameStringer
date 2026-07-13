/**
 * Test dell'integrità dei pack: sanitizzazione path (la garanzia che un pack
 * non possa scrivere fuori dalla cartella del gioco), SHA-256 e verifica
 * bloccante dell'import .gspack su contenuto manomesso.
 */
import { describe, it, expect } from 'vitest';
import {
  sha256Hex, aggregatePackSha256, isSafePackPath, sanitizePackFileName,
} from '@/lib/pack-integrity';
import { createGspack, importGspack, type ExportOptions } from '@/lib/gspack-manager';

describe('sha256Hex', () => {
  it('produce il vettore noto per "abc"', async () => {
    // Vettore di test standard FIPS 180-2
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('accetta anche ArrayBuffer/Uint8Array con lo stesso risultato', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes)).toBe(await sha256Hex('abc'));
    const copy = bytes.buffer.slice(0);
    expect(await sha256Hex(copy)).toBe(await sha256Hex('abc'));
  });
});

describe('aggregatePackSha256', () => {
  it('è indipendente dall\'ordine dei file', async () => {
    const a = await aggregatePackSha256([
      { name: 'b.json', sha256: '22'.repeat(32) },
      { name: 'a.json', sha256: '11'.repeat(32) },
    ]);
    const b = await aggregatePackSha256([
      { name: 'a.json', sha256: '11'.repeat(32) },
      { name: 'b.json', sha256: '22'.repeat(32) },
    ]);
    expect(a).toBe(b);
  });

  it('cambia se cambia anche un solo hash', async () => {
    const base = [{ name: 'a.json', sha256: '11'.repeat(32) }];
    const changed = [{ name: 'a.json', sha256: '33'.repeat(32) }];
    expect(await aggregatePackSha256(base)).not.toBe(await aggregatePackSha256(changed));
  });
});

describe('isSafePackPath', () => {
  it.each([
    ['data/Map001.json', true],
    ['strings.po', true],
    ['www/data/Actors.json', true],
    ['../../../windows/system32/evil.dll', false],
    ['..\\..\\evil.exe', false],
    ['/etc/passwd', false],
    ['C:\\Windows\\evil.dll', false],
    ['c:/windows/evil.dll', false],
    ['//server/share/file', false],
    ['~/secrets.txt', false],
    ['data/../../../evil', false],
    ['', false],
  ])('%s → %s', (p, expected) => {
    expect(isSafePackPath(p as string)).toBe(expected);
  });
});

describe('sanitizePackFileName', () => {
  it('riduce percorsi ostili al basename', () => {
    expect(sanitizePackFileName('../../../evil.dll')).toBe('evil.dll');
    expect(sanitizePackFileName('C:\\Users\\x\\pack.gspack')).toBe('pack.gspack');
    expect(sanitizePackFileName('a/b/c.json')).toBe('c.json');
  });
  it('rifiuta nomi non recuperabili', () => {
    expect(sanitizePackFileName('..')).toBeNull();
    expect(sanitizePackFileName('')).toBeNull();
    expect(sanitizePackFileName('///')).toBeNull();
  });
});

// ── Import .gspack: la verifica SHA-256 BLOCCA i contenuti manomessi ──

function exportOptions(): ExportOptions {
  return {
    gameName: 'MicroQuest',
    platform: 'steam',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    authorName: 'Tester',
    packName: 'MicroQuest ITA',
    description: 'fixture',
    quality: 'final',
    includeGlossary: false,
    includeNotes: false,
    files: [
      { path: 'data/strings.json', content: '{"hello":"ciao"}', format: 'json' },
    ],
  } as ExportOptions;
}

describe('gspack: firma SHA-256 end-to-end', () => {
  it('export → import pulito: successo senza warning di integrità', async () => {
    const { data, manifest } = await createGspack(exportOptions());
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    const result = await importGspack(data);
    expect(result.success).toBe(true);
    expect(result.warnings.join(' ')).not.toContain('integrità');
  });

  it('contenuto manomesso → import BLOCCATO (non solo warning)', async () => {
    const { data } = await createGspack(exportOptions());
    // Decodifica, altera una traduzione, ricodifica (attaccante senza ri-hash)
    const json = JSON.parse(decodeURIComponent(escape(atob(data))));
    json.files[0].content = '{"hello":"contenuto malevolo"}';
    const tampered = btoa(unescape(encodeURIComponent(JSON.stringify(json))));

    const result = await importGspack(tampered);
    expect(result.success).toBe(false);
    expect(result.error).toContain('integrità');
  });

  it('path traversal nel pack → sanitizzato con warning', async () => {
    const { data } = await createGspack(exportOptions());
    const json = JSON.parse(decodeURIComponent(escape(atob(data))));
    json.files[0].path = '../../../evil.json';
    // L'attaccante ricalcola il checksum legacy ma non può falsificare... in
    // questo scenario simuliamo un pack LEGACY senza sha256:
    delete json.manifest.sha256;
    const tampered = btoa(unescape(encodeURIComponent(JSON.stringify(json))));

    const result = await importGspack(tampered);
    expect(result.success).toBe(true);
    expect(result.files?.[0].path).toBe('evil.json'); // ridotto al basename
    expect(result.warnings.some(w => w.includes('non sicuro'))).toBe(true);
  });
});
