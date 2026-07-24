-- Patch Hub — rate-limiting SERVER-side su publish + conteggio download idempotente.
--
-- ⚠️ MIGRATION PROPOSTA — NON ANCORA APPLICATA. Va eseguita da Davide
--    (Supabase Dashboard → SQL Editor, oppure `supabase db push`) DOPO revisione.
--    Nessuno strumento qui applica migration; questo file è solo il proposto.
--
-- Coerente con lo stile delle guard già presenti (compat_reports_guard,
-- pack_reports_autoflag): funzioni plpgsql SECURITY DEFINER con
-- `set search_path = public`, IP derivato best-effort da request.headers e
-- salvato SOLO come md5 hash in tabelle-evento private (nessuna SELECT policy,
-- quindi non leggibili da anon/authenticated e mai esposte via `select *`).
--
-- Perché serve: le scritture del Patch Hub vanno DIRETTE a Supabase e NON
-- passano dal middleware Next locale (lib/rate-limiter.ts, middleware.ts), che
-- protegge solo le route del processo. Il throttle client (lib/social/hub-cache.ts)
-- è la prima linea ma è aggirabile: questo è l'enforcement reale.
--
-- Cosa fa:
-- 1. PUBLISH GUARD  — BEFORE INSERT su translation_packs: max 5 nuovi pack/ora
--    per autore e max 10 nuovi pack/ora per IP. Superata la soglia l'INSERT
--    fallisce con errcode 53400 (configuration_limit_exceeded): a differenza
--    delle guard "silenziose" di compat_reports, qui l'errore È visibile perché
--    il client si aspetta la riga di ritorno (publishPack fa .select().single());
--    fallire onestamente lascia il pack come bozza locale invece di far credere
--    che sia stato pubblicato.
-- 2. DOWNLOAD IDEMPOTENTE — increment_downloads() non incrementa più a ogni
--    chiamata: registra un evento (pack_id, ip_hash) e conta il download UNA
--    sola volta per IP per pack in una finestra di 24h. Ferma il gonfiaggio del
--    contatore da download ripetuti/script.

-- ─────────────────────────────────────────────────────────────────
-- 1. PUBLISH RATE-LIMIT
-- ─────────────────────────────────────────────────────────────────

-- Tabella-evento PRIVATA per il rate-limit dei publish. Nessuna FK verso
-- translation_packs: la riga viene registrata dentro un trigger BEFORE INSERT,
-- quando il pack "genitore" non è ancora stato scritto (una FK fallirebbe).
-- Le righe servono solo alla finestra di rate-limit e sono potabili (vedi prune
-- opzionale in fondo). ip_hash non è mai esposto: la tabella non ha SELECT policy.
create table if not exists public.pack_publish_events (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid,
  author_id uuid,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists pack_publish_events_author_idx
  on public.pack_publish_events (author_id, created_at desc);
create index if not exists pack_publish_events_ip_idx
  on public.pack_publish_events (ip_hash, created_at desc);

alter table public.pack_publish_events enable row level security;
-- Nessuna policy: la scrittura avviene solo via trigger SECURITY DEFINER
-- (che bypassa RLS); anon/authenticated non possono leggere né scrivere qui.

create or replace function public.translation_packs_publish_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs json;
  ip text;
  iph text;
  author_recent int;
  ip_recent int;
begin
  -- Client IP (best-effort): primo hop di x-forwarded-for da PostgREST.
  begin
    hdrs := current_setting('request.headers', true)::json;
    ip := nullif(trim(split_part(coalesce(hdrs ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    ip := null;
  end;
  iph := case when ip is null then null else md5(ip) end;

  -- Limite per autore: max 5 nuovi pack nell'ultima ora.
  if new.author_id is not null then
    select count(*) into author_recent
    from public.pack_publish_events e
    where e.author_id = new.author_id
      and e.created_at > now() - interval '1 hour';
    if author_recent >= 5 then
      raise exception 'rate_limit: too many packs published by this author in the last hour'
        using errcode = '53400';
    end if;
  end if;

  -- Limite per IP: max 10 nuovi pack nell'ultima ora (copre autori multipli
  -- dietro lo stesso IP / registrazioni usa-e-getta).
  if iph is not null then
    select count(*) into ip_recent
    from public.pack_publish_events e
    where e.ip_hash = iph
      and e.created_at > now() - interval '1 hour';
    if ip_recent >= 10 then
      raise exception 'rate_limit: too many packs published from this network in the last hour'
        using errcode = '53400';
    end if;
  end if;

  -- Registra l'evento (nessuna FK: vedi nota sulla tabella). new.id è già
  -- valorizzato dal DEFAULT prima dei trigger BEFORE.
  insert into public.pack_publish_events (pack_id, author_id, ip_hash)
  values (new.id, new.author_id, iph);

  return new;
end;
$$;

drop trigger if exists translation_packs_publish_guard_trg on public.translation_packs;
create trigger translation_packs_publish_guard_trg
  before insert on public.translation_packs
  for each row execute function public.translation_packs_publish_guard();

-- Hardening (coerente con 20260723_harden_trigger_guard_execute): la funzione è
-- usata SOLO come trigger, quindi togliere l'EXECUTE RPC diretto è sicuro.
revoke execute on function public.translation_packs_publish_guard() from anon, authenticated, public;

-- ─────────────────────────────────────────────────────────────────
-- 2. DOWNLOAD COUNT IDEMPOTENTE
-- ─────────────────────────────────────────────────────────────────

-- Tabella-evento PRIVATA dei download. Qui la FK è sicura: increment_downloads()
-- è una RPC chiamata DOPO che il pack esiste. ip_hash mai esposto (no SELECT policy).
create table if not exists public.pack_download_events (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.translation_packs(id) on delete cascade,
  ip_hash text,
  contributor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pack_download_events_pack_ip_idx
  on public.pack_download_events (pack_id, ip_hash, created_at desc);

alter table public.pack_download_events enable row level security;
-- Nessuna policy: popolata solo dalla RPC SECURITY DEFINER qui sotto.

-- Rimpiazza increment_downloads(pack_id UUID) mantenendo la STESSA firma e nome
-- dell'argomento (`pack_id`), così il client (supabase.rpc('increment_downloads',
-- { pack_id })) continua a funzionare invariato. Ora però conta UNA volta per IP
-- per pack ogni 24h; senza IP (raro) resta un incremento best-effort.
create or replace function public.increment_downloads(pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs json;
  ip text;
  iph text;
  recent int;
begin
  begin
    hdrs := current_setting('request.headers', true)::json;
    ip := nullif(trim(split_part(coalesce(hdrs ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    ip := null;
  end;
  iph := case when ip is null then null else md5(ip) end;

  -- Idempotenza: stesso IP + stesso pack conta una sola volta ogni 24h.
  if iph is not null then
    select count(*) into recent
    from public.pack_download_events e
    where e.pack_id = increment_downloads.pack_id
      and e.ip_hash = iph
      and e.created_at > now() - interval '24 hours';
    if recent > 0 then
      return;  -- già conteggiato di recente: no-op
    end if;
  end if;

  insert into public.pack_download_events (pack_id, ip_hash, contributor_id)
  values (increment_downloads.pack_id, iph, auth.uid());

  update public.translation_packs
  set downloads = downloads + 1
  where id = increment_downloads.pack_id;
end;
$$;

-- increment_downloads È una RPC legittima: deve restare eseguibile dal client
-- (anon/authenticated). CREATE OR REPLACE preserva i grant esistenti; il grant
-- esplicito qui sotto è idempotente e documenta l'intento.
grant execute on function public.increment_downloads(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Manutenzione opzionale (eseguibile a mano o via cron/pg_cron):
--   delete from public.pack_publish_events  where created_at < now() - interval '7 days';
--   delete from public.pack_download_events where created_at < now() - interval '90 days';
-- Le finestre di rate-limit sono 1h/24h: righe più vecchie sono inutili.
