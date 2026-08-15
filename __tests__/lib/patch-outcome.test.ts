import { describe, it, expect } from 'vitest';
import { decidePatchOutcome } from '@/lib/translation/patch-outcome';

/**
 * Questi test descrivono il difetto che la regola chiude, non la regola in
 * astratto. Il primo blocco è quello che conta: prima del 15/08 ognuno di quei
 * casi finiva nel database come «riuscito».
 */
describe('decidePatchOutcome — il caso che ha rotto la telemetria', () => {
  it('tutti gli stadi completati ma ZERO stringhe scritte = fallimento, non successo', () => {
    // Esattamente la run che generava «completata al 100% con 0 errori» col
    // gioco ancora in inglese: successRate 1.0 perché gli stadi erano tutti
    // verdi, e nemmeno una riga entrata nei file.
    const v = decidePatchOutcome({
      totalStrings: 1477,
      translatedStrings: 1477,
      injectedStrings: 0,
      successRate: 1.0,
    });
    expect(v.outcome).toBe('failure');
    expect(v.stringsTotal).toBe(1477);
    expect(v.stringsTranslated).toBe(0);
  });

  it('tradotte tutte ma scritte poche = parziale', () => {
    const v = decidePatchOutcome({
      totalStrings: 1000,
      translatedStrings: 1000,
      injectedStrings: 500,
      successRate: 1.0,
    });
    expect(v.outcome).toBe('partial');
    expect(v.stringsTranslated).toBe(500);
  });

  it('scritte quasi tutte = successo, e i numeri arrivano davvero', () => {
    const v = decidePatchOutcome({
      totalStrings: 1000,
      translatedStrings: 1000,
      injectedStrings: 950,
      successRate: 1.0,
    });
    expect(v.outcome).toBe('success');
    expect(v.stringsTotal).toBe(1000);
    expect(v.measured).toBe(true);
  });

  it('successRate NON decide più: stadi a metà ma stringhe tutte scritte = successo', () => {
    // Il contrario del primo caso: prima questa run veniva declassata a
    // «parziale» pur avendo cambiato il gioco per intero.
    const v = decidePatchOutcome({
      totalStrings: 800,
      translatedStrings: 800,
      injectedStrings: 800,
      successRate: 0.5,
    });
    expect(v.outcome).toBe('success');
  });
});

describe('decidePatchOutcome — «non misurato» non è «zero»', () => {
  it('client vecchio senza conteggi: ripiega su successRate ma NON dichiara numeri', () => {
    const v = decidePatchOutcome({ successRate: 1.0 });
    expect(v.outcome).toBe('success');
    // Il punto dell'intera correzione: qui NON deve uscire 0, o la vista
    // pubblica torna a contare come provate delle run senza prove.
    expect(v.stringsTotal).toBeNull();
    expect(v.stringsTranslated).toBeNull();
    expect(v.measured).toBe(false);
  });

  it('conteggi a metà (totale sì, iniettate no) contano come non misurati', () => {
    const v = decidePatchOutcome({ totalStrings: 500, successRate: 0.9 });
    expect(v.measured).toBe(false);
    expect(v.stringsTotal).toBeNull();
  });
});

describe('decidePatchOutcome — traduzione a runtime', () => {
  it('zero stringhe scritte è il comportamento CORRETTO e non va letto come fallimento', () => {
    // XUnity / gs-hook: il gioco non viene riscritto, la traduzione avviene
    // mentre si gioca. Contare le stringhe qui non ha senso.
    const v = decidePatchOutcome({
      runtimeTranslation: true,
      totalStrings: 0,
      injectedStrings: 0,
      successRate: 1.0,
    });
    expect(v.outcome).toBe('success');
    expect(v.stringsTotal).toBeNull();
    expect(v.measured).toBe(false);
  });
});

describe('decidePatchOutcome — casi limite', () => {
  it('gioco senza stringhe da tradurre: zero scritte resta un fallimento', () => {
    const v = decidePatchOutcome({ totalStrings: 0, injectedStrings: 0, successRate: 1.0 });
    expect(v.outcome).toBe('failure');
    expect(v.stringsTotal).toBe(0);
  });

  it('scritte più del totale (percorso rapido con cap) non declassa a parziale', () => {
    const v = decidePatchOutcome({ totalStrings: 100, injectedStrings: 120, successRate: 1.0 });
    expect(v.outcome).toBe('success');
  });
});
