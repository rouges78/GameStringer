-- Policy Storage per il bucket translation-packs — VERSIONAMENTO.
--
-- Storia: il 09/08/2026 la prova d'effetto del primo pack reale (Greed Stays
-- Home) ha scoperto che storage.objects aveva ZERO policy: ogni upload era
-- negato a chiunque, da sempre («new row violates row-level security policy»).
-- Le prime due policy sono state create A MANO sul remoto quel giorno; la
-- terza (DELETE) è nata con il rollback atomico di publishPack: senza, la
-- remove() dei file falliva in silenzio e il rollback lasciava orfani.
-- Questo file porta tutte e tre sotto controllo di versione.
--
-- Idempotente: su un DB dove le policy esistono già (il remoto) non fa nulla.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated upload pack files'
  ) then
    create policy "Authenticated upload pack files"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'translation-packs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read pack files'
  ) then
    create policy "Public read pack files"
    on storage.objects for select to public
    using (bucket_id = 'translation-packs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authors delete own pack files'
  ) then
    -- Solo i PROPRI oggetti (owner_id = uploader) e solo in questo bucket:
    -- serve al rollback di publishPack quando un upload fallisce a metà.
    create policy "Authors delete own pack files"
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'translation-packs'
      and owner_id = (select auth.uid()::text)
    );
  end if;
end $$;
