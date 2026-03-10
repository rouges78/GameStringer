#!/usr/bin/env node
/**
 * Tangy TD — Patch ES→IT
 * 
 * Sovrascrive le stringhe spagnole con traduzioni italiane.
 * Vantaggio: ES e IT hanno lunghezze simili, traduzioni naturali.
 * 
 * Uso:
 *   node scripts/patch-tangy-td-es-it.mjs
 */

import fs from 'fs';
import path from 'path';

const GAME_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Tangy TD';
const EXE_PATH = path.join(GAME_DIR, 'TangyTD.exe');
const ES_FILE = path.resolve('patches/tangy-td/strings-es.json');
const PATCH_DIR = path.resolve('patches/tangy-td');
const PATCHED_EXE = path.join(PATCH_DIR, 'TangyTD_IT.exe');

// ============================================================
// Dizionario sostituzione parole/frasi ES→IT
// Usato per traduzione automatica rule-based
// ============================================================
const WORD_MAP = [
  // === Frasi intere comuni ===
  [/\{b,inmunes al Daño de Frío\}/g, '{b,immuni al Danno da Gelo}'],
  [/\{b,Inmunes al Daño de Frío\}/g, '{b,Immuni al Danno da Gelo}'],
  [/\{b,Inmune al Daño de Frío\}/g, '{b,Immune al Danno da Gelo}'],
  [/\{b,Daño Mágico\}/g, '{b,Danno Magico}'],
  [/\{G,Armadura\}/g, '{G,Armatura}'],
  [/\{G,Daño Físico\}/g, '{G,Danno Fisico}'],
  [/\{r,Fuego\}/g, '{r,Fuoco}'],
  [/\{B,Frío\}/g, '{B,Gelo}'],
  [/\{b,Rayo\}/g, '{b,Fulmine}'],
  [/\{g,Veneno\}/g, '{g,Veleno}'],
  [/\{o,Naranjas\}/g, '{o,Arance}'],
  [/\{g,curar\}/g, '{g,curare}'],
  [/\{g,Sanadora\}/g, '{g,Guaritrice}'],
  [/\{g,Heilerin\}/g, '{g,Guaritrice}'],
  [/\{r,Ignoran a los Defensores\}/g, '{r,Ignorano i Difensori}'],
  [/\{y,Proyectil\}/g, '{y,Proiettile}'],
  [/\{y,Habilidad\}/g, '{y,Abilità}'],
  [/\{y,Habilidades\}/g, '{y,Abilità}'],
  [/\{y,Efectos\}/g, '{y,Effetti}'],
  [/\{y,Daño\}/g, '{y,Danno}'],
  [/\{y,Tangy\}/g, '{y,Tangy}'],
  [/\{y,clasificación\}/g, '{y,classifica}'],
  [/\{g,Puntos de Habilidad\}/g, '{g,Punti Abilità}'],
  [/\{y,Objetivos\}/g, '{y,Bersagli}'],
  [/\{y,Ataques de Área\}/g, '{y,Attacchi ad Area}'],
  
  // === Nomi propri / Unità ===
  [/Murciélago/g, 'Pipistrello'],
  [/murciélago/g, 'pipistrello'],
  [/Árbol Tangy/g, 'Albero Tangy'],
  [/Árbol frágil/g, 'Albero fragile'],
  [/Arquero/g, 'Arciere'],
  [/arquero/g, 'arciere'],
  [/Esqueleto/g, 'Scheletro'],
  [/esqueleto/g, 'scheletro'],
  [/esqueletos/g, 'scheletri'],
  [/Chamán/g, 'Sciamano'],
  [/chamán/g, 'sciamano'],
  [/Nigromante/g, 'Negromante'],
  [/Albóndiga/g, 'Polpetta'],
  [/Golem/g, 'Golem'],
  [/Caballero/g, 'Cavaliere'],

  // === Sostantivi ===
  [/enemigos/g, 'nemici'],
  [/enemigo/g, 'nemico'],
  [/Enemigos/g, 'Nemici'],
  [/Enemigo/g, 'Nemico'],
  [/Defensores/g, 'Difensori'],
  [/Defensor/g, 'Difensore'],
  [/Héroes/g, 'Eroi'],
  [/Héroe/g, 'Eroe'],
  [/héroes/g, 'eroi'],
  [/héroe/g, 'eroe'],
  [/Criaturas/g, 'Creature'],
  [/criaturas/g, 'creature'],
  [/Criatura/g, 'Creatura'],
  [/criatura/g, 'creatura'],
  [/aliados/g, 'alleati'],
  [/aliado/g, 'alleato'],
  [/guerrero/g, 'guerriero'],
  [/guerreros/g, 'guerrieri'],
  [/Guerrero/g, 'Guerriero'],
  [/objetivos/g, 'bersagli'],
  [/objetivo/g, 'bersaglio'],
  [/monstruo/g, 'mostro'],
  [/Monstruo/g, 'Mostro'],
  [/monstruos/g, 'mostri'],
  [/cofres/g, 'forzieri'],
  [/Cofres/g, 'Forzieri'],
  [/Roedores/g, 'Roditori'],
  [/roedores/g, 'roditori'],
  [/dientes/g, 'denti'],
  [/garras/g, 'artigli'],
  [/Proyectil/g, 'Proiettile'],
  [/proyectil/g, 'proiettile'],
  [/Proyectiles/g, 'Proiettili'],
  [/proyectiles/g, 'proiettili'],
  [/hechizos/g, 'incantesimi'],
  [/hechizo/g, 'incantesimo'],
  [/escudo/g, 'scudo'],
  [/Escudo/g, 'Scudo'],
  [/espada/g, 'spada'],
  [/Espada/g, 'Spada'],
  [/arco/g, 'arco'],
  [/nivel/g, 'livello'],
  [/Nivel/g, 'Livello'],
  [/ronda/g, 'ondata'],
  [/Ronda/g, 'Ondata'],
  [/mejora/g, 'miglioram.'],
  [/Mejora/g, 'Miglioram.'],
  [/mejoras/g, 'migliorie'],
  [/tienda/g, 'negozio'],
  [/Tienda/g, 'Negozio'],
  [/veneno/g, 'veleno'],
  [/Veneno/g, 'Veleno'],
  [/fuego/g, 'fuoco'],
  [/Fuego/g, 'Fuoco'],
  [/hielo/g, 'ghiaccio'],
  [/Hielo/g, 'Ghiaccio'],
  [/daño/g, 'danno'],
  [/Daño/g, 'Danno'],
  [/Frío/g, 'Gelo'],
  [/frío/g, 'gelo'],
  [/Rayo/g, 'Fulmine'],
  [/rayo/g, 'fulmine'],
  [/Escarcha/g, 'Brina'],
  [/escarcha/g, 'brina'],
  [/Sangrado/g, 'Emorragia'],
  [/sangrado/g, 'emorragia'],
  [/hemorragias/g, 'emorragie'],
  [/hemorragia/g, 'emorragia'],
  [/Aturdimiento/g, 'Stordimento'],
  [/aturdimiento/g, 'stordimento'],
  [/aturdiendo/g, 'stordendo'],
  [/Congelación/g, 'Congelamento'],
  [/congelación/g, 'congelamento'],
  [/armadura/g, 'armatura'],
  [/Armadura/g, 'Armatura'],
  [/salud/g, 'salute'],
  [/Salud/g, 'Salute'],
  [/oro/g, 'oro'],
  [/magia/g, 'magia'],
  [/Magia/g, 'Magia'],

  // === Verbi ===
  [/atacar/g, 'attaccare'],
  [/Atacar/g, 'Attaccare'],
  [/ataca/g, 'attacca'],
  [/atacan/g, 'attaccano'],
  [/atacando/g, 'attaccando'],
  [/ataques/g, 'attacchi'],
  [/ataque/g, 'attacco'],
  [/Ataque/g, 'Attacco'],
  [/dispara/g, 'spara'],
  [/Dispara/g, 'Spara'],
  [/disparar/g, 'sparare'],
  [/curar/g, 'curare'],
  [/cura /g, 'cura '],
  [/curan/g, 'curano'],
  [/invoca/g, 'evoca'],
  [/Invoca/g, 'Evoca'],
  [/invocar/g, 'evocare'],
  [/aumenta/g, 'aumenta'],
  [/reduce/g, 'riduce'],
  [/Reduce/g, 'Riduce'],
  [/infligir/g, 'infliggere'],
  [/inflige/g, 'infligge'],
  [/infligiendo/g, 'infliggendo'],
  [/bloquear/g, 'bloccare'],
  [/bloquea/g, 'blocca'],
  [/Bloqueo/g, 'Blocco'],
  [/derrotar/g, 'sconfiggere'],
  [/derrota/g, 'sconfigge'],
  [/derrotarlas/g, 'sconfiggerle'],
  [/Derrotando/g, 'Sconfiggendo'],
  [/derrotando/g, 'sconfiggendo'],
  [/provocando/g, 'provocando'],
  [/genera/g, 'genera'],
  [/lanza/g, 'lancia'],
  [/Lanza/g, 'Lancia'],
  [/Golpea/g, 'Colpisce'],
  [/golpea/g, 'colpisce'],
  [/obedecen/g, 'obbediscono'],
  [/Reviven/g, 'Risorgono'],
  [/reviven/g, 'risorgono'],
  [/morir/g, 'morire'],
  [/mueren/g, 'muoiono'],
  [/resistir/g, 'resistere'],
  [/esquivar/g, 'schivare'],
  [/sueltan/g, 'rilasciano'],
  [/congelan/g, 'congelano'],
  [/congela /g, 'congela '],
  [/aplica/g, 'applica'],
  [/Aplica/g, 'Applica'],
  [/desgarran/g, 'squarciano'],
  [/Convierte/g, 'Converte'],
  [/convierte/g, 'converte'],
  [/regresan/g, 'ritornano'],
  [/obtiene/g, 'ottiene'],
  [/obtienen/g, 'ottengono'],
  [/Marca/g, 'Segna'],
  [/reciban/g, 'subiscano'],

  // === Aggettivi ===
  [/cercanos/g, 'vicini'],
  [/cercano/g, 'vicino'],
  [/lejanos/g, 'lontani'],
  [/lejano/g, 'lontano'],
  [/afilados/g, 'affilati'],
  [/afilado/g, 'affilato'],
  [/afiladas/g, 'affilate'],
  [/venenosos/g, 'velenosi'],
  [/venenoso/g, 'velenoso'],
  [/muertos/g, 'morti'],
  [/muerto/g, 'morto'],
  [/malvado/g, 'malvagio'],
  [/malvados/g, 'malvagi'],
  [/resistentes/g, 'resistenti'],
  [/resistente/g, 'resistente'],
  [/repugnantes/g, 'ripugnanti'],
  [/sanguinarias/g, 'sanguinarie'],
  [/agresivas/g, 'aggressive'],
  [/feroces/g, 'feroci'],
  [/feroz/g, 'feroce'],
  [/rápidos/g, 'rapidi'],
  [/rápido/g, 'rapido'],
  [/rápidas/g, 'rapide'],
  [/letales/g, 'letali'],
  [/letal/g, 'letale'],
  [/aladas/g, 'alate'],
  [/voladoras/g, 'volanti'],
  [/volador/g, 'volante'],
  [/traviesas/g, 'birichine'],
  [/enormes/g, 'enormi'],
  [/pequeños/g, 'piccoli'],
  [/frágil/g, 'fragile'],
  [/necesarias/g, 'necessarie'],
  [/inmunes/g, 'immuni'],
  [/inmune/g, 'immune'],
  [/Inmunes/g, 'Immuni'],
  [/Inmune/g, 'Immune'],

  // === Preposizioni / Articoli / Congiunzioni ===
  [/ los /g, ' i '],
  [/ las /g, ' le '],
  [/ del /g, ' del '],
  [/ de la /g, ' della '],
  [/ de los /g, ' dei '],
  [/ de las /g, ' delle '],
  [/ que /g, ' che '],
  [/ con /g, ' con '],
  [/ por /g, ' per '],
  [/ para /g, ' per '],
  [/ una /g, ' una '],
  [/ un /g, ' un '],
  [/ y /g, ' e '],
  [/ o /g, ' o '],
  [/ a /g, ' a '],
  [/ en /g, ' in '],
  [/ su /g, ' il suo '],
  [/ sus /g, ' i suoi '],
  [/ al /g, ' al '],
  [/ todos /g, ' tutti '],
  [/ todas /g, ' tutte '],
  [/ todo /g, ' tutto '],
  [/ puede /g, ' può '],
  [/ pueden /g, ' possono '],
  [/ también /g, ' anche '],
  [/ usando /g, ' usando '],
  [/ cuando /g, ' quando '],
  [/ mientras /g, ' mentre '],
  [/ sobre /g, ' sopra '],
  [/ entre /g, ' tra '],
  [/ desde /g, ' da '],
  [/ hasta /g, ' fino a '],
  [/ otro /g, ' altro '],
  [/ otra /g, ' altra '],
  [/ otros /g, ' altri '],
  [/ más /g, ' più '],
  [/ muy /g, ' molto '],
  [/ pero /g, ' ma '],
  [/ sin /g, ' senza '],
  [/ cada /g, ' ogni '],
  [/ se /g, ' si '],
  
  // === Frasi intere specifiche (applicate PRIMA delle parole singole) ===
  [/Se especializa en el combate cuerpo a cuerpo/g, 'Specializzato nel combattimento corpo a corpo'],
  [/Se especializa en el combate a distancia/g, 'Specializzato nel combattimento a distanza'],
  [/impedir que los enemigos avancen/g, 'impedire ai nemici di avanzare'],
  [/listo para disparar a los enemigos desde la distancia/g, 'pronto a sparare ai nemici dalla distanza'],
  [/combate a distancia/g, 'combattimento a distanza'],
  [/bolas de fuego/g, 'palle di fuoco'],
  [/no muertos/g, 'non-morti'],
  [/Autómatas sin mente/g, 'Automi senza mente'],
  [/Humanoides sin mente/g, 'Umanoidi senza mente'],
  [/sedientos de sangre/g, 'assetati di sangue'],
  [/Platziere einen Verteidiger/g, 'Piazza un Difensore'],
  [/que son muy/g, 'che sono molto'],
  [/que se interponga en su camino/g, 'che si trova sul loro cammino'],
  [/cualquier cosa/g, 'qualsiasi cosa'],
  [/Adaptadas al/g, 'Adattate al'],
  [/Mucho más resistentes que las ratas normales/g, 'Molto piu resistenti dei ratti normali'],
  [/con tentáculos/g, 'con tentacoli'],
  [/Casi nada puede dañar a esta monstruosidad/g, 'Quasi nulla puo danneggiare questa mostruosita'],
  [/a excepción del/g, 'ad eccezione del'],
  [/Enterrados bajo tierra/g, 'Sepolti sottoterra'],
  [/solo se revelan cuando atacan/g, 'si rivelano solo quando attaccano'],
  [/a sus desprevenidas presas/g, 'le loro prede ignare'],
  [/obedecen sus órdenes/g, 'obbediscono ai suoi ordini'],
  [/un ejército de/g, 'un esercito di'],
  [/incluso las armaduras más resistentes/g, 'anche le armature piu resistenti'],
  [/desgarran incluso/g, 'squarciano anche'],
  [/Su agilidad les permite esquivar ataques cuerpo a cuerpo/g, 'La loro agilita gli permette di schivare attacchi corpo a corpo'],
  [/que desgarran la piel/g, 'che squarciano la pelle'],
  [/equipadas con enormes y afilados dientes/g, 'dotate di enormi e affilati denti'],
  [/Puede atacar a enemigos translúcidos\/enterrados/g, 'Puo attaccare nemici traslucidi/sepolti'],
  [/Los proyectiles regresan al Héroe/g, 'I proiettili ritornano all Eroe'],
  [/Cada vez que Tangy levanta con éxito a/g, 'Ogni volta che Tangy solleva con successo'],
  [/Los Héroes levantados obtienen/g, 'Gli Eroi sollevati ottengono'],
  [/Marca los objetivos principales que Tangy está atacando/g, 'Segna i bersagli principali che Tangy sta attaccando'],
  [/haciendo que reciban/g, 'facendo che subiscano'],
  [/Convierte todo el daño en/g, 'Converte tutto il danno in'],

  // === Parole singole mancanti ===
  [/también/g, 'anche'],
  [/También/g, 'Anche'],
  [/sobrevolar/g, 'sorvolare'],
  [/utilizando/g, 'utilizzando'],
  [/Colosal/g, 'Colossale'],
  [/colosal/g, 'colossale'],
  [/difíciles/g, 'difficili'],
  [/Desatada/g, 'Scatenata'],
  [/desatada/g, 'scatenata'],
  [/Desatado/g, 'Scatenato'],
  [/suelo/g, 'suolo'],
  [/capaz de/g, 'capace di'],
  [/Feroz/g, 'Feroce'],
  [/piel/g, 'pelle'],
  [/muerte/g, 'morte'],
  [/sangre/g, 'sangue'],
  [/ejército/g, 'esercito'],
  [/órdenes/g, 'ordini'],
  [/tierra/g, 'terra'],
  [/presas/g, 'prede'],
  [/Anillo/g, 'Anello'],
  [/anillo/g, 'anello'],
  [/Acero/g, 'Acciaio'],
  [/acero/g, 'acciaio'],
  [/Hierro/g, 'Ferro'],
  [/hierro/g, 'ferro'],
  [/Oxidado/g, 'Arrugginito'],
  [/Esmeralda/g, 'Smeraldo'],
  [/Sagrado/g, 'Sacro'],

  // === Fix preposizioni rimaste ===
  [/ de {/g, ' di {'],
  [/ de \[/g, ' di ['],
  [/ el /g, ' il '],
  [/ la /g, ' la '],
  [/ son /g, ' sono '],
  [/¡/g, ''],
  [/¿/g, ''],
];

/** Adatta alla lunghezza target */
function fitToLength(translated, targetLen) {
  let buf = Buffer.from(translated, 'utf8');
  if (buf.length === targetLen) return translated;
  if (buf.length < targetLen) {
    const padded = Buffer.alloc(targetLen, 0x20);
    buf.copy(padded);
    return padded.toString('utf8');
  }
  // Tronca — taglia all'ultima parola che entra
  let s = translated;
  while (Buffer.from(s, 'utf8').length > targetLen) {
    s = s.slice(0, -1);
  }
  const diff = targetLen - Buffer.from(s, 'utf8').length;
  if (diff > 0) s += ' '.repeat(diff);
  return s;
}

/** Traduzione rule-based ES→IT — 3 passaggi per evitare conflitti regex */
function translateEsIt(es) {
  let it = es;

  // PASSO 1: Proteggi e traduci espressioni tra {tag,...}
  // Salva i tag, traducili internamente, poi rimettili
  const tags = [];
  it = it.replace(/\{[a-zA-Z],([^}]+)\}/g, (match) => {
    let translated = match;
    // Traduci il contenuto dei tag
    for (const [regex, replacement] of WORD_MAP) {
      // Applica solo regex che matchano dentro i tag
      if (regex.source.startsWith('\\{')) {
        translated = translated.replace(regex, replacement);
      }
    }
    const idx = tags.length;
    tags.push(translated);
    return `\x01TAG${idx}\x01`;
  });

  // PASSO 2: Frasi intere (senza tag, già protetti)
  const PHRASES = [
    [/Se especializa en el combate cuerpo a cuerpo y en impedir que los enemigos avancen/g, 'Specializzato nel combattimento ravvicinato e nel bloccare i nemici'],
    [/Se especializa en el combate a distancia utilizando/g, 'Specializzato nel combattimento a distanza utilizzando'],
    [/Se especializa en el combate cuerpo a cuerpo/g, 'Specializzato nel combattimento corpo a corpo'],
    [/Se especializa en el combate a distancia/g, 'Specializzato nel combattimento a distanza'],
    [/listo para disparar a los enemigos desde la distancia/g, 'pronto a sparare ai nemici dalla distanza'],
    [/Arquero listo para disparar/g, 'Arciere pronto a sparare'],
    [/Puede .g,curare. a otros/g, 'Puo curare altri'], // tag gia protetto
    [/bolas de fuego letales/g, 'palle di fuoco letali'],
    [/bolas de fuego/g, 'palle di fuoco'],
    [/no muertos y venenosos/g, 'non-morti e velenosi'],
    [/no muertos/g, 'non-morti'],
    [/Mucho más resistentes que las ratas normales/g, 'Molto piu resistenti dei ratti normali'],
    [/Criaturas aladas repugnantes que pueden sobrevolar a los Defensores/g, 'Creature alate ripugnanti che possono sorvolare i Difensori'],
    [/Criaturas aladas agresivas que pueden sobrevolar a los Defensores y atacar cualquier cosa que se interponga en su camino/g, 'Creature alate aggressive che possono sorvolare i Difensori e attaccare qualsiasi cosa sul loro cammino'],
    [/Criaturas voladoras traviesas que son muy difíciles de derrotar/g, 'Creature volanti birichine molto difficili da abbattere'],
    [/Criaturas rápidas y feroces equipadas con enormes y afilados dientes que desgarran la piel/g, 'Creature rapide e feroci dotate di enormi denti affilati che squarciano la pelle'],
    [/Criaturas rápidas y resistentes, despiadadas, dotadas de enormes y afilados dientes que desgarran la piel/g, 'Creature rapide e resistenti, spietate, dotate di enormi denti affilati che squarciano la pelle'],
    [/Criaturas sanguinarias que se curan provocando hemorragias/g, 'Creature sanguinarie che si curano provocando emorragie'],
    [/Su agilidad les permite esquivar ataques cuerpo a cuerpo/g, 'La loro agilita permette di schivare attacchi ravvicinati'],
    [/Colosal monstruo volador con tentáculos que aplica Escarcha a todos los enemigos cercanos/g, 'Colossale mostro volante con tentacoli che applica Brina a tutti i nemici vicini'],
    [/Casi nada puede dañar a esta monstruosidad, a excepción del/g, 'Quasi nulla puo danneggiare questa mostruosita, tranne il'],
    [/Gigantesco Golem de hielo puro/g, 'Gigantesco Golem di ghiaccio puro'],
    [/Roedores rápidos y feroces con dientes afilados/g, 'Roditori rapidi e feroci con denti affilati'],
    [/Roedores mucho más rápidos y feroces, con dientes afilados/g, 'Roditori molto piu rapidi e feroci, con denti affilati'],
    [/Roedores no muertos y venenosos con dientes afilados/g, 'Roditori non-morti e velenosi con denti affilati'],
    [/Al derrotarlas, sueltan cofres/g, 'Quando sconfitte, rilasciano forzieri'],
    [/Humanoides malvados/g, 'Umanoidi malvagi'],
    [/humanoides malvados/g, 'umanoidi malvagi'],
    [/Chamán malvado que cura a los aliados cercanos y lanza/g, 'Sciamano malvagio che cura gli alleati vicini e lancia'],
    [/Humanoides malvados resistentes que pueden bloquear ataques/g, 'Umanoidi malvagi resistenti che possono bloccare attacchi'],
    [/Caballero resistente que no puede ser aturdido ni empujado/g, 'Cavaliere resistente che non puo essere stordito o respinto'],
    [/Guerreros muy resistentes que pueden regenerar salud/g, 'Guerrieri molto resistenti che possono rigenerare salute'],
    [/Autómatas sin mente que obedecen las órdenes del Rey Necro/g, 'Automi senza mente che obbediscono gli ordini del Re Necro'],
    [/Humanoides sin mente, inmunes al/g, 'Umanoidi senza mente, immuni al'],
    [/Reviven al morir/g, 'Risorgono alla morte'],
    [/El Rey Nigromante, todos los esqueletos obedecen sus órdenes/g, 'Il Re Negromante, tutti gli scheletri obbediscono ai suoi ordini'],
    [/Invoca un ejército de esqueletos sedientos de sangre/g, 'Evoca un esercito di scheletri assetati di sangue'],
    [/Monstruo muy letal con garras y dientes afilados que desgarran incluso las armaduras más resistentes/g, 'Mostro molto letale con artigli e denti affilati che squarciano anche le armature piu resistenti'],
    [/Enterrados bajo tierra, solo se revelan cuando atacan a sus desprevenidas presas/g, 'Sepolti sottoterra, si rivelano solo quando attaccano le loro prede ignare'],
    [/Monstruos Enterrados muy resistentes que solo se revelan cuando atacan a sus desprevenidas presas/g, 'Mostri Sepolti molto resistenti che si rivelano solo quando attaccano le loro prede ignare'],
    [/Feroz guerrero capaz de resistir incluso los ataques más fuertes/g, 'Feroce guerriero capace di resistere anche agli attacchi piu forti'],
    [/El Rey de los Goblins es un feroz guerrero que derriba a los objetivos cercanos y dispara a los Héroes lejanos/g, 'Il Re dei Goblin e un feroce guerriero che abbatte i bersagli vicini e spara agli Eroi lontani'],
    [/Albóndiga desatada! Golpea el suelo, aturdiendo a los objetivos cercanos/g, 'Polpetta scatenata! Colpisce il suolo, stordendo i bersagli vicini'],
    [/Con sus dientes helados y afilados como cuchillas, estas bestias traen una muerte gélida incluso a los guerreros más duros/g, 'Con i loro denti ghiacciati e affilati come lame, queste bestie portano una morte gelida anche ai guerrieri piu duri'],
    [/Criatura de hielo que congela a los enemigos cercanos/g, 'Creatura di ghiaccio che congela i nemici vicini'],
    [/Monstruo venenoso muy resistente hecho de madera y hierba/g, 'Mostro velenoso molto resistente fatto di legno e erba'],
    [/Adaptadas al frío/g, 'Adattate al gelo'],
    [/cualquier cosa que se interponga en su camino/g, 'qualsiasi cosa sul loro cammino'],
    [/que atacan cualquier cosa en su camino/g, 'che attaccano qualsiasi cosa sul loro cammino'],
    [/atacar cualquier cosa/g, 'attaccare qualsiasi cosa'],
    [/Platziere einen Verteidiger/g, 'Piazza un Difensore'],
    [/Convierte todo el daño en/g, 'Converte tutto il danno in'],
    [/Puede atacar a enemigos translúcidos\/enterrados/g, 'Puo attaccare nemici traslucidi/sepolti'],
    [/Los proyectiles regresan al Héroe/g, 'I proiettili ritornano all Eroe'],
    [/Cada vez que Tangy levanta con éxito/g, 'Ogni volta che Tangy solleva con successo'],
    [/Los Héroes levantados obtienen/g, 'Gli Eroi sollevati ottengono'],
    [/Marca los objetivos principales/g, 'Segna i bersagli principali'],
    [/haciendo que reciban/g, 'facendo che subiscano'],
    [/Tangy usa su magia y/g, 'Tangy usa la sua magia e'],
    [/para invocar a pequeños Héroes que la defiendan/g, 'per evocare piccoli Eroi che la difendano'],
    [/necesarias para invocar Héroes y comprar mejoras/g, 'necessarie per evocare Eroi e comprare migliorie'],
    [/Coloca un Defensor para evitar que los Goblins lleguen hasta Tangy/g, 'Piazza un Difensore per impedire ai Goblin di raggiungere Tangy'],
    [/Los Goblins han capturado a nuestra/g, 'I Goblin hanno catturato la nostra'],
    [/Derrota a las guardias para liberarla/g, 'Sconfiggi le guardie per liberarla'],
    [/Sube la clasificación luchando a través de oleadas infinitas para ver cuánto puedes aguantar/g, 'Scala la classifica combattendo ondate infinite per vedere quanto riesci a resistere'],
    [/Una vez por cada nueva ronda/g, 'Una volta per ogni nuova ondata'],
    [/volver a tirar los dados de la tienda de forma gratuita/g, 'rilanciare i dadi del negozio gratuitamente'],
  ];
  for (const [regex, replacement] of PHRASES) {
    it = it.replace(regex, replacement);
  }

  // PASSO 3: Parole singole con word boundary (\b)
  const WORDS = [
    // Nomi
    ['Murciélago', 'Pipistrello'],
    ['murciélago', 'pipistrello'],
    ['Árbol', 'Albero'],
    ['árbol', 'albero'],
    ['Arquero', 'Arciere'],
    ['Esqueletos', 'Scheletri'],
    ['esqueletos', 'scheletri'],
    ['Esqueleto', 'Scheletro'],
    ['esqueleto', 'scheletro'],
    ['Chamán', 'Sciamano'],
    ['Nigromante', 'Negromante'],
    ['Albóndiga', 'Polpetta'],
    ['Caballero', 'Cavaliere'],
    ['Anillo', 'Anello'],
    ['Esmeralda', 'Smeraldo'],
    ['Hierro Oxidado', 'Ferro Rugginoso'],
    ['Hierro', 'Ferro'],
    ['Acero', 'Acciaio'],
    ['Sagrado', 'Sacro'],
    ['Milenio', 'Millennio'],
    ['Madera', 'Legno'],
    ['Pinchos', 'Spine'],
    ['enemigos', 'nemici'],
    ['enemigo', 'nemico'],
    ['Enemigos', 'Nemici'],
    ['Defensores', 'Difensori'],
    ['Defensor', 'Difensore'],
    ['Héroes', 'Eroi'],
    ['Héroe', 'Eroe'],
    ['héroes', 'eroi'],
    ['héroe', 'eroe'],
    ['Criaturas', 'Creature'],
    ['criaturas', 'creature'],
    ['aliados', 'alleati'],
    ['guerreros', 'guerrieri'],
    ['guerrero', 'guerriero'],
    ['Guerrero', 'Guerriero'],
    ['objetivos', 'bersagli'],
    ['monstruo', 'mostro'],
    ['Monstruo', 'Mostro'],
    ['monstruos', 'mostri'],
    ['Monstruos', 'Mostri'],
    ['cofres', 'forzieri'],
    ['dientes', 'denti'],
    ['garras', 'artigli'],
    ['Proyectiles', 'Proiettili'],
    ['proyectiles', 'proiettili'],
    ['Proyectil', 'Proiettile'],
    ['proyectil', 'proiettile'],
    ['hechizos', 'incantesimi'],
    ['escudo', 'scudo'],
    ['Escudo', 'Scudo'],
    ['espada', 'spada'],
    ['veneno', 'veleno'],
    ['Veneno', 'Veleno'],
    ['fuego', 'fuoco'],
    ['Fuego', 'Fuoco'],
    ['Hielo', 'Ghiaccio'],
    ['hielo', 'ghiaccio'],
    ['Daño', 'Danno'],
    ['daño', 'danno'],
    ['Frío', 'Gelo'],
    ['frío', 'gelo'],
    ['Rayo', 'Fulmine'],
    ['rayo', 'fulmine'],
    ['Escarcha', 'Brina'],
    ['Sangrado', 'Emorragia'],
    ['sangrado', 'emorragia'],
    ['Aturdimiento', 'Stordimento'],
    ['aturdimiento', 'stordimento'],
    ['armadura', 'armatura'],
    ['Armadura', 'Armatura'],
    ['salud', 'salute'],
    ['magia', 'magia'],
    ['Naranjas', 'Arance'],
    ['naranjas', 'arance'],
    ['Naranja', 'Arancia'],
    ['mejoras', 'migliorie'],
    ['mejora', 'miglioria'],
    ['nivel', 'livello'],
    ['Nivel', 'Livello'],
    ['ronda', 'ondata'],
    ['Ronda', 'Ondata'],
    ['tienda', 'negozio'],
    ['Tienda', 'Negozio'],
    ['Velocidad', 'Velocita'],
    ['velocidad', 'velocita'],
    ['Habilidad', 'Abilita'],
    ['habilidad', 'abilita'],
    ['Duración', 'Durata'],
    ['duración', 'durata'],
    ['Probabilidad', 'Probabilita'],
    ['probabilidad', 'probabilita'],
    ['Congelación', 'Congelamento'],
    ['Efecto', 'Effetto'],
    ['efecto', 'effetto'],
    ['Efectos', 'Effetti'],
    ['efectos', 'effetti'],
    ['Alcance', 'Gittata'],
    ['alcance', 'gittata'],
    ['Ataque', 'Attacco'],
    ['ataque', 'attacco'],
    ['Ataques', 'Attacchi'],
    ['ataques', 'attacchi'],
    ['Bloqueo', 'Blocco'],
    ['Esquivar', 'Schivata'],
    ['Conmoción', 'Commozione'],
    ['Curación', 'Guarigione'],
    ['curación', 'guarigione'],
    // Verbi
    ['atacar', 'attaccare'],
    ['atacan', 'attaccano'],
    ['atacando', 'attaccando'],
    ['dispara', 'spara'],
    ['disparar', 'sparare'],
    ['curan', 'curano'],
    ['invocar', 'evocare'],
    ['invoca', 'evoca'],
    ['Invoca', 'Evoca'],
    ['aumenta', 'aumenta'],
    ['reduce', 'riduce'],
    ['Reduce', 'Riduce'],
    ['infligir', 'infliggere'],
    ['inflige', 'infligge'],
    ['bloquear', 'bloccare'],
    ['bloquea', 'blocca'],
    ['derrota', 'sconfigge'],
    ['derrotar', 'sconfiggere'],
    ['derrotarlas', 'sconfiggerle'],
    ['lanza', 'lancia'],
    ['congela', 'congela'],
    ['aplica', 'applica'],
    ['desgarran', 'squarciano'],
    ['obtiene', 'ottiene'],
    ['obtienen', 'ottengono'],
    ['sobrevolar', 'sorvolare'],
    ['regenerar', 'rigenerare'],
    ['también', 'anche'],
    ['También', 'Anche'],
    // Aggettivi
    ['cercanos', 'vicini'],
    ['cercano', 'vicino'],
    ['lejanos', 'lontani'],
    ['afilados', 'affilati'],
    ['afilado', 'affilato'],
    ['venenosos', 'velenosi'],
    ['venenoso', 'velenoso'],
    ['malvados', 'malvagi'],
    ['malvado', 'malvagio'],
    ['resistentes', 'resistenti'],
    ['repugnantes', 'ripugnanti'],
    ['sanguinarias', 'sanguinarie'],
    ['agresivas', 'aggressive'],
    ['feroces', 'feroci'],
    ['feroz', 'feroce'],
    ['rápidos', 'rapidi'],
    ['rápidas', 'rapide'],
    ['letales', 'letali'],
    ['letal', 'letale'],
    ['aladas', 'alate'],
    ['voladoras', 'volanti'],
    ['volador', 'volante'],
    ['pequeños', 'piccoli'],
    ['frágil', 'fragile'],
    ['necesarias', 'necessarie'],
    ['inmunes', 'immuni'],
    ['inmune', 'immune'],
    ['difíciles', 'difficili'],
    // Preposizioni / Articoli (meno aggressivi — con contesto)
    ['también puede', 'puo anche'],
    ['Puede', 'Puo'],
    ['puede', 'puo'],
    ['pueden', 'possono'],
    ['que genera', 'che genera'],
    ['que ignora', 'che ignora'],
    ['que no', 'che non'],
    [' que ', ' che '],
    [' y ', ' e '],
    [' los ', ' i '],
    [' las ', ' le '],
    [' del ', ' del '],
    [' de la ', ' della '],
    [' de los ', ' dei '],
    [' de las ', ' delle '],
    [' de ', ' di '],
    [' en ', ' in '],
    [' con ', ' con '],
    [' para ', ' per '],
    [' por ', ' per '],
    [' el ', ' il '],
    [' su ', ' il suo '],
    [' sus ', ' i suoi '],
    [' todos ', ' tutti '],
    [' todas ', ' tutte '],
    [' más ', ' piu '],
    [' muy ', ' molto '],
    [' pero ', ' ma '],
    [' sin ', ' senza '],
    [' cada ', ' ogni '],
    [' mientras ', ' mentre '],
    [' otros ', ' altri '],
    ['¡', ''],
    ['¿', ''],
  ];
  for (const [es_word, it_word] of WORDS) {
    if (es_word === it_word) continue; // Evita loop infinito su parole uguali
    it = it.replaceAll(es_word, it_word);
  }

  // Ripristina i tag protetti
  it = it.replace(/\x01TAG(\d+)\x01/g, (_, idx) => tags[parseInt(idx)]);

  // Post-processing
  it = it.replace(/  +/g, ' ');
  it = it.replace(/ \./g, '.');
  it = it.replace(/ ,/g, ',');
  return it;
}

// ============================================================
// Main
// ============================================================
console.log('🎮 Tangy TD — Patch ES→IT');
console.log('==========================\n');

if (!fs.existsSync(ES_FILE)) {
  console.log('❌ File stringhe ES non trovato:', ES_FILE);
  console.log('   Esegui prima: node scripts/patch-tangy-td.mjs (extract)');
  process.exit(1);
}

const strings = JSON.parse(fs.readFileSync(ES_FILE, 'utf8'));
console.log(`📖 ${strings.length} stringhe ES caricate`);

// Traduci
let translated = 0;
let unchanged = 0;
for (const s of strings) {
  const it = translateEsIt(s.es);
  if (it !== s.es) {
    s.it = fitToLength(it, s.byteLen);
    translated++;
  } else {
    s.it = s.es; // invariata
    unchanged++;
  }
}

console.log(`✅ Tradotte: ${translated}`);
console.log(`⏭️  Invariate: ${unchanged}`);

// Salva traduzioni
const itFile = path.join(PATCH_DIR, 'strings-es-it.json');
fs.writeFileSync(itFile, JSON.stringify(strings, null, 2));
console.log(`💾 Salvate in ${itFile}`);

// Mostra esempi
console.log('\n📋 Esempi traduzioni:');
const examples = strings.filter(s => s.it !== s.es).slice(0, 15);
for (const s of examples) {
  console.log(`  ES: ${s.es.slice(0, 80)}`);
  console.log(`  IT: ${s.it.slice(0, 80)}`);
  console.log(`  (${s.byteLen}b → ${Buffer.from(s.it, 'utf8').length}b)`);
  console.log();
}

// Applica patch
console.log('🔧 Applicando patch...');
const buf = Buffer.from(fs.readFileSync(EXE_PATH));
let patched = 0;
let errors = 0;

for (const s of strings) {
  if (s.it === s.es) continue;
  
  const itBuf = Buffer.from(s.it, 'utf8');
  if (itBuf.length !== s.byteLen) {
    console.warn(`  ⚠️ Lunghezza mismatch @${s.offset}: ${itBuf.length} ≠ ${s.byteLen}`);
    errors++;
    continue;
  }
  
  // Verifica originale
  const orig = Buffer.alloc(s.byteLen);
  buf.copy(orig, 0, s.offset, s.offset + s.byteLen);
  const origStr = orig.toString('utf8');
  if (origStr !== s.es) {
    console.warn(`  ⚠️ Mismatch @${s.offset}`);
    errors++;
    continue;
  }
  
  itBuf.copy(buf, s.offset);
  patched++;
}

fs.writeFileSync(PATCHED_EXE, buf);

console.log(`\n✅ Patch completata!`);
console.log(`   📝 Patchate: ${patched} stringhe`);
if (errors > 0) console.log(`   ⚠️ Errori: ${errors}`);
console.log(`   📁 Output: ${PATCHED_EXE}`);
console.log(`\n📋 Per installare:`);
console.log(`   1. Backup: copy "${path.join(GAME_DIR, 'TangyTD.exe')}" "${path.join(GAME_DIR, 'TangyTD.exe.bak')}"`);
console.log(`   2. copy "${PATCHED_EXE}" "${path.join(GAME_DIR, 'TangyTD.exe')}"`);
