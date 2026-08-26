/**
 * Guardia sulla copertura del database di compatibilità.
 *
 * ⛔ IL DIFETTO CHE LA MOTIVA (24/08/2026). La telemetria di compatibilità è
 * completa dal 13/07/2026: sender con coda offline, opt-in, anti-abuso lato
 * server, badge, pagina pubblica. Ma un motore non ci arrivava. Il ramo
 * Visionaire Studio di `startAutoTranslate` si apriva l'operazione di progresso
 * a mano con `progress.startOperation`, con guardia anti-duplicato e badge tray
 * propri, invece di passare da `startHeroTracking`. Tutto funzionava — tranne
 * l'unica cosa che solo il tracker fa: `reportCompatStep`. Ogni traduzione
 * Visionaire finiva fuori dai dati, e il «funziona nell'N% delle run» di quel
 * motore sarebbe rimasto per sempre su zero run.
 *
 * Il punto è che non se ne accorgeva nessuno: il ramo non era rotto, era muto.
 * Un motore aggiunto domani, copiando quel ramo, sarebbe stato muto uguale.
 *
 * REGOLA. Nessun file di `app/` o `components/` apre un'operazione di progresso
 * da sé: i job di traduzione passano da `startHeroTracking`, che è il posto in
 * cui la run viene raccontata al database. L'unica eccezione è il provider che
 * quell'API la implementa.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it, vi, beforeEach } from 'vitest';

const RADICE = join(__dirname, '..', '..');

/**
 * Chi può chiamare `startOperation`: solo l'implementazione dell'API.
 * ⚠️ Aggiungere una voce qui è quasi sempre la risposta sbagliata. Se un motore
 * nuovo ha bisogno di un'operazione di progresso, ha bisogno del tracker: da lì
 * ottiene gratis guardia anti-duplicato, badge tray, pagina Progetti, advisor di
 * ritmo E il report di compatibilità. A mano si riottiene tutto tranne l'ultimo,
 * che è esattamente quello che non si vede mancare.
 */
const PUO_APRIRE_OPERAZIONI = ['components/progress/progress-provider.tsx'];

function sorgenti(dir: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(dir)) {
    if (voce === 'node_modules' || voce.startsWith('.')) continue;
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) out.push(...sorgenti(p));
    else if (/\.tsx?$/.test(voce)) out.push(p);
  }
  return out;
}

describe('database di compatibilità — nessun motore resta muto', () => {
  it('nessuna pagina o componente apre unoperazione di progresso da sé', () => {
    const colpevoli: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of sorgenti(join(RADICE, dir))) {
        const rel = relative(RADICE, file).split(sep).join('/');
        if (PUO_APRIRE_OPERAZIONI.includes(rel)) continue;
        // `.startOperation(` con un punto davanti: la chiamata sull'oggetto
        // progress. Le menzioni nei commenti non hanno la parentesi.
        if (/\.startOperation\(/.test(readFileSync(file, 'utf8'))) colpevoli.push(rel);
      }
    }

    expect(colpevoli).toEqual([]);
  });
});

// ── Semantica dello stop utente ─────────────────────────────────────────────

const reportCompatStep = vi.fn();
const setPendingBootCheck = vi.fn();
const maybeOfferCompatOptIn = vi.fn(() => false);

vi.mock('@/lib/compat-telemetry', () => ({
  reportCompatStep: (...a: unknown[]) => reportCompatStep(...a),
  newCompatRunId: () => 'run-test',
  compatGameKey: (_id: string | undefined, name: string) => `g:${name}`,
  setPendingBootCheck: (...a: unknown[]) => setPendingBootCheck(...a),
  classifyCompatError: () => 'unknown',
  maybeOfferCompatOptIn: (...a: unknown[]) => maybeOfferCompatOptIn(...a),
}));
vi.mock('@/lib/services/translation-projects', () => ({
  projectService: {
    createOrGetProject: vi.fn(async () => ({ id: 'p1' })),
    getAllProjects: vi.fn(async () => []),
    saveProject: vi.fn(async () => {}),
    updateProgress: vi.fn(async () => {}),
  },
}));
vi.mock('@/lib/crash-reporter', () => ({ reportCrash: vi.fn() }));
vi.mock('@/lib/feedback-invite', () => ({ maybeInviteFeedbackAfterRun: vi.fn() }));
vi.mock('@/lib/i18n/t-static', () => ({ tStatic: (k: string) => k }));
vi.mock('@/lib/notifications/tray-notifications', () => ({
  incrementActiveTranslations: vi.fn(async () => {}),
  decrementActiveTranslations: vi.fn(async () => {}),
  notifyTranslationCompleted: vi.fn(async () => {}),
  notifyTranslationFailed: vi.fn(async () => {}),
}));

import { startHeroTracking } from '@/lib/hero-job-tracking';
import type { ProgressState } from '@/lib/types/progress';

const progressFinto = () => ({
  startOperation: vi.fn(),
  updateProgress: vi.fn(),
  completeOperation: vi.fn(),
  failOperation: vi.fn(),
}) as unknown as ProgressState;

/** Un gioco diverso per test: la guardia anti-duplicato è globale al processo. */
let n = 0;
const avvia = (progress: ProgressState) =>
  startHeroTracking(progress, {
    engineId: 'visionaire', engineLabel: 'Visionaire Studio',
    gamePath: `C:/giochi/test-${n++}`, gameName: 'Test', targetLang: 'it',
  })!;

describe('stop dellutente — non è né successo né errore', () => {
  beforeEach(() => {
    reportCompatStep.mockClear();
    setPendingBootCheck.mockClear();
    maybeOfferCompatOptIn.mockClear();
  });

  it('una run annullata non finisce nel database di compatibilità', async () => {
    // ⭐ Il cuore della cosa: chi annulla ha cambiato idea, non ha trovato un
    // gioco incompatibile. Contarlo come 'partial' abbasserebbe la percentuale
    // di un motore per un motivo che col motore non c'entra.
    const progress = progressFinto();
    await avvia(progress).stopped(120, 400);

    expect(reportCompatStep).not.toHaveBeenCalled();
    // Nemmeno il boot check o la proposta di opt-in: la run non è arrivata in
    // fondo, non c'è nessun esito da chiedere all'utente.
    expect(setPendingBootCheck).not.toHaveBeenCalled();
    expect(maybeOfferCompatOptIn).not.toHaveBeenCalled();
    // L'operazione però si chiude, e dichiara PERCHÉ: senza `stopped` il widget
    // di progresso resterebbe a girare per sempre.
    expect(progress.completeOperation).toHaveBeenCalledWith(
      expect.any(String), { translated: 120, total: 400, stopped: true }
    );
  });

  it('una run finita invece lo dichiara, con lesito', async () => {
    await avvia(progressFinto()).done(400, 400);

    expect(reportCompatStep).toHaveBeenCalledTimes(1);
    expect(reportCompatStep.mock.calls[0][0]).toMatchObject({
      engine: 'visionaire', step: 'patch', result: 'success',
    });
  });

  it('una run fallita lo dichiara come fallimento, sullo step raggiunto', async () => {
    const tracker = avvia(progressFinto());
    tracker.setStage('extract');
    await tracker.fail(new Error('boom'));

    expect(reportCompatStep).toHaveBeenCalledTimes(1);
    expect(reportCompatStep.mock.calls[0][0]).toMatchObject({
      engine: 'visionaire', step: 'extract', result: 'failure',
    });
  });
});
