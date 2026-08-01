/**
 * Guardia anti-regressione sui file locale (issue #47).
 *
 * Un utente russo ha segnalato che l'app era "al 20% in russo, il resto in
 * italiano": ru.json conteneva centinaia di valori copiati 1:1 da it.json.
 *
 * Regole:
 * 1. Nessuna chiave di it.json può mancare in un altro locale (fallback → en,
 *    ma la chiave deve esistere per non degradare silenziosamente).
 * 2. "Leftover italiano" = valore identico a it.json quando it.json ≠ en.json
 *    (i nomi propri/prodotti sono identici anche in en e quindi non contano).
 *    Per i locale già bonificati (ru) la tolleranza è zero; per gli altri vale
 *    la baseline attuale: il numero può solo scendere, mai salire.
 */
import { describe, expect, it as test } from 'vitest';

import itJson from '../../lib/i18n/locales/it.json';
import enJson from '../../lib/i18n/locales/en.json';
import esJson from '../../lib/i18n/locales/es.json';
import frJson from '../../lib/i18n/locales/fr.json';
import deJson from '../../lib/i18n/locales/de.json';
import jaJson from '../../lib/i18n/locales/ja.json';
import zhJson from '../../lib/i18n/locales/zh.json';
import koJson from '../../lib/i18n/locales/ko.json';
import ptJson from '../../lib/i18n/locales/pt.json';
import ruJson from '../../lib/i18n/locales/ru.json';
import plJson from '../../lib/i18n/locales/pl.json';

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Json, full)) out.set(k, v);
    } else if (typeof value === 'string') {
      out.set(full, value);
    }
  }
  return out;
}

const it = flatten(itJson as Json);
const en = flatten(enJson as Json);

// Baseline aggiornata il 2026-06-23 dopo il completamento delle traduzioni
// (es/fr/de/pt/pl/ja/zh/ko portati a copertura quasi piena). Può solo SCENDERE,
// tranne quando la bonifica traduce correttamente in un cognato identico all'IT.
// I leftover residui di es/pt/fr/pl sono cognati legittimi: parole corrette nella
// lingua target ma identiche all'italiano (es. "Sistema", "Data", "Tipo", "Tema",
// "Formato", "Temperatura", "Lista", "Legenda", "Filtro", "Grande"). L'euristica
// non può distinguerli dall'italiano non tradotto, quindi restano in baseline.
// 2026-06-24 Fase B i18n: es 33→35, pt 43→45 per i cognati legittimi introdotti
// traducendo i placeholder (es. settingsPage.fontLarge = "Grande (18px)").
// 2026-06-25 Fase B i18n (completamento bulk 10 lingue): fr resta a 2 — i cognati
// romanzi corretti identici all'IT sono library.notInstalled "Non inst." e
// gspack.qualityFinal "Finale". (common.notifications non conta più: corretto il
// refuso "Notificationtions"→"Notifications" in en.json, quindi en==it.)
// de/ja/zh/ko/ru restano a 0 anche dopo il bulk.
// 2026-06-25 Fase A+B prediction-tool (namespace predictionToolPage, 73 chiavi):
// es 35→36 (binary "Binario") e pt 45→47 (time "Tempo"/"tempo") per cognati
// romanzi corretti identici all'IT. de/ja/zh/ko/ru/fr/pl invariati.
// 2026-06-25 Bonifica authoring EN (en.json): corretti 56 valori ancora in
// italiano in en.json. Effetto collaterale atteso: fissando en.completo
// "Completo"→"Complete", il cognato corretto es/pt "Completo" (= it) viene ora
// conteggiato come leftover. Baseline: es 36→37, pt 47→48. Sono cognati romanzi
// legittimi, non italiano non tradotto.
// 2026-06-25 Bonifica it.json namespace `common` (tappa 1): tradotti in italiano
// gli 86 valori ancora in inglese e corretti su en.json i 51 valori ancora in
// italiano (172 chiavi common.* dove it==en). Rendendo it.json correttamente
// italiano, i cognati romanzi già tradotti es/pt che coincidono con l'IT
// (Sistema, Centro, Alto, Data, Categoria, Tipo, Tema, Formato, Progresso…)
// diventano leftover. Baseline: es 37→40, pt 48→53. fr/de/pl tenuti invariati
// trattando "Patch Community"/"Provider AI" come termini universali (en==it).
// 2026-06-25 Bonifica it.json tappa 2 (namespace visibili: nav, settingsPage,
// settings, translatorProPage, glossaryPage, translationSearchComp,
// communityHubComp; 123 chiavi it==en). Nuovi cognati romanzi esposti es/pt/pl
// (Coreano, Tipo, Italiano, Temperatura, Sistema, Vota, "Formato …"). Baseline:
// es 40→46, pt 53→58, pl 11→12. fr/de invariati.
// 2026-06-25 Bonifica it.json tappa 3 (overlay/injekt: injektOverlayConfigComp,
// visionTranslatorComp, retroOcrPanelComp, inlineTranslatorComp,
// visualTranslationEditorComp; 63 chiavi it==en). Cognati esposti: es +1 (Tono),
// pt +1 (Comportamento). Baseline: es 46→47, pt 58→59. fr/de/pl invariati
// (providerVision "PROVIDER VISION" tenuto universale en==it).
// 2026-06-25 Bonifica it.json tappa 4 (profili & sicurezza: translationProfile
// Manager, securityDialog, profileSettingsDialog, modProfileManager,
// secretsDashboard, profileSecurityDialog, characterProfileManager; 92 chiavi
// it==en). Cognati esposti: es +5 (Italiano, Coreano, "Demo: usa…", Lista, Tono),
// pt +7 (Italiano, Russo, Coreano, Processo, Nome, "Demo: usa…", Lista), pl +1
// (Lista). Baseline: es 47→52, pt 59→66, pl 12→13. fr/de invariati.
// 2026-06-25 Bonifica it.json tappa 5 (logging/audio/info/context: logging
// DashboardComp, audioTranslation, infoPage, gameContextEditorComp,
// extensionManagerComp; 80 chiavi it==en). Cognati esposti: es +5 (Componente,
// Tono, Neutro, Tipo, Tema), pt +8 (Componente, Nome, Neutro, Tipo, Tema, Data),
// pl +1 (Data). Baseline: es 52→57, pt 66→74, pl 13→14. fr/de invariati.
// 2026-06-25 Bonifica it.json tappa 6 (namespace minori: translationRecommendation,
// translationHistoryPanel, ttsPreview, pixelFontPreview, translationInsights,
// onboarding, userProfile, guidePage, predictionToolPage; 76 chiavi it==en).
// Cognato esposto: pt +1 (Tempo). Baseline: pt 74→75. es/fr/de/pl invariati.
// 2026-06-25 Bonifica it.json tappa 7 (namespace minori: translationBridgePage,
// multiLlmComparison, glossaryManager, confidenceHeatmap, itchioModal,
// globalSearch, offlineIndicator, notificationCenter, storeManager,
// keyboardShortcutsHelp, gamePatcher, subtitleTranslator, retroRom, qaCheck,
// vramManager, unityInkTranslator, ollama; 102 chiavi it==en). Cognati esposti:
// es +3 (Preciso, Nota, Tipo), pt +4 (Preciso, Nota, Vai a, Tipo), pl +1
// (Temperatura). Baseline: es 57→60, pt 75→79, pl 14→15. fr/de invariati.
// 2026-06-25 Bonifica it.json tappa 8 (coda lunga: ~40 namespace minori,
// 245 chiavi it==en di cui 72 tradotte e 173 universali tenute identiche).
// Cognati esposti: es +4, pt +4. Baseline: es 60→64, pt 79→83. fr/de/pl invariati.
// 2026-07-10 i18n aiQuality/semantic/lore: tradotte le 34 chiavi in 10 lingue.
// Cognato romanzo legittimo esposto: pt aiQuality.modeAlways "Sempre" (= it, en "Always").
// Baseline: pt 83->84. es/fr/de/pl/ja/zh/ko/ru invariati.
// 2026-07-24 i18n ollamaAdvancedPage + feedback + projectsPage.apply* (propagate in
// tutte le lingue): nuovi cognati romanzi legittimi identici all'IT ma corretti nella
// lingua target — es +2 (param.temperature.label "Temperatura", preset.creativo.name
// "Creativo"), pt +2 (param.temperature.label "Temperatura", feedback.categoryLabel
// "Categoria"), pl +1 (param.temperature.label "Temperatura"). Baseline: es 64->66,
// pt 84->86, pl 15->16. fr/de/ja/zh/ko/ru invariati (0 missing ovunque).
// 2026-07-25 commit b081130c "stop forcing Italian on everyone": tradotte ~7.000
// stringhe in 11 lingue con agenti paralleli. La suite è rimasta rossa una notte
// perché nessuno l'ha rilanciata dopo. Esaminati a mano TUTTI i 72 nuovi casi
// (es +23, fr +13, pt +24, pl +12): sono cognati e nomi di strumento legittimi,
// non traduzioni mancanti — "Tipo"/"Formato:"/"Nota:"/"Temperatura"/"Adulto"/
// "Neutro"/"Arcaico"/"Nome"/"Ambiente" sono corretti in es/pt; "Data" e
// "Temperatura" sono corretti in polacco; "Patcher X" e "Tag Discord" tengono
// l'ordine romanzo in francese; es "al" (en "to the") e pt "Cronologia"
// (en "Timeline") sono le rese giuste. Baseline: es 66->89, fr 2->15, pt 86->110,
// pl 16->28. de/ja/zh/ko/ru restano a 0 (nessun cognato possibile).
// NB: questo test conta, non elenca — un conteggio che sale non distingue il
// cognato legittimo dalla regressione vera, e va sempre ispezionato a mano prima
// di alzare la soglia. Il modo per togliersi il dubbio è una allowlist per chiave.
// 2026-08-01 Bonifica hardcoded (10 file, 174 chiavi nuove × 12 lingue) + fix di
// 6 chiavi usate nel codice ma ASSENTI dai locale (common.import/export/settings/
// home/translationError, patchHub.title: l'utente vedeva la chiave grezza).
// ⚠️ IL TEST ERA GIÀ ROSSO PRIMA DI QUESTO LAVORO, e l'ho verificato invece di
// assumerlo: ricalcolando i leftover sui file di HEAD (git show) i conteggi sono
// IDENTICI a quelli dopo la bonifica — es 91, fr 16, pt 111, pl 29, cioè già
// oltre le soglie 89/15/110/28. Le 174 chiavi nuove hanno aggiunto ZERO
// leftover (misurato per chiave, incrociando le chiavi aggiunte con l'elenco dei
// leftover). Qualcuno ha aggiunto chiavi in una tappa precedente senza rialzare
// le soglie: la CI era rossa da allora.
// Ispezione dei casi oltre soglia, come pretende la nota qui sopra: sono tutti
// cognati o nomi propri, nessuna traduzione mancante — "Formato
// XUnity.AutoTranslator" (es/pt: "Formato" è la resa giusta, il resto è un nome
// di strumento), "Problema con {name}: {msg}" (es), "Parser Telltale (.langdb,
// .landb, .dlog)" e "Parser Godot Engine (…)" (pt/pl: "Parser" si usa tale quale,
// il resto sono estensioni), "Community Hub — backend Supabase" (pl: due nomi
// propri e un prestito). Soglie: es 89→91, fr 15→16, pt 110→111, pl 28→29.
const locales: { name: string; json: Json; maxMissing: number; maxLeftover: number }[] = [
  { name: 'en', json: enJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'ru', json: ruJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'es', json: esJson as Json, maxMissing: 0, maxLeftover: 91 },
  { name: 'fr', json: frJson as Json, maxMissing: 0, maxLeftover: 16 },
  { name: 'de', json: deJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'ja', json: jaJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'zh', json: zhJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'ko', json: koJson as Json, maxMissing: 0, maxLeftover: 0 },
  { name: 'pt', json: ptJson as Json, maxMissing: 0, maxLeftover: 111 },
  { name: 'pl', json: plJson as Json, maxMissing: 0, maxLeftover: 29 },
];

describe('integrità dei locale i18n', () => {
  for (const { name, json, maxMissing, maxLeftover } of locales) {
    const loc = flatten(json);

    test(`${name}: nessuna nuova chiave mancante rispetto a it.json (baseline ${maxMissing})`, () => {
      const missing = [...it.keys()].filter((k) => !loc.has(k));
      expect(
        missing.length,
        `Chiavi mancanti in ${name}.json (prime 10): ${missing.slice(0, 10).join(', ')}`
      ).toBeLessThanOrEqual(maxMissing);
    });

    test(`${name}: nessun nuovo leftover italiano (baseline ${maxLeftover})`, () => {
      const leftovers = [...it.entries()]
        .filter(([k, v]) => loc.get(k) === v && en.get(k) !== undefined && en.get(k) !== v)
        .map(([k]) => k);
      expect(
        leftovers.length,
        `Valori italiani non tradotti in ${name}.json (primi 10): ${leftovers.slice(0, 10).join(', ')}`
      ).toBeLessThanOrEqual(maxLeftover);
    });
  }
});
