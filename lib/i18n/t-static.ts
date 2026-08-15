/**
 * Traduzione FUORI dai componenti React (tracker, orchestratori, toast da lib).
 *
 * PERCHÉ È UN FILE A PARTE (15/08/2026): questa funzione viveva in
 * `lib/i18n/index.tsx`, accanto a `I18nProvider`. Un file che esporta un
 * componente React E valori importati da moduli non-React (compat-telemetry,
 * hero-job-tracking, feedback-invite) spegne il Fast Refresh di Next: ogni
 * navigazione in dev degradava a FULL RELOAD dell'app — Davide doveva
 * cliccare ogni pagina due volte, e ogni reload uccideva i callback Tauri in
 * volo. È l'avvertimento testuale di Next («exports a React component but
 * also exports a value that is imported by a non-React component file»).
 * I moduli .ts devono importare da QUI, mai da index.tsx.
 *
 * Replica la risoluzione del provider: lingua del profilo da localStorage
 * (gs_language_<profileId>, poi gameStringerSettings.system.language),
 * lookup dot-notation con fallback EN, altrimenti la chiave cruda.
 * Nota: legge la lingua a ogni chiamata → sempre allineata al profilo corrente.
 */
import { translations, type Language } from './translations';
import { clientLogger } from '@/lib/client-logger';

const getCurrentProfileId = (): string | null => {
  try {
    const profileData = localStorage.getItem('gamestringer_current_profile');
    if (profileData) {
      const profile = JSON.parse(profileData);
      return profile.id || null;
    }
  } catch (e: unknown) {
    clientLogger.warn('[I18N] Errore parsing profilo corrente:', e);
  }
  return null;
};

export function tStatic(key: string): string {
  let lang: Language = 'en';
  try {
    const profileId = getCurrentProfileId();
    const profileLang = profileId ? localStorage.getItem(`gs_language_${profileId}`) : null;
    if (profileLang && translations[profileLang as Language]) {
      lang = profileLang as Language;
    } else {
      const saved = localStorage.getItem('gameStringerSettings');
      const sys = saved ? JSON.parse(saved).system : null;
      if (sys?.language && translations[sys.language as Language]) lang = sys.language as Language;
    }
  } catch { /* SSR o storage non disponibile → EN */ }
  const resolve = (l: Language): string | null => {
    let value: unknown = translations[l];
    for (const k of key.split('.')) {
      if (value && typeof value === 'object' && k in (value as object)) {
        value = (value as Record<string, unknown>)[k];
      } else { return null; }
    }
    return typeof value === 'string' ? value : null;
  };
  return resolve(lang) ?? resolve('en') ?? key;
}
