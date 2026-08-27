/**
 * Il file del sito è l'unico pezzo di questa configurazione senza una rete.
 *
 * `docs/sito/config/models.json` viene ridistribuito con il sito e, nel merge,
 * VINCE sul bundled: per chiave di provider e per intero array di modelli. Non
 * è un'aggiunta, è una sovrascrittura su TUTTE le installazioni. Ad agosto 2026
 * un file fermo a luglio ha rimesso in circolo prezzi che il repo aveva già
 * corretto, e nessun test poteva accorgersene perché i test coprivano il merge,
 * non il contenuto del file (docs/maintenance/2026-08-23-il-sito-sovrascrive-i-prezzi.md).
 *
 * Questi test coprono il contenuto. Attenzione a cosa NON possono fare:
 *
 * - Non pretendono che i valori del sito coincidano col bundled: il file esiste
 *   apposta per divergere, è il suo mestiere.
 * - Vedono la copia nel repo, non quella deployata. Ad agosto erano la stessa
 *   cosa ed è bastato, ma se un domani qualcuno modifica il file sul server
 *   senza passare di qui, questi test resteranno verdi.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUNDLED_MODEL_CONFIG, validateModelConfig } from '@/lib/remote-config';

const PERCORSO = resolve(process.cwd(), 'docs/sito/config/models.json');
const GREZZO = readFileSync(PERCORSO, 'utf-8');

/** Oltre questo, i listini vanno riguardati: non è un bug del codice, è una scadenza. */
const GIORNI_PRIMA_DI_RIGUARDARLO = 180;

describe('docs/sito/config/models.json', () => {
  it('è JSON valido con la forma che l\'app si aspetta', () => {
    const cfg = JSON.parse(GREZZO);
    expect(typeof cfg.version).toBe('number');
    expect(cfg.pricing).toBeTypeOf('object');
    expect(cfg.models).toBeTypeOf('object');
  });

  it('passa il validatore dell\'app senza perdere voci per strada', () => {
    // Il controllo vero non è «è JSON»: è «sopravvive a validateModelConfig».
    // Quel validatore scarta in silenzio le voci malformate e tiene le altre,
    // quindi un prezzo scritto male non fa fallire niente — sparisce e basta,
    // lasciando vincere il bundled senza che nessuno lo sappia. Qui pretendiamo
    // che il conto delle chiavi entrate sia il conto delle chiavi uscite.
    const grezzo = JSON.parse(GREZZO);
    const validato = validateModelConfig(grezzo);
    expect(validato).not.toBeNull();
    expect(Object.keys(validato!.pricing).sort()).toEqual(Object.keys(grezzo.pricing).sort());
    expect(Object.keys(validato!.models).sort()).toEqual(Object.keys(grezzo.models).sort());
  });

  it('non contiene provider che l\'app non conosce', () => {
    // Una chiave che nel bundled non esiste è peso morto nel migliore dei casi
    // e un refuso nel peggiore: `deepsek: 0.0001` non sovrascrive niente, e il
    // prezzo che credevi di aver corretto resta quello di prima.
    const cfg = JSON.parse(GREZZO);
    const orfaniPrezzi = Object.keys(cfg.pricing).filter((k) => !(k in BUNDLED_MODEL_CONFIG.pricing));
    const orfaniModelli = Object.keys(cfg.models).filter((k) => !(k in BUNDLED_MODEL_CONFIG.models));
    expect(orfaniPrezzi, 'prezzi per provider che il bundled non ha').toEqual([]);
    expect(orfaniModelli, 'modelli per provider che il bundled non ha').toEqual([]);
  });

  it('dichiara quando è stato guardato, e non è passato troppo tempo', () => {
    // Se questo fallisce non c'è niente da riparare nel codice: vuol dire che i
    // listini hanno più di sei mesi e vanno riverificati sul sito dei vendor,
    // aggiornando `updatedAt`. È la scadenza sul latte, non un allarme antifurto.
    const cfg = JSON.parse(GREZZO);
    expect(cfg.updatedAt, 'manca updatedAt: un listino senza data è un listino vecchio travestito').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const giorni = (Date.now() - Date.parse(cfg.updatedAt)) / 86_400_000;
    expect(giorni, `models.json fermo da ${Math.round(giorni)} giorni: riguardare i listini`).toBeLessThan(GIORNI_PRIMA_DI_RIGUARDARLO);
  });
});
