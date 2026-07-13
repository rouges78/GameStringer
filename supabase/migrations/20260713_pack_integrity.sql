-- Patch Hub — integrità dei pack e auto-flag da segnalazioni.
--
-- 1. SHA-256 per file (pack_files.sha256) + hash aggregato del contenuto
--    (translation_packs.content_sha256 = sha256 degli sha256 dei file, in
--    ordine di nome). Calcolati dal client al publish, VERIFICATI dal client
--    al download PRIMA dell'install: un pack manomesso nello storage o in
--    transito viene rifiutato, non installato con un semplice warning.
-- 2. Auto-flag: al terzo reporter DISTINTO un pack pubblicato torna in
--    'pending' (sparisce dalla lista pubblica via RLS esistente) e viene
--    tracciato in moderation_log come 'auto-flag'. La revisione umana decide
--    poi se ripubblicare (approve) o rimuovere.

alter table public.translation_packs
  add column if not exists content_sha256 text
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

alter table public.pack_files
  add column if not exists sha256 text
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

create index if not exists pack_reports_pack_idx on public.pack_reports (pack_id);

create or replace function public.pack_reports_autoflag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  distinct_reporters int;
  cur_status text;
begin
  select count(distinct coalesce(reporter_id::text, id::text)) into distinct_reporters
  from public.pack_reports
  where pack_id = new.pack_id;

  if distinct_reporters >= 3 then
    select status into cur_status from public.translation_packs where id = new.pack_id;
    -- Solo i pack visibili al pubblico vengono ritirati; quelli già in
    -- pending/draft restano dove sono (la coda di moderazione li ha già).
    if cur_status in ('published', 'verified', 'featured') then
      update public.translation_packs
      set status = 'pending',
          moderation_note = 'auto-flag: ' || distinct_reporters || ' segnalazioni distinte',
          moderated_at = now()
      where id = new.pack_id;

      insert into public.moderation_log (pack_id, action, reason)
      values (new.pack_id, 'auto-flag', distinct_reporters || ' distinct reports');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pack_reports_autoflag_trg on public.pack_reports;
create trigger pack_reports_autoflag_trg
  after insert on public.pack_reports
  for each row execute function public.pack_reports_autoflag();
