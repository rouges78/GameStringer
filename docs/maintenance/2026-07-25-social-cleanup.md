# Pulizia area social — 25/07/2026

Progetto Supabase: `gamestringer-community` (`relbkjoxdnbqizgomzhs`).
Record di manutenzione: stato **prima** della pulizia, cosa è stato cancellato e perché.

## Snapshot conteggi PRIMA (25/07/2026)

| Tabella | Righe | Nota |
|---|---:|---|
| chat_conversations | **11.623** | tutte create il 23/04/2026, 0 messaggi, 0 partecipanti |
| user_profiles | 1.619 | utenti reali, ~70–100/settimana, ancora in crescita |
| community_presence | 1.447 | di cui **738** più vecchie di 30 giorni |
| community_room_members | 575 | |
| community_messages | 64 | l'unica attività sociale reale |
| forum_threads | 10 | |
| chat_rooms | 8 | tabella parallela mai usata |
| community_rooms | 4 | |
| forum_posts | 3 | |
| friendships | 0 | funzione amici mai usata in 4 mesi |
| notifications | 0 | |
| user_notifications | 0 | doppione di `notifications` |
| user_presence | 0 | doppione di `community_presence` |
| chat_messages | 0 | |
| chat_participants | 0 | |

### Diagnosi delle 11.623 conversazioni

Verifica eseguita prima di cancellare:

```
conv_totali            11623
conv_con_messaggi          0
conv_con_partecipanti      0
conv_fuori_dal_23_04       0
```

I timestamp partono da `2026-04-23 01:28:59.786` con intervalli di 18–500 ms:
non è un seed di test ma un **loop andato a vuoto** che ha creato conversazioni
vuote finché non si è fermato. Nessun contenuto utente coinvolto.

### Nota sui profili utente

`user_profiles` = 1.619, username tutti distinti, creazione continua fino a oggi
(~14/giorno). I nomi recenti sono di persone reali. **Ma**: 0 bio compilate,
0 amicizie, 3 post nel forum, 64 messaggi in totale. Ci sono utenti, non c'è
interazione — il problema dell'area social è di struttura, non di traffico.

## Cancellazioni eseguite

1. `DELETE FROM chat_conversations` — 11.623 righe (tutte vuote, vedi sopra).
2. `DELETE FROM community_presence WHERE last_seen < now() - interval '30 days'`
   — 738 righe di presenza scadute.

Nessun dato prodotto da un utente è stato toccato: le tabelle con contenuto
reale (`community_messages`, `forum_threads`, `forum_posts`, `user_profiles`)
sono rimaste intatte.

## Codice rimosso

- `components/tools/community-chat.tsx` — 759 righe, terza implementazione di
  chat, **zero import** in tutto il repo. Rimozione confermata da `tsc --noEmit`
  (nessun riferimento pendente).
- `components/social/friends-sidebar.tsx.bak` — file di backup committato per
  errore (il `.tsx` vero resta al suo posto).

## Problemi strutturali rilevati (non risolti qui)

- **Tre implementazioni di chat in parallelo**: Lobby (`persistent-chat.tsx`,
  visibile ovunque ma su schema mai migrato), DM (`chat-panel.tsx` + `/chat-popup`
  + voce tray, schema in DB ma UI incompleta con TODO scoperti), e
  `components/tools/community-chat.tsx` (759 righe, **zero import**).
- **Tabelle doppione**: `notifications` / `user_notifications`,
  `community_presence` / `user_presence`, `chat_rooms` / `community_rooms`.
- **SQL di setup DISALLINEATO** (`SUPABASE_MIGRATION_SQL` in
  `lib/social/community-hub-backend.ts`, righe 1134–1685). **Non è codice morto**:
  è mostrato in Impostazioni → "Community Hub Supabase" con un pulsante "Copia
  SQL", perché l'utente configuri la *propria* istanza Supabase.
  Il problema è che **non corrisponde allo schema reale**: definisce
  `chat_rooms` / `chat_messages` / `chat_room_members` in versione *room-based*
  (`room_id`, `author_id`), mentre le tabelle vere in produzione sono
  *DM-based* (`chat_messages.conversation_id` → `chat_conversations`).
  Chi segue quelle istruzioni si ritrova un DB **incompatibile con l'app**.
  Va riallineato — dopo aver deciso quale sistema di chat si tiene, così lo si
  riscrive una volta sola.
  (Tentata la rimozione il 25/07, poi **ripristinata**: l'export è usato da
  `app/settings/page.tsx:87,119,196`.)
- `supabase/community-chat-schema.sql` non è in `supabase/migrations/`: lo schema
  su cui poggia la Lobby non è mai stato migrato formalmente.
- `/patch-hub` è un quarto pezzo di community, fuori dalla navigazione principale,
  concettualmente sovrapposto al tab "Pack" del Community Hub.

Il consolidamento su un sistema unico è la decisione successiva.
