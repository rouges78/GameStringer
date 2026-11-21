/**
 * reconcileVisCheckpoint — il checkpoint Visionaire segue il TESTO, non l'indice.
 *
 * Foolish Mortals, 19/11/2026: reinstallato, l'archivio è passato da 25.645 a
 * 33.221 stringhe e l'indice di ogni frase è cambiato. Un checkpoint solo
 * indice → traduzione metteva le traduzioni sulle frasi sbagliate.
 */
import { describe, it, expect } from 'vitest';
import { reconcileVisCheckpoint } from '@/lib/visionaire-translate';

const row = (id: number, original: string, translated: string) => ({ id: String(id), original, translated });

describe('reconcileVisCheckpoint', () => {
  it('tiene la traduzione all\'indice se lì c\'è ancora il sorgente', () => {
    const r = reconcileVisCheckpoint([row(0, 'Hello there.', 'Ciao.')], [{ index: 0, text: 'Hello there.' }]);
    expect(r.translations).toEqual({ 0: 'Ciao.' });
    expect(r.sources).toEqual({ 0: 'Hello there.' });
  });

  it('la tiene anche se l\'archivio è già patchato (traduzione + coda di spazi)', () => {
    const r = reconcileVisCheckpoint([row(0, 'Hello there.', 'Ciao.')], [{ index: 0, text: 'Ciao.       ' }]);
    expect(r.translations).toEqual({ 0: 'Ciao.' });
    expect(r.sources).toEqual({ 0: 'Hello there.' });
  });

  it('riassegna per testo quando gli indici sono slittati', () => {
    const rows = [row(0, 'Hello there.', 'Ciao.'), row(1, 'Open the door.', 'Apri la porta.')];
    const current = [
      { index: 0, text: 'A brand new line.' },
      { index: 1, text: 'Hello there.' },
      { index: 2, text: 'Open the door.' },
    ];
    const r = reconcileVisCheckpoint(rows, current);
    expect(r.translations).toEqual({ 1: 'Ciao.', 2: 'Apri la porta.' });
    expect(r.sources).toEqual({ 1: 'Hello there.', 2: 'Open the door.' });
  });

  it('scarta la traduzione se il sorgente non esiste più', () => {
    const r = reconcileVisCheckpoint([row(0, 'Removed line.', 'Riga tolta.')], [{ index: 0, text: 'Other line.' }]);
    expect(r.translations).toEqual({});
  });

  it('lascia all\'indice le righe vecchie senza sorgente (non verificabili)', () => {
    const r = reconcileVisCheckpoint([row(3, '', 'Vecchia.')], [{ index: 3, text: 'Whatever.' }]);
    expect(r.translations).toEqual({ 3: 'Vecchia.' });
    expect(r.sources).toEqual({});
  });

  it('una riga vecchia non viene scalzata da una riassegnazione per testo', () => {
    const rows = [row(0, '', 'Vecchia.'), row(7, 'Hello there.', 'Ciao.')];
    const r = reconcileVisCheckpoint(rows, [{ index: 0, text: 'Hello there.' }]);
    expect(r.translations).toEqual({ 0: 'Vecchia.' });
  });
});
