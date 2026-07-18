/**
 * checkPlaceholders (quality-gates) — dopo l'unificazione su placeholder-guard.
 *
 * Il check deve usare la stessa fonte di verità del guard (diffPlaceholders):
 * copertura estesa (printf coi flag, control code, BBCode, ruby, entità HTML)
 * e confronto per multiset senza doppi conteggi.
 */
import { describe, it, expect } from 'vitest';
import { checkPlaceholders } from '@/lib/quality/quality-gates';

describe('checkPlaceholders (delegato a placeholder-guard)', () => {
  it('passa quando tutti i token sopravvivono', () => {
    const r = checkPlaceholders('Hello {player}, you got %d gold!', 'Ciao {player}, hai %d oro!');
    expect(r.passed).toBe(true);
    expect(r.severity).toBe('info');
  });

  it('fallisce con severità error quando un token manca', () => {
    const r = checkPlaceholders('You got %d gold, {player}!', 'Hai dell\'oro, {player}!');
    expect(r.passed).toBe(false);
    expect(r.severity).toBe('error');
    expect((r.details as { missingInTarget: string[] }).missingInTarget).toEqual(['%d']);
  });

  it('warning per token inventati (extra) senza mancanti', () => {
    const r = checkPlaceholders('Semplice testo', 'Testo %s con token inventato');
    expect(r.passed).toBe(true);
    expect(r.severity).toBe('warning');
    expect((r.details as { extraInTarget: string[] }).extraInTarget).toEqual(['%s']);
  });

  it('copre i control code RPG Maker che i vecchi pattern non vedevano', () => {
    const r = checkPlaceholders('\\C[3]Attento!\\C[0] Salute: \\V[12]', 'Attento! Salute:');
    expect(r.passed).toBe(false);
    const missing = (r.details as { missingInTarget: string[] }).missingInTarget;
    expect(missing).toContain('\\C[3]');
    expect(missing).toContain('\\C[0]');
    expect(missing).toContain('\\V[12]');
  });

  it('multiset senza doppio conteggio: {0} contato una sola volta', () => {
    const r = checkPlaceholders('Slot {0}', 'Slot {0}');
    const src = (r.details as { sourcePlaceholders: string[] }).sourcePlaceholders;
    expect(src).toEqual(['{0}']);
  });

  it('duplicati richiesti: due %s nel sorgente, uno nella traduzione → mancante', () => {
    const r = checkPlaceholders('%s vs %s', 'Solo %s');
    expect(r.passed).toBe(false);
    expect((r.details as { missingInTarget: string[] }).missingInTarget).toEqual(['%s']);
  });

  it('percentuali normali non sono token (50% fatto)', () => {
    const r = checkPlaceholders('50% fatto', 'Fatto al 50%');
    expect(r.passed).toBe(true);
    expect((r.details as { sourcePlaceholders: string[] }).sourcePlaceholders).toEqual([]);
  });
});
