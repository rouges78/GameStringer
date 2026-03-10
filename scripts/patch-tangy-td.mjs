#!/usr/bin/env node
/**
 * Tangy TD — Binary String Patcher
 * 
 * Estrae stringhe EN dal .exe, le traduce in IT, e crea una copia patchata.
 * REGOLA CRITICA: ogni traduzione deve avere ESATTAMENTE la stessa lunghezza in byte.
 * 
 * Uso:
 *   node scripts/patch-tangy-td.mjs extract    → estrae stringhe e salva JSON
 *   node scripts/patch-tangy-td.mjs translate  → traduce EN→IT (richiede API key OpenAI)
 *   node scripts/patch-tangy-td.mjs patch      → applica patch al .exe (crea copia)
 *   node scripts/patch-tangy-td.mjs all        → tutto in un colpo
 */

import fs from 'fs';
import path from 'path';

const GAME_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Tangy TD';
const EXE_NAME = 'TangyTD.exe';
const EXE_PATH = path.join(GAME_DIR, EXE_NAME);
const PATCH_DIR = path.resolve('patches/tangy-td');
const STRINGS_FILE = path.join(PATCH_DIR, 'strings-en.json');
const TRANSLATED_FILE = path.join(PATCH_DIR, 'strings-it.json');
const PATCHED_EXE = path.join(PATCH_DIR, `TangyTD_IT.exe`);

// ============================================================
// FASE 1: Estrazione stringhe dal binario
// ============================================================
function extractStrings() {
  console.log('📦 Leggendo', EXE_PATH);
  const buf = fs.readFileSync(EXE_PATH);
  console.log(`   Dimensione: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  const strings = [];
  let i = 0;
  while (i < buf.length) {
    const start = i;
    let s = '';
    while (i < buf.length && buf[i] >= 0x20 && buf[i] <= 0x7E) {
      s += String.fromCharCode(buf[i]);
      i++;
    }
    if (s.length >= 8 && /[a-z]{3,}/.test(s) && /\s/.test(s)) {
      // Filtra noise: engine, debug, librerie
      const noise = /Failed|Error$|assert|Cannot|shader|Shader|compile|Compil|buffer|Buffer|Window|monitor|clock|DLL|\.dll|DXGI|stderr|printf|malloc|fopen|Sound_|file_|FontLoader|Atlas|GridCoord|Entering|Starting|Enumerating|implement|supplied|sample rate|channels|propper|bytes from|write as many|image type|pixel image|Descriptor|interlace|bit depth|tRNS|IHDR|Corrupt|bad PNG|outofmem|bad comp|bad filter|bad zlib|huffman|bad sizes|oversimple|not enough|too large|bad code|Assertion|Runtime|Visual C|documentation|JIT must|0x%|JFIF|Adobe|api-ms|GetProc|kernel32|__IMPORT|framebuffer|AdjustWindow|AppPolicy/;
      if (!noise.test(s)) {
        strings.push({ offset: start, len: s.length, en: s });
      }
    }
    i++;
  }

  fs.mkdirSync(PATCH_DIR, { recursive: true });
  fs.writeFileSync(STRINGS_FILE, JSON.stringify(strings, null, 2));
  console.log(`✅ Estratte ${strings.length} stringhe → ${STRINGS_FILE}`);
  return strings;
}

// ============================================================
// FASE 2: Traduzione EN→IT (stessa lunghezza byte)
// ============================================================

// Dizionario completo traduzioni EN→IT per Tangy TD
// Le traduzioni vengono adattate automaticamente alla lunghezza originale
const GAME_DICT = {
  // === UI / Menu ===
  'Save & Quit': 'Salva&Esci',
  'Against The Clock': 'Contro il Tempo   ',
  // === Eroi ===
  'Orange Tree': 'Albero Aranc',
  'Specializes in melee combat and blocking enemies from progressing.': 'Specializzato nel combattimento ravvicinato e nel bloccare i nemici.  ',
  'Archer ready to shoot at enemies from a distance.': 'Arciere pronto a colpire i nemici dalla distanza.',
  'Can {g,heal} other Heroes,': 'Puo {g,curare} gli Eroi, ',
  'can also attack using {b,Lightning} damage.': 'puo anche attaccare con danni {b,Fulmine}. ',
  'Specializes in ranged combat using {r,Fire} and {B,Cold} spells that deal': 'Specializzato nel combattimento a distanza con magie di {r,Fuoco} e {B,Gelo}',
  '{b,Magic Damage} which ignores {G,Armor}.': '{b,Danno Magico} che ignora {G,Armatura}. ',
  'Fragile tree that generates {o,Oranges} that are needed to summon Heroes and buy Upgrades.': 'Albero fragile che genera {o,Arance} necessarie per evocare Eroi e comprare Potenziamenti.',
  'Tangy uses her magic and {o,Oranges} to summon little Heroes to defend her.': 'Tangy usa la magia e le {o,Arance} per evocare piccoli Eroi a difenderla.  ',
  // === Nemici - Pipistrelli ===
  'Vile winged creatures that can fly past Defenders.': 'Creature alate immonde che possono volare oltre i Difensori.',
  'Bloodthirsty creatures that heal by inflicting bleeding.': 'Creature assetate di sangue che si curano infliggendo emorragia.',
  '{b,Immune to Cold Damage}': '{b,Immune al Danno Gelo}  ',
  'Aggressive winged creatures that can fly past Defenders and attack anything in their path.': 'Creature alate aggressive che volano oltre i Difensori e attaccano tutto sul loro cammino.',
  'Flying mischievous creatures that are very difficult to take down.': 'Creature volanti dispettose molto difficili da abbattere.          ',
  'Giant flying tentacle monster that chills all nearby enemies.': 'Mostro volante tentacolare che gela tutti i nemici vicini.  ',
  // === Nemici - Ratti ===
  'Vicious Rat': 'Ratto Feroce',
  'Silver Rat': 'Ratto Argent',
  'Golden Rat': 'Ratto d\'Oro',
  'Undead Rat': 'Ratto Morto',
  'Much tougher than normal Rats. They drop Chests when defeated!': 'Molto piu robusti dei Ratti normali. Rilasciano Forzieri!  ',
  'Undead, poisonous rodents with sharp teeth.': 'Roditori non-morti e velenosi con denti affilati.',
  // === Nemici - Goblin ===
  'Goblin Archer': 'Goblin Arciere',
  'Goblin Blocker': 'Goblin Scudato ',
  'Tough evil humanoids that attack anything in their path.': 'Umanoidi malvagi coriacei che attaccano tutto sul loro cammino.',
  'Very Tough and resilient evil humanoids that attack anything in their path.': 'Umanoidi malvagi molto resistenti che attaccano qualsiasi cosa sul loro cammino.',
  'Evil humanoids equiped with a bow that focus weak targets.': 'Umanoidi malvagi con arco che prendono di mira i bersagli deboli.',
  'Evil Shaman that heals nearby allies and shoots deadly Fireballs.': 'Sciamano malvagio che cura gli alleati vicini e lancia Palle di Fuoco.',
  'Tough evil humanoids that can block attacks.': 'Umanoidi malvagi coriacei che bloccano attacchi.',
  // === Nemici - Boss ===
  'Tough knight that can\'t be stunned or pushed back. His heavy Hammer stuns briefly on hit.': 'Cavaliere coriaceo immune allo stordimento. Il suo Martello pesante stordisce al colpo.',
  'Very tough warriors that can regenerate health.': 'Guerrieri molto resistenti che rigenerano salute.',
  'Icy creature that freezes nearby enemies.': 'Creatura di ghiaccio che gela i nemici vicini.',
  'Very tough poisonous monster made out of wood and grass.': 'Mostro velenoso molto resistente fatto di legno e di erba. ',
  // === Statistiche ===
  'Ability Duration': 'Durata Abilita  ',
  'Ability Effect Duration': 'Durata Effetto Abilita ',
  'Attack Speed': 'Vel. Attacco ',
  'Attack Range': 'Gittata Att. ',
  'Attack Damage': 'Danni Attacco',
  'Movement Speed': 'Vel. Movimento ',
  'Heal Amount': 'Quantita Cura',
  'Block Chance': 'Prob. Blocco ',
  'Dodge Chance': 'Prob. Schivata',
  'Bleed Chance': 'Prob. Sanguin.',
  'Stun Chance': 'Prob. Stordim',
  'Freeze Chance': 'Prob. Congel. ',
  'Poison Chance': 'Prob. Veleno  ',
  'Critical Chance': 'Prob. Critico   ',
  'Splash Damage': 'Danno ad Area ',
  'Splash Radius': 'Raggio Impatto',
  'Gold Bonus': 'Bonus Oro  ',
  'Acceleration': 'Accelerazione',
  // === Abilita ed effetti ===
  '{y,Every third attack causes an explosion.}': '{y,Ogni terzo attacco causa un\'esplosione.} ',
  // === Descrizioni lunghe meccaniche ===
  'Chance to block incomming {y,Hits}. {y,Ground Effects} are usually not considered a {y,Hit}.': 'Prob. di bloccare {y,Colpi} in arrivo. Gli {y,Effetti a Terra} non sono considerati {y,Colpi}.',
  'By defeating Enemies, {y,Tangy} gains {g,Skillpoints}. Spend them to grow more powerful!': 'Sconfiggendo i Nemici, {y,Tangy} ottiene {g,Punti Abilita}. Usali per potenziarti! ',
  'Climb the {y,leaderboard} by fighting through infinite waves to see how long you can last!': 'Scala la {y,classifica} combattendo ondate infinite per vedere quanto a lungo resisti!  ',
};

/** Adatta la traduzione alla lunghezza target (pad con spazi o tronca) */
function fitToLength(translated, targetLen) {
  const buf = Buffer.from(translated, 'utf8');
  if (buf.length === targetLen) return translated;
  if (buf.length < targetLen) {
    // Pad con spazi fino alla lunghezza giusta
    const padded = Buffer.alloc(targetLen, 0x20); // spazi
    buf.copy(padded);
    return padded.toString('utf8');
  }
  // Tronca mantenendo UTF-8 valido
  let truncated = Buffer.alloc(targetLen);
  buf.copy(truncated, 0, 0, targetLen);
  // Assicurati che non ci siano byte UTF-8 troncati a metà
  let end = targetLen;
  while (end > 0 && (truncated[end - 1] & 0xC0) === 0x80) end--;
  if (end > 0 && (truncated[end - 1] & 0x80) !== 0) end--;
  if (end < targetLen) {
    for (let j = end; j < targetLen; j++) truncated[j] = 0x20;
  }
  return truncated.toString('utf8');
}

async function translateStrings() {
  if (!fs.existsSync(STRINGS_FILE)) {
    console.log('⚠️  Esegui prima: node scripts/patch-tangy-td.mjs extract');
    return;
  }

  const strings = JSON.parse(fs.readFileSync(STRINGS_FILE, 'utf8'));
  console.log(`🌍 Traduzione di ${strings.length} stringhe EN→IT...`);

  // Prima passa: applica dizionario
  let dictHits = 0;
  for (const s of strings) {
    if (GAME_DICT[s.en]) {
      s.it = fitToLength(GAME_DICT[s.en], s.len);
      dictHits++;
    }
  }
  console.log(`   📖 Dizionario: ${dictHits} stringhe tradotte`);

  // Seconda passa: traduzione AI per le restanti (batch)
  const untranslated = strings.filter(s => !s.it);
  console.log(`   🤖 AI: ${untranslated.length} stringhe da tradurre`);

  // Controlla se c'è una API key OpenAI
  const apiKey = process.env.OPENAI_API_KEY || '';
  
  if (apiKey) {
    // Traduci in batch di 20 stringhe
    const BATCH_SIZE = 20;
    for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
      const batch = untranslated.slice(i, i + BATCH_SIZE);
      const prompt = `Translate these game strings from English to Italian. 
CRITICAL: Each translation MUST be EXACTLY the same number of characters as the original (pad with spaces if shorter, abbreviate if longer).
Preserve any formatting tags like {r,text}, {b,text}, {g,text}, {o,text}, {G,text}, {B,text}, [h-2] etc.
Return ONLY a JSON array of translated strings, one per input line.

${batch.map((s, idx) => `${idx}. [${s.len} chars] "${s.en}"`).join('\n')}`;

      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          })
        });
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        // Estrai array JSON dalla risposta
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const translations = JSON.parse(jsonMatch[0]);
          for (let j = 0; j < batch.length && j < translations.length; j++) {
            batch[j].it = fitToLength(String(translations[j]), batch[j].len);
          }
        }
      } catch (e) {
        console.warn(`   ⚠️  Batch ${i / BATCH_SIZE + 1} fallito:`, e.message);
      }
      // Rate limit
      if (i + BATCH_SIZE < untranslated.length) {
        process.stdout.write(`   Progresso: ${Math.min(i + BATCH_SIZE, untranslated.length)}/${untranslated.length}\r`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    console.log(`   ✅ Traduzione AI completata`);
  } else {
    console.log('   ⚠️  OPENAI_API_KEY non trovata. Uso traduzione placeholder.');
    console.log('   💡 Imposta: set OPENAI_API_KEY=sk-...');
    // Placeholder: copia originale (almeno il patcher funziona)
    for (const s of untranslated) {
      if (!s.it) s.it = s.en; // Mantieni originale come placeholder
    }
  }

  // Verifica lunghezze
  let mismatch = 0;
  for (const s of strings) {
    if (!s.it) s.it = s.en;
    const itBuf = Buffer.from(s.it, 'utf8');
    if (itBuf.length !== s.len) {
      s.it = fitToLength(s.it, s.len);
      mismatch++;
    }
  }
  if (mismatch > 0) console.log(`   🔧 Corrette ${mismatch} lunghezze`);

  fs.writeFileSync(TRANSLATED_FILE, JSON.stringify(strings, null, 2));
  console.log(`✅ Salvate ${strings.length} traduzioni → ${TRANSLATED_FILE}`);
}

// ============================================================
// FASE 3: Applica patch al binario
// ============================================================
function applyPatch() {
  if (!fs.existsSync(TRANSLATED_FILE)) {
    console.log('⚠️  Esegui prima: node scripts/patch-tangy-td.mjs translate');
    return;
  }

  const strings = JSON.parse(fs.readFileSync(TRANSLATED_FILE, 'utf8'));
  console.log(`🔧 Applicando ${strings.length} patch a ${EXE_NAME}...`);

  // Copia l'exe originale
  const buf = Buffer.from(fs.readFileSync(EXE_PATH));
  
  let patched = 0;
  let skipped = 0;
  for (const s of strings) {
    if (!s.it || s.it === s.en) { skipped++; continue; }
    
    const itBuf = Buffer.from(s.it, 'utf8');
    if (itBuf.length !== s.len) {
      console.warn(`   ⚠️  Skip offset ${s.offset}: lunghezza IT (${itBuf.length}) ≠ EN (${s.len})`);
      skipped++;
      continue;
    }
    
    // Verifica che l'originale corrisponda
    const originalInBin = buf.toString('utf8', s.offset, s.offset + s.len);
    if (originalInBin !== s.en) {
      console.warn(`   ⚠️  Skip offset ${s.offset}: binario non corrisponde`);
      skipped++;
      continue;
    }
    
    // Scrivi la traduzione
    itBuf.copy(buf, s.offset);
    patched++;
  }

  fs.mkdirSync(path.dirname(PATCHED_EXE), { recursive: true });
  fs.writeFileSync(PATCHED_EXE, buf);
  
  console.log(`✅ Patch completata!`);
  console.log(`   📝 Patchate: ${patched} stringhe`);
  console.log(`   ⏭️  Saltate: ${skipped} (non tradotte o invariate)`);
  console.log(`   📁 Output: ${PATCHED_EXE}`);
  console.log(`\n📋 Per installare:`);
  console.log(`   1. Backup: copia ${EXE_NAME} → ${EXE_NAME}.bak`);
  console.log(`   2. Copia ${PATCHED_EXE} → ${path.join(GAME_DIR, EXE_NAME)}`);
}

// ============================================================
// Main
// ============================================================
const cmd = process.argv[2] || 'all';

console.log('🎮 Tangy TD — Binary String Patcher');
console.log('====================================\n');

if (cmd === 'extract' || cmd === 'all') {
  extractStrings();
}
if (cmd === 'translate' || cmd === 'all') {
  await translateStrings();
}
if (cmd === 'patch' || cmd === 'all') {
  applyPatch();
}
