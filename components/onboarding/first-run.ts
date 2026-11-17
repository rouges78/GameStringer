/**
 * Primo avvio — chiavi e ordine dei dialoghi.
 *
 * L'ordine è: Termini d'uso → OnboardingWizard (lingua di destinazione) →
 * primo gioco. Il tour interattivo resta riavviabile da Impostazioni: il
 * wizard lo segna come completato, così al primo avvio non si sovrappone.
 *
 * Le chiavi erano copiate a mano in ogni componente e si erano disallineate:
 * il wizard segnava il tour con la versione 2 mentre il tour chiedeva la 5,
 * quindi il tour si sarebbe aperto sopra il wizard. Stanno qui, una volta sola.
 */

export const TOS_KEY = 'gamestringer_tos_accepted';
export const TOS_VERSION = 2; // Increment ONLY when TOS content actually changes
export const ONBOARDING_KEY = 'gamestringer_onboarding_completed';
export const ONBOARDING_VERSION = 5; // Increment ONLY when onboarding content actually changes (v5: added "How to translate" step)
export const TUTORIAL_KEY = 'gamestringer-tutorial-completed';
export const TUTORIAL_VERSION = 5; // Increment ONLY when tutorial content actually changes

/** Vero se in localStorage c'è una versione >= `min` (versioni successive non riaprono nulla). */
function storedVersionAtLeast(key: string, min: number): boolean {
  try {
    const v = parseInt(localStorage.getItem(key) || '0', 10);
    return !isNaN(v) && v >= min;
  } catch {
    return false;
  }
}

export const isTosAccepted = () => storedVersionAtLeast(TOS_KEY, TOS_VERSION);
export const isOnboardingDone = () => storedVersionAtLeast(ONBOARDING_KEY, ONBOARDING_VERSION);
export const isTutorialDone = () => storedVersionAtLeast(TUTORIAL_KEY, TUTORIAL_VERSION);

/**
 * Chiama `onReady` dopo `delayMs` appena `isReady()` diventa vero: subito se lo
 * è già, altrimenti ricontrollando ogni 500 ms (i dialoghi precedenti scrivono
 * solo in localStorage). Ritorna la pulizia da restituire dall'useEffect.
 */
export function whenReady(isReady: () => boolean, onReady: () => void, delayMs = 0): () => void {
  let poll: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    timer = setTimeout(onReady, delayMs);
  };
  if (isReady()) {
    fire();
  } else {
    poll = setInterval(() => {
      if (!isReady()) return;
      clearInterval(poll);
      poll = undefined;
      fire();
    }, 500);
  }
  return () => {
    if (poll) clearInterval(poll);
    if (timer) clearTimeout(timer);
  };
}
