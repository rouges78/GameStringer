/**
 * Guardia anti-regressione sulle rotte interne.
 *
 * Il 23/08/2026 `/danganronpa-tools` è stato trovato per caso, mentre si
 * toglieva un link nel blocco accanto: la pagina si chiama
 * `/danganronpa-patcher` e chi cliccava quel tool finiva su un 404. La passata
 * fatta di proposito subito dopo ne ha trovate altre sette, ferme da chissà
 * quanto — cinque `route:` nel Rust verso pagine per-motore mai esistite, e tre
 * `/crawler` rimaste dopo che la pagina era diventata `/context-harvester`.
 *
 * Nessuno se n'era accorto perché una rotta sbagliata non rompe la build, non
 * rompe i tipi e non rompe i test: rompe solo il clic dell'utente.
 *
 * Regola: ogni rotta interna citata nel codice deve corrispondere a una pagina
 * reale sotto `app/`. Le rotte dinamiche (`/library/[id]`) coprono i loro figli.
 */
import { describe, expect, it as test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

/** Le pagine che esistono davvero: ogni `page.tsx` sotto app/ è una rotta. */
function realRoutes(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...realRoutes(p, `${base}/${e.name}`));
    else if (e.name === 'page.tsx' || e.name === 'page.ts') out.push(base || '/');
  }
  return out;
}

function sourceFiles(dir: string, exts: string[], out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'target', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const REAL = new Set(realRoutes(path.join(ROOT, 'app')));
const DYNAMIC = [...REAL]
  .filter((r) => r.includes('['))
  .map((r) => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`));

const routeExists = (r: string) => REAL.has(r) || DYNAMIC.some((re) => re.test(r));

/**
 * Non sono rotte di pagina, e vanno escluse o il gate urla su cose corrette:
 * - `/api/...`   → route handler, non pagine
 * - `/auth`      → prefisso in route-config.ts, non una destinazione
 * - `/tesseract` → cartella di asset statici in public/, passata a tesseract.js
 */
const NOT_PAGES = [/^\/api(\/|$)/, /^\/auth$/, /^\/tesseract(\/|$)/];
const skip = (r: string) => r === '/' || NOT_PAGES.some((re) => re.test(r));

type Ref = { file: string; line: number; route: string };

function collect(): Ref[] {
  const refs: Ref[] = [];
  const push = (file: string, line: number, route: string) => {
    if (!skip(route)) refs.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), line, route });
  };

  for (const f of sourceFiles(path.join(ROOT, 'src-tauri', 'src'), ['.rs'])) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const m = l.match(/route: *"(\/[^"]*)"/);
      if (m) push(f, i + 1, m[1]);
    });
  }
  for (const dir of ['lib', 'components', 'app']) {
    for (const f of sourceFiles(path.join(ROOT, dir), ['.ts', '.tsx'])) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        const m = l.match(/(?:href|route|path): *['"](\/[a-z0-9/_[\]-]*)['"]/i);
        if (m) push(f, i + 1, m[1]);
      });
    }
  }
  return refs;
}

describe('integrità delle rotte interne', () => {
  test('esistono pagine reali sotto app/', () => {
    expect(REAL.size).toBeGreaterThan(50);
  });

  test('ogni rotta citata nel codice corrisponde a una pagina', () => {
    const bad = collect().filter((r) => !routeExists(r.route));
    const detail = bad.map((b) => `${b.route}  (${b.file}:${b.line})`).join('\n  ');
    expect(bad.length, bad.length ? `Rotte inesistenti:\n  ${detail}` : '').toBe(0);
  });
});
