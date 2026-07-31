/**
 * Il gate profilo, verificato contro il filesystem invece che contro sé stesso.
 *
 * PERCHÉ ESISTE — 31/07/2026. `lib/route-config.ts` elencava le rotte da
 * proteggere e faceva `?? false` per tutte le altre. L'app è cresciuta a 90
 * rotte, l'elenco è rimasto a 9 (5 delle quali ormai inesistenti), e nessuno se
 * n'è accorto perché **niente confrontava l'elenco con la realtà**: il file era
 * l'unica fonte di verità su sé stesso. Risultato: 85 rotte su 90 senza gate.
 *
 * Questo test prende le rotte da `app/` sul disco — la cosa che il config
 * dovrebbe descrivere — e fallisce in ENTRAMBE le direzioni: se una pagina
 * reale perde la protezione, e se una pagina pubblica la acquista. Include di
 * proposito anche i due controlli "positivi" che mancavano: un elenco pubblico
 * che nomina pagine inesistenti, e metadati che nominano pagine inesistenti,
 * sono proprio il modo in cui questo file è marcito la prima volta.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';
import {
  isProtectedRoute,
  isPublicRoute,
  isChromelessRoute,
  CHROMELESS_ROUTES,
  PUBLIC_ROUTES,
  routes,
} from '@/lib/route-config';

const APP_DIR = join(__dirname, '..', '..', 'app');

/** Rotte reali dedotte dal filesystem, con i route group `(...)` rimossi. */
function rotteReali(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const voce of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, voce.name);
      if (voce.isDirectory()) {
        walk(p);
      } else if (voce.name === 'page.tsx' || voce.name === 'page.jsx') {
        const parti = relative(APP_DIR, dir)
          .split(sep)
          .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
        out.push('/' + parti.join('/'));
      }
    }
  };
  walk(APP_DIR);
  return [...new Set(out)].sort();
}

describe('gate profilo — le rotte reali contro route-config', () => {
  const reali = rotteReali();

  it('trova le rotte sul disco (se questo fallisce, il resto non prova nulla)', () => {
    // Guardia contro il modo più stupido di avere un test verde: non aver
    // guardato niente. Vale la stessa lezione del gate a11y diventato cieco.
    expect(reali.length).toBeGreaterThan(50);
    expect(reali).toContain('/');
    expect(reali).toContain('/settings');
  });

  it('ogni rotta reale non pubblica è protetta', () => {
    const scoperte = reali.filter((r) => !isPublicRoute(r) && !isProtectedRoute(r));
    expect(scoperte, `rotte senza gate profilo: ${scoperte.join(', ')}`).toEqual([]);
  });

  it('le rotte pubbliche NON sono protette', () => {
    for (const { path: p } of PUBLIC_ROUTES) {
      expect(isProtectedRoute(p), `${p} dovrebbe essere pubblica`).toBe(false);
    }
  });

  it('una rotta nuova mai censita nasce protetta', () => {
    expect(isProtectedRoute('/rotta-inventata-che-non-esiste')).toBe(true);
    expect(isProtectedRoute('/library/dettaglio/123')).toBe(true);
  });

  it('/overlay e /vr-overlay sono pagine normali, non finestre trasparenti', () => {
    // Hanno "overlay" nel nome ma stanno nel menu principale: se qualcuno le
    // aggiungesse a PUBLIC_ROUTES per assonanza, le lascerebbe senza gate.
    expect(isProtectedRoute('/overlay')).toBe(true);
    expect(isProtectedRoute('/vr-overlay')).toBe(true);
  });

  it('nessuna rotta pubblica è un fantasma', () => {
    const fantasmi = PUBLIC_ROUTES
      .map((r) => r.path)
      // `/auth` è un prefisso: esistono /auth/steam/verify e /auth/itchio/callback
      .filter((p) => !reali.some((r) => r === p || r.startsWith(p + '/')));
    expect(fantasmi, `pubbliche ma inesistenti: ${fantasmi.join(', ')}`).toEqual([]);
  });

  it('nessun metadato di rotta è un fantasma', () => {
    // È esattamente così che il file è marcito: 5 voci su 9 puntavano a pagine
    // cancellate, e l'elenco sembrava comunque popolato e curato.
    const fantasmi = routes
      .map((r) => r.path)
      .filter((p) => !reali.some((r) => r === p || r.startsWith(p + '/')));
    expect(fantasmi, `metadati per rotte inesistenti: ${fantasmi.join(', ')}`).toEqual([]);
  });

  it('ogni voce pubblica dichiara il perché', () => {
    for (const r of PUBLIC_ROUTES) {
      expect(r.perche.length, `${r.path} senza motivazione`).toBeGreaterThan(10);
    }
  });
});

describe('finestre senza chrome — overlay sopra il gioco', () => {
  const reali = rotteReali();

  it('le rotte senza chrome esistono davvero', () => {
    const fantasmi = CHROMELESS_ROUTES.filter((p) => !reali.includes(p));
    expect(fantasmi, `senza chrome ma inesistenti: ${fantasmi.join(', ')}`).toEqual([]);
  });

  it('ogni finestra trasparente aperta da Rust è senza chrome', () => {
    // Fonte di verità: i sorgenti Rust che creano le finestre. Se qualcuno
    // aggiunge una WebviewUrl::App e si dimentica di questo elenco, il test
    // se ne accorge — è esattamente come /gs-overlay e /region-select sono
    // finiti a disegnare la sidebar sopra la partita.
    const sorgenti = [
      join(__dirname, '..', '..', 'src-tauri', 'src', 'overlay_ipc.rs'),
      join(__dirname, '..', '..', 'src-tauri', 'src', 'ocr_translator', 'mod.rs'),
    ].filter(existsSync);
    expect(sorgenti.length).toBeGreaterThan(0);

    const rotteFinestre = new Set<string>();
    for (const f of sorgenti) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/WebviewUrl::App\(\s*"([^"]+)"/g)) {
        const r = m[1];
        if (r.endsWith('.html')) continue; // splash statica, non è una rotta Next
        rotteFinestre.add(r);
      }
    }
    expect(rotteFinestre.size).toBeGreaterThan(0);

    const conChrome = [...rotteFinestre].filter((r) => !isChromelessRoute(r));
    expect(
      conChrome,
      `finestre overlay che si porterebbero dietro MainLayout: ${conChrome.join(', ')}`
    ).toEqual([]);
  });

  it('una pagina senza chrome non usa hook di profilo', () => {
    // Uscendo prima di ProfilesProvider/ProfileAuthProvider, useProfileAuth e
    // useProfiles lanciano. Il vincolo va verificato, non ricordato.
    for (const r of CHROMELESS_ROUTES) {
      const page = join(__dirname, '..', '..', 'app', ...r.split('/').filter(Boolean), 'page.tsx');
      if (!existsSync(page)) continue;
      const src = readFileSync(page, 'utf8');
      expect(src, `${r} usa useProfileAuth fuori dal provider`).not.toMatch(/useProfileAuth/);
      expect(src, `${r} usa useProfiles fuori dal provider`).not.toMatch(/useProfiles\b/);
    }
  });

  it('le pagine con "overlay" nel nome ma normali mantengono il chrome', () => {
    expect(isChromelessRoute('/overlay')).toBe(false);
    expect(isChromelessRoute('/vr-overlay')).toBe(false);
  });
});
