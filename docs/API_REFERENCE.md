# API Reference — GameStringer

> **Cosa trovi qui.** L'interfaccia fra il frontend e il backend di GameStringer,
> che è una sola: i **comandi Tauri** invocati con `invoke()`. Le route HTTP
> `/api/*` non esistono più come endpoint funzionanti — perché, è spiegato qui
> sotto.

## Perché questo documento parlava di endpoint REST

GameStringer è nato come applicazione Next.js con vere route API. Da lì venivano
`GET /api/games`, `POST /api/translate` e le altre trenta, ed è quello che questo
documento descriveva.

Poi il pacchetto desktop è passato a `output: 'export'` (17/05/2026, vedi
`next.config.js`): l'export statico **non produce route server**, quindi nel
pacchetto Tauri quegli endpoint semplicemente non esistevano più. Per un periodo
il documento ha descritto due modalità — «reali in web/dev, assenti nel
desktop» — e per un periodo è stata la verità.

Non lo è più. **Tutte e 33 le route sotto `app/api/` sono state svuotate a stub**
e rispondono `501 { "error": "not_available_in_desktop" }` in qualunque
modalità, `npm run dev` compreso. Il codice originale vive nella cronologia git,
i file restano solo perché il build statico non inciampi.

Quindi non ci sono due interfacce. Ce n'è una.

## L'interfaccia vera: `invoke()`

Il frontend parla col backend Rust attraverso il wrapper in
[`lib/tauri-api.ts`](../lib/tauri-api.ts), **non** importando `@tauri-apps/api`
direttamente:

```ts
import { invoke } from '@/lib/tauri-api';

const giochi = await invoke<Game[]>('get_games_fast');
const stato  = await invoke<UnrealLocStatus>('get_unreal_localization_status', {
  gamePath: game.installPath,
});
```

Tre cose che il wrapper fa e che conviene sapere:

- **Fuori da Tauri lancia subito**, invece di fallire in modo oscuro più avanti.
  `isTauri()` è esportata dallo stesso modulo per chi deve ramificare.
- **I nomi degli argomenti si convertono da soli**: `gamePath` in JS arriva come
  `game_path` in Rust. Non normalizzarli a mano.
- **I log mascherano i segreti** (`password`, `api_key`, `token`…) e riassumono i
  risultati grandi, così un array di 2000 giochi non finisce in console per
  intero.

### Errori

Un comando Rust che ritorna `Result<T, String>` diventa una promise: `Ok` la
risolve, `Err` la rifiuta con quella stringa come messaggio. Non ci sono codici
di stato HTTP, e non c'è rate limiting: è una chiamata in-process.

```ts
try {
  await invoke('set_pak_aes_key', { gamePath, key });
} catch (e) {
  // e è la stringa che il comando Rust ha messo dentro Err(...)
  toast.error(String(e));
}
```

## Quali comandi esistono

**864 comandi registrati**, di cui 405 effettivamente invocati dal frontend. Un
elenco a mano in questo documento sarebbe sbagliato entro una settimana, quindi
qui non c'è: la fonte autorevole è il codice.

```bash
# La lista completa e sempre vera
grep -A 900 "invoke_handler" src-tauri/src/main.rs

# Verifica che ogni invoke() del frontend abbia un comando dietro
npm run tauri:check-cmds
```

`tauri:check-cmds` gira anche in CI ed è un gate bloccante: se qualcuno invoca un
comando che non esiste, la build lo dice.

### Le famiglie principali

Ogni modulo sotto `src-tauri/src/commands/` espone un gruppo coerente. I più
grandi, per numero di comandi registrati:

| Modulo | Comandi | Di cosa si occupa |
|---|---:|---|
| `notifications` | 86 | Sistema di notifiche e code di eventi |
| `steam_enhanced` | 38 | Libreria Steam, metadati, arricchimento |
| `steam` | 29 | Rilevamento installazioni e percorsi Steam |
| `danganronpa_patcher` | 27 | Patcher dedicato (WAD, STX) |
| `profiles` | 24 | Profili utente, autenticazione, cifratura |
| `utilities` | 16 | Impostazioni, percorsi, servizi di supporto |
| `glossary` | 16 | Glossari e memoria terminologica |
| `epic` | 16 | Integrazione Epic Games |
| `backup` | 16 | Backup e ripristino |

Per la copertura per engine — quali patcher esistono, quanti comandi e quanti
test ciascuno — vedi [`ENGINE-COVERAGE.md`](ENGINE-COVERAGE.md).

## E le route `/api/`?

Restano come stub e vanno lasciate stare. La regola di progetto è **zero
`fetch('/api/')` in codice nuovo**: ogni chiamata rimasta va migrata a `invoke()`.

La mappa endpoint-per-endpoint, con la classificazione di cosa sostituisce cosa,
è in [`API_MIGRATION_MAP.md`](API_MIGRATION_MAP.md); il piano di rientro è in
[`fetch-api-migration-plan.md`](fetch-api-migration-plan.md).

Vale anche per `app/api/v1/` — quella che il documento chiamava «Public API v1»,
pensata per quando l'app girasse come server. Anche le sue quattro route
(`health`, `languages`, `translate`, `batch`) sono stub. Se un giorno servirà
un'API HTTP esterna, sarà da progettare, non da riesumare.

## Testare un comando

Non serve cURL: serve l'app. Il modo più rapido è la console per sviluppatori
della finestra Tauri, dove `invoke` è raggiungibile perché `withGlobalTauri` è
attivo:

```js
await window.__TAURI__.core.invoke('get_unreal_localization_status', {
  gamePath: 'C:/…/steamapps/common/NomeGioco'
});
```

Per i comandi con logica vera, però, i test Rust valgono di più: `cargo test
--manifest-path src-tauri/Cargo.toml --lib` copre 1542 casi e non richiede un
gioco installato.
