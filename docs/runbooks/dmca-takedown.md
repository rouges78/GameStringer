# Runbook — eseguire un takedown sul Patch Hub

Questo è il **come si fa**, comando per comando. La policy (cosa deve contenere
una notifica valida, gli SLA, la contro-notifica) sta in [`../DMCA.md`](../DMCA.md).

> ✅ **Prova a freddo ESEGUITA il 10/08/2026** (sera, in produzione, su un pack
> fittizio `[TEST]` — id `2c1a5e50-4013-41ff-b359-3bdd050f9409`, lasciato in
> `pending` con 3 righe di `moderation_log` e 1 di `pack_reports` come prova).
> Ciclo completo: pubblicazione → segnalazione → takedown → verifica RLS da
> `anon` (il pack sparisce, i 3 veri restano) → ripristino → riverifica (torna
> visibile) → archiviazione. **E ha stanato due guasti che il documento da solo
> non poteva vedere:**
>
> 1. ⛔ **Zero moderatori in produzione.** `is_moderator` era `false` su TUTTI
>    gli account: il passo 3 non lo poteva eseguire nessuno, da nessun client.
>    Corretto la sera stessa (`rouges78` → moderatore). Se cambia l'account di
>    moderazione, ricordarsi che questo flag È la procedura.
> 2. ⛔ **Il fallimento è MUTO.** Il takedown tentato da un non-moderatore non
>    dà errore: `trg_enforce_pack_status` rimette lo status com'era e l'UPDATE
>    «riesce». Misurato: update a `pending` da account non moderatore → nessun
>    errore, status ancora `published`. La verifica d'effetto del passo 3 non è
>    prudenza, è l'UNICO modo di accorgersene.
>
> ⚠️ Nota per chi esegue da console SQL (non dall'app): `auth.uid()` viene dal
> JWT, quindi da console è `null` e si è SEMPRE non-moderatori — il takedown
> verrebbe annullato in silenzio (guasto 2). Prima dei comandi, nella stessa
> transazione:
> `select set_config('request.jwt.claims', '{"sub":"<UUID-MODERATORE>","role":"authenticated"}', true);`
> E la verifica «da fuori» si fa con `set local role anon;` + select + `reset role;`.
>
> ⛔ **Non cancellare il pack `[TEST]`**: `moderation_log` e `pack_reports` gli
> sono agganciati con `ON DELETE CASCADE` — cancellarlo cancellerebbe la prova.

## Schema reale (verificato sul DB di produzione il 10/08/2026)

```
translation_packs   status text · author_id uuid
                    trigger: translation_packs_publish_guard_trg (rate-limit)
                             trg_enforce_pack_status   (chi può pubblicare)
moderation_log      id · pack_id · moderator_id · action · reason · created_at
pack_reports        id · pack_id · reporter_id · reason · created_at
```

La policy di lettura pubblica mostra solo i pack in stato `published` /
`verified` / `featured`: **riportare lo status a `pending` li toglie dalla vista
pubblica**, senza cancellare nulla. È la mossa reversibile, ed è quella giusta
per prima — una contro-notifica accolta deve poter ripristinare il pack.

---

## 1. Trovare il pack

Da una segnalazione arriva un URL, un ID o un titolo. Serve l'`id`:

```sql
select id, title, game_name, author_id, status, created_at
from translation_packs
where id::text = '<ID-DALLA-SEGNALAZIONE>'
   or title ilike '%<parte del titolo>%'
   or game_name ilike '%<nome del gioco>%';
```

⚠️ Se torna **più di una riga**, fermarsi e identificare con certezza: rimuovere
il pack sbagliato danneggia un autore incolpevole e non risolve la segnalazione.

## 2. Registrare la segnalazione

Prima di agire, si scrive che è arrivata. Se il segnalante ha un account:

```sql
insert into pack_reports (pack_id, reporter_id, reason)
values ('<PACK-ID>', '<UUID-REPORTER-o-null>', 'DMCA: <sintesi> — notifica del <data>, contatto <email>');
```

`reporter_id` può essere `null` per una notifica via email da un terzo esterno:
il testo di `reason` resta la traccia.

## 3. Togliere dalla vista pubblica (azione reversibile)

```sql
update translation_packs set status = 'pending' where id = '<PACK-ID>';

insert into moderation_log (pack_id, moderator_id, action, reason)
values ('<PACK-ID>', '<TUO-UUID>', 'takedown_dmca',
        'Notifica DMCA del <data> da <titolare/agente>. Pack tolto dalla vista pubblica in attesa di contro-notifica.');
```

**Verifica d'effetto — non fidarsi dell'UPDATE che non dà errore:**

```sql
select id, status from translation_packs where id = '<PACK-ID>';
-- deve dire 'pending'
```

E poi **guardarlo da fuori**: aprire il Patch Hub in incognito o da un altro
account e controllare che il pack non compaia più. La policy RLS è la difesa
vera, ma va vista funzionare almeno una volta.

## 4. Avvisare l'autore

Non è una formalità: senza avviso l'autore non può fare contro-notifica, e la
procedura DMCA si regge su quella possibilità.

```sql
select u.email from auth.users u
join translation_packs p on p.author_id = u.id
where p.id = '<PACK-ID>';
```

Nel messaggio: cosa è stato rimosso, chi ha segnalato e perché, come rispondere,
entro quando.

## 5. Se serve rimuovere anche il file

Lo status nasconde il pack, ma il file su Storage **resta scaricabile da chi ha
l'URL**. Se la notifica riguarda il contenuto (non solo la sua pubblicazione),
va rimosso anche quello — dal pannello Storage di Supabase, bucket dei pack.

⚠️ Questo passo **non è reversibile**: farlo solo dopo aver valutato la
contro-notifica, o quando la violazione è palese.

---

## Ripristino (contro-notifica accolta)

```sql
update translation_packs set status = 'published' where id = '<PACK-ID>';

insert into moderation_log (pack_id, moderator_id, action, reason)
values ('<PACK-ID>', '<TUO-UUID>', 'restore',
        'Contro-notifica accolta il <data>: <motivo>.');
```

Poi riverificare che sia di nuovo visibile da un altro account.

---

## ⛔ Prova a freddo (da fare PRIMA che serva davvero)

Un runbook si collauda quando non c'è fretta:

1. pubblicare un pack di prova (uno dei tuoi, su un gioco qualsiasi);
2. eseguire i passi 1-3 su quello;
3. verificare **da un altro account** che sia sparito dalla vista pubblica;
4. eseguire il ripristino e verificare che torni visibile;
5. cancellare le righe di prova da `moderation_log` e `pack_reports`, oppure
   lasciarle marcate `[TEST]` nel `reason` — meglio se restano: dimostrano che
   la procedura è stata provata e quando.

Finché questi cinque passi non sono stati fatti almeno una volta, questo
documento descrive un'intenzione, non una capacità.

## Aperti

- `dmca@gamestringer.ai` **non è configurata** (`DMCA.md` dice «da configurare»):
  finché non esiste, la notifica arriva dove capita e l'SLA di 72 ore non è
  misurabile da nessuno.
- Il **registro pubblico** dei takedown è previsto dalla policy ma non c'è una
  pagina che lo mostri: oggi `moderation_log` è visibile solo a chi interroga il
  database.
