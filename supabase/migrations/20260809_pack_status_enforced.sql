-- ============================================================================
-- Lo STATUS di un pack lo decide il DATABASE, non il client.
--
-- Situazione trovata il 09/08/2026, misurando la catena «traduci → progetto →
-- condividi → pubblica»:
--
--  1. publishPack() scriveva sempre status='pending', e l'unica funzione che
--     poteva cambiarlo (moderatePack) non era chiamata da NESSUNA riga di UI:
--     nessuna coda, nessuna rotta admin. Con la policy di lettura pubblica
--     limitata a ('published','verified','featured'), un pack caricato era
--     visibile solo al suo autore — per sempre. Il ciclo non poteva chiudersi.
--
--  2. E dall'altro lato, il buco opposto: "Users create packs" controlla solo
--     author_id = auth.uid() e NON lo status, mentre "Users update own packs"
--     lascia all'autore un UPDATE libero sulla propria riga. Quindi la
--     moderazione era già aggirabile — bastava inserire (o aggiornare a)
--     status='published' chiamando l'API con la propria chiave. Una guardia
--     scritta nel client è un cartello, non una serratura.
--
-- SCELTA (Davide, 09/08/2026): auto-pubblicazione per gli autori VERIFICATI,
-- coda per tutti gli altri. Il campo esiste già: user_profiles.verified_translator.
-- Solo un moderatore può cambiare lo status a posteriori.
--
-- Niente SECURITY DEFINER: user_profiles ha già "Public read profiles"
-- USING(true), quindi la funzione legge quello che le serve con i privilegi
-- del chiamante. Meno potere del necessario è la posizione giusta — vedi la
-- lezione sui SECURITY DEFINER lasciati eseguibili da public.
-- ============================================================================

-- La colonna del ruolo arriva da forum-schema.sql, che potrebbe non essere
-- stato applicato su questo database: la garantiamo qui, così la migration
-- non dipende dall'ordine di applicazione.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.enforce_pack_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_verified  BOOLEAN := FALSE;
  v_moderator BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(verified_translator, FALSE), COALESCE(is_moderator, FALSE)
    INTO v_verified, v_moderator
    FROM public.user_profiles
   WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    -- Lo status proposto dal client viene IGNORATO, sempre.
    NEW.status := CASE WHEN COALESCE(v_verified, FALSE) THEN 'published' ELSE 'pending' END;
    RETURN NEW;
  END IF;

  -- UPDATE: l'autore può correggere il proprio pack (nome, descrizione, file),
  -- ma non promuoverlo. Cambiare status è un atto di moderazione.
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT COALESCE(v_moderator, FALSE) THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Idempotente: la migration deve poter essere riapplicata senza rompersi.
DROP TRIGGER IF EXISTS trg_enforce_pack_status ON public.translation_packs;
CREATE TRIGGER trg_enforce_pack_status
  BEFORE INSERT OR UPDATE ON public.translation_packs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pack_status();

-- Igiene: nessuno deve poter invocare la funzione a mano. Gira solo come
-- trigger. (Stessa cura delle migration *_guard_revoke_execute.)
REVOKE ALL ON FUNCTION public.enforce_pack_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_pack_status() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_pack_status() FROM authenticated;

COMMENT ON FUNCTION public.enforce_pack_status() IS
  'Forza translation_packs.status: published per gli autori verificati, pending per gli altri; solo i moderatori possono cambiarlo dopo. Il client non è autorevole sullo status.';
