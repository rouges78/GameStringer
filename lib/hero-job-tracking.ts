'use client';

/**
 * Tracking trasversale per i job di traduzione "hero" (Ren'Py, Hendrix, RPG Maker,
 * Visionaire…). Centralizza:
 *  - guardia anti-duplicato GLOBALE (sopravvive a navigazione/smontaggio);
 *  - operazione nel ProgressProvider globale (resta visibile e continua a
 *    cambiare pagina, perché il provider è montato nel layout);
 *  - badge/notifiche tray (job attivi + notifica a fine lavoro);
 *  - registrazione/aggiornamento nella pagina "Progetti" (IndexedDB).
 *
 * Il loop di traduzione resta nell'orchestratore del motore: qui si agganciano
 * solo gli "effetti" trasversali tramite onProgress/done/fail.
 */

import { projectService } from '@/lib/services/translation-projects';
import type { ProgressState } from '@/lib/types/progress';
import { tStatic } from '@/lib/i18n';
import { gamePathKey } from '@/lib/game-path';
import {
  reportCompatStep, newCompatRunId, compatGameKey, setPendingBootCheck,
  classifyCompatError, maybeOfferCompatOptIn, type CompatStep, type CompatGameRef,
} from '@/lib/compat-telemetry';
import { reportCrash } from '@/lib/crash-reporter';
import { maybeInviteFeedbackAfterRun } from '@/lib/feedback-invite';

export interface HeroTrackMeta {
  engineId: string;     // 'renpy' | 'hendrix' | 'rpgmaker' | 'visionaire'
  engineLabel: string;  // "Ren'Py", "Hendrix", "RPG Maker"…
  gamePath: string;
  gameId?: string;
  gameName?: string;
  gameImage?: string;
  sourceLang?: string;
  targetLang: string;
  // Testi già tradotti per l'operazione di progress (dal componente, via t()).
  opTitle?: string;
  opDesc?: string;
}

export interface HeroTracker {
  onProgress: (done: number, total: number) => void;
  done: (translated: number, total: number) => Promise<void>;
  fail: (err: unknown) => Promise<void>;
  /**
   * Facoltativo: comunica lo step di pipeline corrente al tracker (per la
   * telemetria di compatibilità). Se mai chiamato, la stima è: 'extract'
   * all'avvio → 'translate' al primo progress → 'patch' su done().
   */
  setStage: (stage: Exclude<CompatStep, 'boot'>) => void;
}

const _g = globalThis as unknown as { __gsHeroRunning?: Set<string> };
if (!_g.__gsHeroRunning) _g.__gsHeroRunning = new Set<string>();
const RUNNING = _g.__gsHeroRunning;

export function heroKey(engineId: string, gamePath: string): string {
  // Path normalizzato: lo stesso gioco deve produrre la stessa chiave anche se
  // il path arriva con separatori/casing/slash finale diversi tra un lancio e l'altro.
  return `${engineId}:${gamePathKey(gamePath)}`;
}

export function isHeroJobRunning(engineId: string, gamePath: string): boolean {
  return RUNNING.has(heroKey(engineId, gamePath));
}

/**
 * Avvia il tracking trasversale. Ritorna null se un job per lo stesso
 * motore+gioco è già in corso (così il chiamante evita di lanciarne un altro).
 */
export function startHeroTracking(progress: ProgressState, meta: HeroTrackMeta): HeroTracker | null {
  const key = heroKey(meta.engineId, meta.gamePath);
  if (RUNNING.has(key)) return null;
  RUNNING.add(key);

  const opId = `${meta.engineId}-${gamePathKey(meta.gamePath)}`;
  progress.startOperation(opId, {
    title: meta.opTitle || `Translation — ${meta.gameName || meta.engineLabel}`,
    description: meta.opDesc || `${meta.engineLabel} · background`,
    isBackground: true,
    canMinimize: true,
  });
  void import('@/lib/notifications/tray-notifications').then(m => m.incrementActiveTranslations()).catch(() => {});

  let projectId: string | null = null;
  let creating: Promise<void> | null = null;
  // Fallback id: se manca il gameId (es. gioco aggiunto a mano) usa il path
  // NORMALIZZATO, così lo stesso gioco non genera progetti duplicati quando il
  // path arriva con separatori/casing diversi.
  const gid = meta.gameId || gamePathKey(meta.gamePath);

  const ensureProject = async (total: number) => {
    if (!gid) return;
    // Crea una sola volta (riusa la promise in volo contro progressi ravvicinati).
    if (!projectId && !creating) {
      creating = (async () => {
        try {
          const proj = await projectService.createOrGetProject({
            gameId: gid,
            gameName: meta.gameName || gid,
            gameImage: meta.gameImage,
            engine: meta.engineLabel,
            sourceLanguage: meta.sourceLang || 'en',
            targetLanguage: meta.targetLang,
            // Identità per percorso: aggancia lo stesso progetto anche quando
            // gid è il fallback di path e altrove si usa l'id di libreria.
            gamePathKey: meta.gamePath ? gamePathKey(meta.gamePath) : undefined,
            files: [{ path: meta.gamePath, name: meta.engineLabel, type: meta.engineId, strings: Math.max(total, 0) }],
          });
          projectId = proj.id;
        } catch { /* progetto non disponibile: si prosegue */ }
      })();
    }
    if (creating) await creating;
    // Aggiorna il totale quando diventa noto (la creazione eager parte da 0).
    if (projectId && total > 0) {
      try {
        const all = await projectService.getAllProjects();
        const p = all.find(x => x.id === projectId);
        if (p && p.totalStrings !== total) { p.totalStrings = total; await projectService.saveProject(p); }
      } catch { /* ignore */ }
    }
  };

  // Crea il progetto SUBITO al lancio (anche prima del primo progress, e anche se il
  // job fallisce all'avvio — es. Ollama non raggiungibile): così compare nei Progetti
  // appena avvii la traduzione, e da lì è ripristinabile.
  void ensureProject(0);

  const releaseGuardAndBadge = async () => {
    RUNNING.delete(key);
    try {
      const tray = await import('@/lib/notifications/tray-notifications');
      await tray.decrementActiveTranslations();
    } catch { /* tray non disponibile */ }
  };

  // ── Telemetria di compatibilità (opt-in, fail-open) ──────────────────
  // Un run_id per l'intera run; lo stage avanza con i progressi e può essere
  // precisato dal chiamante via tracker.setStage(). reportCompatStep è un
  // no-op se l'utente non ha attivato l'opzione nelle impostazioni privacy.
  const compatRunId = newCompatRunId();
  const compatGame: CompatGameRef = {
    key: compatGameKey(meta.gameId, meta.gameName || meta.engineLabel),
    appId: meta.gameId && /^\d+$/.test(meta.gameId) ? parseInt(meta.gameId, 10) : null,
    name: meta.gameName || meta.engineLabel,
  };
  let compatStage: Exclude<CompatStep, 'boot'> = 'extract';

  // ── Advisor di ritmo ─────────────────────────────────────────────────
  // Dopo un rodaggio di 5 minuti misura la velocità REALE del job; se a quel
  // ritmo mancano più di 60 minuti, consiglia (una sola volta, via toast) di
  // cambiare strategia: API key cloud (riparte dal checkpoint) o modello locale
  // più leggero. Vale per tutti i motori hero senza modifiche ai call-site.
  const ADVISOR_WARMUP_MS = 5 * 60_000;
  const ADVISOR_ETA_MS = 60 * 60_000;
  let advStartTime = 0;
  let advStartDone = -1;
  let advisorShown = false;
  const paceAdvisor = (done: number, total: number) => {
    if (advisorShown || total <= 0) return;
    const now = Date.now();
    if (!advStartTime) { advStartTime = now; advStartDone = done; return; }
    const elapsed = now - advStartTime;
    if (elapsed < ADVISOR_WARMUP_MS || done <= advStartDone) return;
    const etaMs = ((total - done) * elapsed) / (done - advStartDone);
    if (etaMs <= ADVISOR_ETA_MS) { advisorShown = true; return; } // ritmo sano: non rivalutare
    advisorShown = true;
    const hours = etaMs / 3_600_000;
    const etaLabel = hours >= 1 ? `${Math.round(hours)} h` : `${Math.round(etaMs / 60_000)} min`;
    void import('sonner').then(({ toast }) => {
      toast.warning(tStatic('heroJob.paceSlowTitle').replace('{eta}', etaLabel), {
        description: tStatic('heroJob.paceSlowDesc'),
        duration: 30_000,
        action: {
          label: tStatic('heroJob.paceSlowAction'),
          // Il click abbandona consapevolmente la run corrente (il checkpoint
          // conserva il lavoro fatto): navigazione piena verso le Impostazioni.
          onClick: () => { window.location.assign('/settings'); },
        },
      });
    }).catch(() => {});
  };

  return {
    onProgress: (done: number, total: number) => {
      void ensureProject(total);
      if (compatStage === 'extract' && total > 0) compatStage = 'translate';
      progress.updateProgress(opId, total > 0 ? (done / total) * 100 : 0, `${done}/${total}`);
      if (projectId) void projectService.updateProgress(projectId, done).catch(() => {});
      paceAdvisor(done, total);
    },
    done: async (translated: number, total: number) => {
      await ensureProject(total);
      progress.completeOperation(opId, { translated, total });
      if (projectId) await projectService.updateProgress(projectId, translated).catch(() => {});
      await releaseGuardAndBadge();
      // Esito run: 'success' se è stato tradotto (quasi) tutto, 'partial' altrimenti.
      const partial = total > 0 && translated > 0 && translated / total < 0.8;
      void reportCompatStep({
        runId: compatRunId,
        game: compatGame,
        engine: meta.engineId,
        step: 'patch',
        result: partial ? 'partial' : 'success',
        stringsTotal: total,
        stringsTranslated: translated,
        sourceLang: meta.sourceLang,
        targetLang: meta.targetLang,
      });
      setPendingBootCheck({
        runId: compatRunId,
        gameKey: compatGame.key,
        gameName: compatGame.name,
        targetLang: meta.targetLang,
        engine: meta.engineId,
      });
      // Telemetria OFF? Propone l'opt-in una sola volta (report retroattivo se accetta).
      const optInShown = maybeOfferCompatOptIn({
        runId: compatRunId,
        game: compatGame,
        engine: meta.engineId,
        result: partial ? 'partial' : 'success',
        stringsTotal: total,
        stringsTranslated: translated,
        sourceLang: meta.sourceLang,
        targetLang: meta.targetLang,
      });
      // Se l'opt-in non è stato proposto, lo slot è libero: invita al feedback
      // (una sola volta). Mai i due toast insieme.
      if (!optInShown) maybeInviteFeedbackAfterRun();
      try {
        const tray = await import('@/lib/notifications/tray-notifications');
        await tray.notifyTranslationCompleted(meta.gameName || 'Gioco', translated);
      } catch { /* ignore */ }
    },
    fail: async (err: unknown) => {
      progress.failOperation(opId, err instanceof Error ? err : new Error(String(err)));
      await releaseGuardAndBadge();
      void reportCompatStep({
        runId: compatRunId,
        game: compatGame,
        engine: meta.engineId,
        step: compatStage,
        result: 'failure',
        sourceLang: meta.sourceLang,
        targetLang: meta.targetLang,
        errorCategory: classifyCompatError(err),
      });
      void reportCrash({ error: err, area: 'pipeline', engine: meta.engineId, gameKey: compatGame.key });
      try {
        const tray = await import('@/lib/notifications/tray-notifications');
        await tray.notifyTranslationFailed(meta.gameName || 'Gioco', String(err));
      } catch { /* ignore */ }
    },
    setStage: (stage) => { compatStage = stage; },
  };
}
