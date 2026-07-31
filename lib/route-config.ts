/**
 * Configuration for route protection and navigation
 *
 * ⛔ DIFETTO CORRETTO IL 31/07/2026 — IL DEFAULT ERA "APERTO".
 *
 * Fino a oggi `isProtectedRoute` faceva `config?.requireAuth ?? false`: una rotta
 * NON elencata qui risultava **non protetta**. L'elenco conteneva 9 voci, di cui
 * 5 puntavano a pagine che non esistono più (`/injekt-translator`,
 * `/dialogue-patcher`, `/patches`, `/store-manager`, `/admin`), mentre le rotte
 * reali dell'app sono 90. Risultato misurato: **85 rotte su 90 senza gate
 * profilo**.
 *
 * All'avvio non si notava — la finestra Tauri principale parte da `/`, che era
 * elencata, quindi il profilo veniva sempre scelto prima di arrivare altrove.
 * Il buco si apriva col **logout**: `ProfileHeader` sta in `MainLayout`, cioè su
 * OGNI pagina, e `handleLogout` non fa redirect. Uscendo da una qualsiasi delle
 * 85, `ProtectedRoute` riceveva `requireAuth={false}` e restituiva i figli così
 * com'erano: l'app restava aperta come se il profilo ci fosse ancora. In quello
 * stato `get_current_profile_settings` risponde `success(None)` e l'hook fa
 * `setSettings(data || DEFAULT_PROFILE_SETTINGS)` **senza errori**, mostrando le
 * impostazioni di default come se fossero quelle dell'utente; in scrittura
 * `save_current_profile_settings` fallisce con "No active profile".
 * Lettura che mente e scrittura che fallisce, in silenzio.
 *
 * ORA IL DEFAULT È "PROTETTO": si elencano le ECCEZIONI pubbliche, non le
 * pagine da proteggere. Una rotta nuova nasce protetta, e questo file non può
 * più marcire silenziosamente man mano che l'app cresce — che è esattamente
 * come ci siamo arrivati.
 *
 * Il gate è verificato da `lib/__tests__/route-config.test.ts`, che fallisce in
 * ENTRAMBE le direzioni: se una rotta reale perde la protezione e se una
 * pubblica la acquista.
 */

export interface RouteConfig {
  path: string;
  requireAuth: boolean;
  adminOnly?: boolean;
  title: string;
  description?: string;
}

/**
 * Rotte che devono renderizzare SENZA profilo selezionato.
 *
 * Tenere questo elenco corto e motivato: ogni voce è una pagina che l'utente può
 * vedere senza aver scelto un profilo. Il match è esatto o per prefisso di
 * segmento (`/auth` copre `/auth/steam/verify`).
 */
export const PUBLIC_ROUTES: readonly { path: string; perche: string }[] = [
  // Finestre trasparenti aperte da Rust SOPRA il gioco: qui il gate profilo
  // sarebbe una schermata di login disegnata sopra la partita.
  // `/ocr-overlay` è anche in `bareRoutes` dentro profile-wrapper (esce prima di
  // ProtectedRoute); le altre due no, quindi senza questa lista si romperebbero.
  { path: '/ocr-overlay', perche: 'overlay OCR trasparente — ocr_translator/mod.rs:706' },
  { path: '/gs-overlay', perche: 'overlay dei sottotitoli del hook — overlay_ipc.rs:117' },
  { path: '/region-select', perche: 'selezione area schermo per OCR — ocr_translator/mod.rs:751' },

  // Atterraggio dei redirect OAuth: lette le credenziali dalla URL, rimandano
  // subito a /stores (che è protetta). Proteggerle significherebbe disegnare il
  // gate al posto della pagina, non eseguire l'effect e **perdere il token in
  // silenzio** — un guasto difficile da diagnosticare, in cambio di nulla:
  // senza profilo non si sarebbe potuto avviare il collegamento allo store.
  { path: '/auth', perche: 'callback OAuth Steam/itch.io — redirigono a /stores' },
];

/**
 * NB: `/overlay` e `/vr-overlay` NON sono in questo elenco di proposito.
 * Nonostante il nome sono pagine normali della finestra principale, raggiungibili
 * dal menu (`main-layout.tsx:195`) e dal registro strumenti: vanno protette come
 * tutte le altre. Le finestre trasparenti vere sono solo le tre qui sopra.
 */

const PUBLIC_PATHS = PUBLIC_ROUTES.map((r) => r.path);

export const isPublicRoute = (path: string): boolean =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

/**
 * Metadati (titolo/descrizione/adminOnly) delle rotte principali.
 *
 * ⚠️ Questo elenco NON decide più la protezione: una rotta assente qui è
 * comunque protetta, e le 4 voci rimaste hanno `requireAuth: true` che ormai
 * coincide col default. Tolte il 31/07/2026 le 5 voci che puntavano a pagine
 * inesistenti (`/injekt-translator`, `/dialogue-patcher`, `/patches`,
 * `/store-manager`, `/admin`).
 *
 * ⚠️ ONESTÀ SULLO STATO, per non ricreare una trappola come `ue-translator-dll`:
 * al 31/07/2026 l'UNICO consumatore di questo modulo è
 * `components/profiles/profile-wrapper.tsx`, e importa solo `isProtectedRoute`.
 * `getRouteTitle`, `getRouteDescription` e `isAdminRoute` hanno **zero
 * chiamanti**: i titoli qui sotto non compaiono da nessuna parte nella UI, e
 * `adminOnly` non protegge niente. Sono un'API pronta, non un'API collegata —
 * se serve un titolo di pagina, va cablata, non data per funzionante.
 */
export const routes: RouteConfig[] = [
  {
    path: '/',
    requireAuth: true,
    title: 'Dashboard',
    description: 'Sistema di traduzione avanzato con intelligenza artificiale'
  },
  {
    path: '/library',
    requireAuth: true,
    title: 'Libreria Giochi',
    description: 'Gestisci la tua collezione di giochi'
  },
  {
    path: '/editor',
    requireAuth: true,
    title: 'Editor Traduzioni',
    description: 'Modifica e gestisci le traduzioni'
  },
  {
    path: '/settings',
    requireAuth: true,
    title: 'Impostazioni',
    description: 'Configura GameStringer'
  }
];

export const getRouteConfig = (path: string): RouteConfig | undefined => {
  return routes.find(route => route.path === path || path.startsWith(route.path + '/'));
};

/**
 * Protetta salvo prova contraria.
 *
 * Il `?? true` finale è il punto di tutta questa correzione: prima era `?? false`
 * e ogni pagina non censita passava senza gate.
 */
export const isProtectedRoute = (path: string): boolean => {
  if (isPublicRoute(path)) return false;
  const config = getRouteConfig(path);
  return config?.requireAuth ?? true;
};

export const isAdminRoute = (path: string): boolean => {
  const config = getRouteConfig(path);
  return config?.adminOnly ?? false;
};

export const getRouteTitle = (path: string): string => {
  const config = getRouteConfig(path);
  return config?.title ?? 'GameStringer';
};

export const getRouteDescription = (path: string): string => {
  const config = getRouteConfig(path);
  return config?.description ?? 'Sistema di traduzione per videogiochi';
};
