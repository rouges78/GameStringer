# Runbook — submission antivirus per ogni release

> Da eseguire **entro poche ore da ogni release pubblica** (5 minuti).
> La reputazione SmartScreen è *per file*: ogni nuovo installer riparte da
> zero, e i primi giorni sono quelli in cui gli utenti vedono gli avvisi.
> Helper: `npm run av:checklist` (elenca gli asset con sha256 e i passi).

## 0. La firma del codice: cosa fa davvero (rivisto il 26/07/2026)

> **Stato attuale: gli installer NON sono code-signed.**
> `tauri.conf.json` non ha `certificateThumbprint`/`signCommand` e `release.yml`
> non firma nulla. Gli aggiornamenti automatici (Tauri Updater) sono firmati
> con minisign, ma quella è una cosa diversa dalla firma Authenticode
> dell'installer che SmartScreen guarda.

### ⚠️ Correzione importante: la firma NON è più "la soluzione definitiva"

Questa sezione, fino al 26/07/2026, diceva che un certificato EV azzera
SmartScreen *subito* e che la firma «vale più di qualsiasi submission». **Era
basata su un modello che Microsoft ha smontato nel 2024.**

Ad agosto 2024 gli **OID EV sono stati rimossi dai root del Microsoft Trusted
Root Program**: da allora SmartScreen tratta **tutti** i certificati di code
signing allo stesso modo. Nessun tipo di certificato — EV, OV o IV — concede
più reputazione immediata. La reputazione si costruisce solo con il volume di
download.

E soprattutto vale quello che questo runbook dice già nella sua prima riga: **la
reputazione è per file.** Ogni nuova build ha un hash nuovo e riparte quasi da
zero, firmata o no, anche se la versione precedente aveva mesi di storia buona.
Il documento conteneva già l'informazione che smentiva la sua §0.

**Conseguenza pratica, più importante della scelta del certificato:** con tre
release in due settimane (v1.13 → v1.15, luglio 2026) nessun binario resta in
circolazione abbastanza da accumulare fiducia. **Diradare le release pesa più
che firmarle.**

### Cosa la firma continua a dare

- Toglie **«editore sconosciuto»**: al suo posto compare il nome del titolare.
- Alcuni motori antivirus alzano il punteggio di sospetto sui binari non
  firmati; firmare abbassa quel contributo (ma **non** i rilevamenti euristici
  legati all'iniezione di DLL, che è il comportamento che gli AV segnalano in
  GameStringer — vedi ANTIVIRUS.md).
- Credibilità verso utenti tecnici e procurement aziendale.

Non toglie l'avviso SmartScreen su un binario nuovo. Chi promette il contrario
sta vendendo il modello pre-2024.

### Opzioni per un individuo senza P.IVA (verificate 26/07/2026)

1. **Certificato IV — Individual Validation** (~215–220 $/anno). Emesso a
   **persone fisiche**, identità verificata con documenti personali: **non serve
   una ditta**. È l'unica via realmente aperta oggi.
   Due vincoli nuovi da mettere in conto:
   - la chiave privata deve stare **in hardware** — token USB FIPS oppure un
     servizio di firma in cloud (requisito CA/Browser Forum);
   - dal 15/02/2026 la validità massima è **un anno** (458 giorni di transizione
     dal 01/03/2026), quindi è un costo ricorrente, non una tantum.
2. **Sole Proprietor EV** — esiste per individui, ma richiede lo status di
   *sole proprietor*, cioè in Italia una ditta individuale con P.IVA. Non
   percorribile senza quella. E dopo il 2024 non darebbe comunque un vantaggio
   SmartScreen rispetto a un IV.
3. **EV classico** — solo organizzazioni registrate. Fuori discussione, e ormai
   senza il beneficio per cui lo si comprava.

Restano non eleggibili, come già verificato il 13/07:

- **SignPath.io Foundation**: richiede una licenza OSI-approved; la
  *Source Available License v1.1* di GameStringer non lo è.
- **Azure Artifact Signing**, piano individuale: validazione identità
  individuale solo in USA e Canada; quello *organization* richiede un'entità
  registrata.

### Raccomandazione

**Non comprare adesso.** Prima le due leve che costano zero e oggi pesano di
più: **diradare le release** (perché la reputazione è per hash) e **continuare
le submission** dei §1–3 qui sotto, che restano la mitigazione vera per i falsi
positivi. La firma diventa un investimento sensato quando c'è un flusso di
download costante su versioni che restano in circolazione, e la si compra per
togliere «editore sconosciuto» — non per far sparire SmartScreen.

Fonti della revisione: [Microsoft Learn — SmartScreen reputation for Windows app
developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
· [Microsoft Trusted Root Program, rimozione OID
EV](https://learn.microsoft.com/en-us/answers/questions/1846647/program-requirements-microsoft-trusted-root-progra)
· [ToDesktop — EV certs do not grant immediate reputation
anymore](https://www.todesktop.com/blog/posts/windows-apps-psa-ev-certs-do-not-grant-immediate-reputation-anymore)
· [SSL.com — Individual Validated Code
Signing](https://www.ssl.com/products/software-integrity/code-signing/iv/)
· [CA/B Forum Code Signing 2026](https://accutivesecurity.com/code-signing-2026/)

Quando hai un certificato, abilitarlo è a due passi:

1. In `src-tauri/tauri.conf.json`, sezione `bundle.windows`, aggiungi:
   ```json
   "windows": {
     "certificateThumbprint": "<THUMBPRINT>",
     "digestAlgorithm": "sha256",
     "timestampUrl": "http://timestamp.digicert.com"
   }
   ```
   (oppure, per firma in cloud, usa `"signCommand": "<comando>"` — con un
   certificato IV la chiave sta su token o cloud HSM, quindi sarà quasi
   sicuramente questa la strada, non il thumbprint di un certificato locale).
2. Sul runner CI, importa il certificato dai GitHub Secrets prima di
   `tauri build`, oppure firma l'artefatto dopo la build con il comando del
   servizio cloud.

Finché non c'è un certificato — cioè, secondo la raccomandazione qui sopra,
ancora per un po' — i passi 1–3 qui sotto **non sono un ripiego: sono il piano
principale**.

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
