# Runbook — submission antivirus per ogni release

> Da eseguire **entro poche ore da ogni release pubblica** (5 minuti).
> La reputazione SmartScreen è *per file*: ogni nuovo installer riparte da
> zero, e i primi giorni sono quelli in cui gli utenti vedono gli avvisi.
> Helper: `npm run av:checklist` (elenca gli asset con sha256 e i passi).

## 0. La soluzione DEFINITIVA: firma del codice (una volta sola)

> **Stato attuale (13/07/2026): gli installer NON sono code-signed.**
> `tauri.conf.json` non ha `certificateThumbprint`/`signCommand` e `release.yml`
> non firma nulla. Gli aggiornamenti automatici (Tauri Updater) sono firmati
> con minisign, ma quella è una cosa diversa dalla firma Authenticode
> dell'installer che SmartScreen guarda. Un binario **firmato** con un
> certificato reputato salta la maggior parte degli avvisi *alla radice* —
> vale molto più di qualsiasi submission ripetuta.

> ⚠️ **Vincolo di licenza — verificato 13/07/2026.** GameStringer usa la
> **"Source Available License v1.1"**, che NON è una licenza open-source
> approvata OSI. Questo esclude le due opzioni gratuite più citate:
> - **SignPath.io Foundation**: richiede *"an OSI-approved Open Source license
>   without commercial dual-licensing"* → **non eleggibile** con la licenza
>   attuale (fonte: signpath.org/terms).
> - **Azure Artifact Signing (ex Trusted Signing), piano individuale**:
>   validazione identità individuale disponibile solo in **USA e Canada** →
>   **non disponibile per un individuo in Italia** (fonte: Microsoft Learn,
>   Artifact Signing FAQ).

Opzioni realmente percorribili da qui (in ordine di rapporto costo/beneficio):

1. **Azure Artifact Signing come *organizzazione* UE** (~10–15 $/mese +
   consumo). La validazione *organization* copre l'Unione Europea, quindi
   funziona con una ditta/entità registrata (anche individuale con P.IVA, da
   verificare col supporto Azure). Firma in cloud, nessun token hardware,
   ottima reputazione SmartScreen. È la via migliore se hai (o apri) una
   posizione fiscale. <https://azure.microsoft.com/products/artifact-signing>
2. **Certificato OV da una CA** (Sectigo, DigiCert, SSL.com… ~150–300 €/anno,
   **indipendente dalla licenza**). Con OV la reputazione SmartScreen si
   costruisce nel tempo; le CA moderne offrono firma via **cloud HSM** (niente
   chiavetta USB). Buon compromesso se non vuoi aprire un'entità.
3. **Certificato EV** (~300–500 €/anno + HSM/token): dà reputazione SmartScreen
   **immediata**, ma costa di più e richiede hardware o HSM cloud.
4. **Rilicenziare a una licenza OSI** (MIT/GPL/…) per sbloccare SignPath
   Foundation *gratis*: possibile ma è una scelta di prodotto — rinunceresti
   alla protezione commerciale che la Source-Available ti dà oggi. Da valutare
   solo se quella protezione non ti serve più.

Nel frattempo, la mitigazione gratuita (submission + reputazione, §1–3 sotto)
resta il piano di riserva.

Quando hai un certificato, abilitarlo è a due passi:

1. In `src-tauri/tauri.conf.json`, sezione `bundle.windows`, aggiungi:
   ```json
   "windows": {
     "certificateThumbprint": "<THUMBPRINT>",
     "digestAlgorithm": "sha256",
     "timestampUrl": "http://timestamp.digicert.com"
   }
   ```
   (oppure, per firma in cloud/SignPath, usa `"signCommand": "<comando>"`).
2. Sul runner CI, importa il certificato dai GitHub Secrets prima di
   `tauri build` (o lascia che SignPath firmi l'artefatto dopo la build).

Finché non c'è un certificato, restano validi i passi 1–3 qui sotto (submission
+ reputazione) come mitigazione.

## 1. Microsoft (Defender + SmartScreen) — sempre

1. Apri <https://www.microsoft.com/en-us/wdsi/filesubmission>.
2. Seleziona **Software developer** (richiede login con account Microsoft).
3. Compila:
   - *What do you believe this file is?* → **Incorrectly detected as malware
     (false positive)** / "I believe this file is safe".
   - Allega **`GameStringer_X.Y.Z_x64-setup.exe`** (l'installer firmato è
     l'asset che gli utenti scaricano di più). Se il limite di upload lo
     permette, ripeti per l'MSI.
   - Nel campo note incolla (adattando la versione):
     > GameStringer is an open-source-available game translation tool
     > (https://github.com/rouges78/GameStringer). It bundles/downloads the
     > well-known open-source modding frameworks BepInEx and
     > XUnity.AutoTranslator and includes a DLL (gs-hook) used for runtime
     > text translation in single-player games — these use code-injection
     > techniques that trigger heuristic detections. The installer is
     > code-signed. Please whitelist.
4. Conserva l'ID della submission nella release note interna (opzionale).

## 2. Reputazione SmartScreen — sempre

Installa la release su una macchina Windows pulita (o VM con Defender attivo)
e avvia l'app una volta. Le esecuzioni reali dell'installer firmato sono il
segnale principale con cui SmartScreen costruisce reputazione.

## 3. Altri vendor — solo su segnalazione

Se un utente segnala un blocco di un antivirus specifico, usa il modulo
false-positive del vendor (allegare l'installer o l'URL di release):

| Vendor | Modulo |
|---|---|
| Avast / AVG | <https://www.avast.com/false-positive-file-form.php> |
| Bitdefender | <https://www.bitdefender.com/consumer/support/answer/29358/> |
| Kaspersky | <https://opentip.kaspersky.com/> (Threat Intelligence Portal → Rescan) |
| Norton/Symantec | <https://submit.norton.com/> |
| ESET | <https://support.eset.com/en/kb141> (samples@eset.com) |
| Malwarebytes | <https://forums.malwarebytes.com/forum/122-false-positives/> |
| VirusTotal check | <https://www.virustotal.com/> (per vedere QUALI engine flaggano) |

## 4. Cosa NON fare

- Non chiedere agli utenti di disattivare l'antivirus: indirizzali a
  [ANTIVIRUS.md](ANTIVIRUS.md) (verifica firma + esclusione mirata).
- Non ri-firmare/ri-uploadare un asset già pubblicato per "rigenerare" la
  reputazione: peggiora le cose (nuovo file = reputazione azzerata di nuovo).

## Perché scatta l'euristica (contesto per le submission)

BepInEx e gs-hook usano DLL injection per la traduzione runtime dei giochi
single-player; l'Auto-Hook scanner legge la memoria di processo. Sono le
stesse *tecniche* usate da overlay legittimi (Steam, Discord) — e purtroppo
anche da malware, da cui i falsi positivi euristici. Dettagli per gli utenti
in [ANTIVIRUS.md](ANTIVIRUS.md).
