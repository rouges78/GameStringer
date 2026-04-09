/**
 * Translation Session Manager
 * Gestisce checkpoint, resume, statistiche e backup incrementale
 */

import { invoke } from '@tauri-apps/api/core';
import { clientLogger } from '@/lib/client-logger';

/** Statistiche di una sessione di traduzione */
export interface TranslationStats {
  startTime: number;
  endTime?: number;
  totalStrings: number;
  translatedStrings: number;
  failedStrings: number;
  skippedStrings: number;
  /** Breakdown per provider: quante stringhe ha tradotto ciascuno */
  providerUsage: Record<string, number>;
  /** Costo stimato in USD */
  estimatedCost: number;
  /** Caratteri totali tradotti */
  totalChars: number;
  /** Token totali stimati */
  totalTokens: number;
  /** Velocità media (stringhe/secondo) */
  avgSpeed: number;
  /** Chain preset usato */
  chainPreset: string;
  /** Lingua sorgente */
  sourceLang: string;
  /** Lingua target */
  targetLang: string;
  /** Nome del gioco */
  gameName: string;
}

/** Checkpoint per resume traduzione */
export interface TranslationCheckpoint {
  version: 1;
  gamePath: string;
  gameName: string;
  createdAt: number;
  updatedAt: number;
  /** Indice del prossimo batch da tradurre (i nel loop) */
  nextBatchIndex: number;
  /** Batch size usato */
  batchSize: number;
  /** Dialoghi con traduzioni parziali */
  dialogues: Array<{
    id: string;
    speaker: string;
    original: string;
    translated: string;
    file: string;
    line_index: number;
  }>;
  /** Stringhe totali dopo filtro */
  totalFiltered: number;
  /** Statistiche parziali */
  stats: TranslationStats;
}

/** Risultato validazione post-traduzione */
export interface ValidationResult {
  totalChecked: number;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface ValidationIssue {
  index: number;
  original: string;
  translated: string;
  type: 'length_ratio' | 'missing_variable' | 'identical' | 'encoding' | 'empty' | 'truncated';
  severity: 'error' | 'warning';
  message: string;
}

/** Voce glossario */
export interface GlossaryEntry {
  source: string;
  target: string;
  context?: string;
  caseSensitive?: boolean;
}

/** Glossario per-gioco */
export interface GameGlossary {
  gameId: string;
  gameName: string;
  sourceLang: string;
  targetLang: string;
  entries: GlossaryEntry[];
  updatedAt: number;
}

// =========== CHECKPOINT / RESUME ===========

const CHECKPOINT_FILENAME = 'translation_checkpoint.json';

function getCheckpointPath(gamePath: string): string {
  return `${gamePath}/GameStringer_Translation/${CHECKPOINT_FILENAME}`;
}

/** Salva checkpoint (backup incrementale) */
export async function saveCheckpoint(checkpoint: TranslationCheckpoint): Promise<void> {
  checkpoint.updatedAt = Date.now();
  try {
    await invoke('write_text_file', {
      path: getCheckpointPath(checkpoint.gamePath),
      content: JSON.stringify(checkpoint, null, 2),
    });
  } catch (err: unknown) {
    clientLogger.warn('[Checkpoint] Errore salvataggio:', err);
  }
}

/** Carica checkpoint esistente */
export async function loadCheckpoint(gamePath: string): Promise<TranslationCheckpoint | null> {
  try {
    const content = await invoke<string>('read_text_file', {
      path: getCheckpointPath(gamePath),
    });
    const cp = JSON.parse(content) as TranslationCheckpoint;
    if (cp.version === 1 && cp.dialogues?.length > 0) {
      return cp;
    }
    return null;
  } catch {
    return null;
  }
}

/** Verifica se esiste un checkpoint */
export async function hasCheckpoint(gamePath: string): Promise<boolean> {
  const cp = await loadCheckpoint(gamePath);
  return cp !== null;
}

/** Elimina checkpoint (traduzione completata) — sovrascrive con oggetto vuoto */
export async function clearCheckpoint(gamePath: string): Promise<void> {
  try {
    await invoke('write_text_file', {
      path: getCheckpointPath(gamePath),
      content: '{}',
    });
  } catch {
    // Ignora
  }
}

// =========== STATISTICHE ===========

/** Crea statistiche iniziali */
export function createStats(opts: {
  totalStrings: number;
  chainPreset: string;
  sourceLang: string;
  targetLang: string;
  gameName: string;
}): TranslationStats {
  return {
    startTime: Date.now(),
    totalStrings: opts.totalStrings,
    translatedStrings: 0,
    failedStrings: 0,
    skippedStrings: 0,
    providerUsage: {},
    estimatedCost: 0,
    totalChars: 0,
    totalTokens: 0,
    avgSpeed: 0,
    chainPreset: opts.chainPreset,
    sourceLang: opts.sourceLang,
    targetLang: opts.targetLang,
    gameName: opts.gameName,
  };
}

/** Aggiorna statistiche dopo un batch tradotto */
export function updateStats(
  stats: TranslationStats,
  provider: string,
  translatedCount: number,
  chars: number
): TranslationStats {
  const updated = { ...stats };
  updated.translatedStrings += translatedCount;
  updated.totalChars += chars;
  updated.totalTokens = Math.ceil(updated.totalChars / 4);
  updated.providerUsage[provider] = (updated.providerUsage[provider] || 0) + translatedCount;
  
  const elapsed = (Date.now() - updated.startTime) / 1000;
  updated.avgSpeed = elapsed > 0 ? updated.translatedStrings / elapsed : 0;
  
  // Stima costo basata su provider
  const costPerMToken: Record<string, number> = {
    gemini: 0.375, groq: 0.10, deepseek: 0.42, openai: 2.0,
    anthropic: 1.50, cerebras: 0.10, mistral: 0.55, cohere: 0.50,
    together: 0.30, fireworks: 0.20, openrouter: 0.50, deepl: 5.0,
    translategemma: 0, hymt: 0, mymemory: 0, lingva: 0,
  };
  const rate = costPerMToken[provider] || 0.50;
  updated.estimatedCost += (chars / 4 / 1_000_000) * rate * 2; // input + output
  
  return updated;
}

/** Finalizza statistiche */
export function finalizeStats(stats: TranslationStats): TranslationStats {
  return {
    ...stats,
    endTime: Date.now(),
    avgSpeed: stats.translatedStrings / Math.max((Date.now() - stats.startTime) / 1000, 1),
  };
}

/** Formatta durata in MM:SS */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Formatta costo */
export function formatCost(usd: number): string {
  if (usd === 0) return 'Gratuito';
  if (usd < 0.01) return '< $0.01';
  return `~$${usd.toFixed(2)}`;
}

// =========== VALIDAZIONE ===========

/** Valida traduzioni post-completamento */
export function validateTranslations(
  dialogues: Array<{ original: string; translated: string }>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < dialogues.length; i++) {
    const { original, translated } = dialogues[i];

    // Stringa vuota
    if (!translated || translated.trim() === '') {
      issues.push({
        index: i, original, translated,
        type: 'empty', severity: 'error',
        message: 'Traduzione vuota',
      });
      continue;
    }

    // Identica all'originale — skip per probabili nomi propri
    if (translated.trim() === original.trim()) {
      const trimmed = original.trim();
      const looksLikeProperName = (
        trimmed.length < 40 &&                                    // corta
        /^[A-ZÀ-ÿ]/.test(trimmed) &&                             // inizia maiuscola
        (trimmed.split(/\s+/).length <= 5) &&                     // max 5 parole
        !/[.!?]$/.test(trimmed)                                   // non finisce con punteggiatura
      );
      const isShortOrNumeric = trimmed.length <= 3 || /^[\d.,%:\/\-+x×]+$/.test(trimmed);
      if (!looksLikeProperName && !isShortOrNumeric) {
        issues.push({
          index: i, original, translated,
          type: 'identical', severity: 'warning',
          message: 'Traduzione identica all\'originale',
        });
      }
    }

    // Ratio lunghezza anomala (traduzione > 3x o < 0.2x dell'originale)
    const ratio = translated.length / Math.max(original.length, 1);
    if (ratio > 3.0) {
      issues.push({
        index: i, original, translated,
        type: 'length_ratio', severity: 'warning',
        message: `Traduzione troppo lunga (${Math.round(ratio * 100)}% dell'originale)`,
      });
    } else if (ratio < 0.2 && original.length > 10) {
      issues.push({
        index: i, original, translated,
        type: 'length_ratio', severity: 'warning',
        message: `Traduzione troppo corta (${Math.round(ratio * 100)}% dell'originale)`,
      });
    }

    // Variabili mancanti ({0}, %s, %d, {name}, etc.)
    const varPatterns = [
      /\{(\d+|[a-zA-Z_]+)\}/g,  // {0}, {name}
      /%[sd]/g,                   // %s, %d
      /\$\{[^}]+\}/g,            // ${var}
      /\\n/g,                     // \n newlines
    ];
    // Tag non-HTML (skip <b>, <i>, <br>, <em>, <strong>, etc. — sono formattazione, non variabili)
    const tagPattern = /<(?!\/?(?:b|i|u|br|em|strong|p|span|div|font|color|size)\b)[^>]+>/g;
    const origTags: string[] = original.match(tagPattern) || [];
    const transTags: string[] = translated.match(tagPattern) || [];
    for (const v of origTags) {
      if (!transTags.includes(v)) {
        issues.push({
          index: i, original, translated,
          type: 'missing_variable', severity: 'error',
          message: `Tag mancante: ${v}`,
        });
        break;
      }
    }

    for (const pattern of varPatterns) {
      const origVars: string[] = original.match(pattern) || [];
      const transVars: string[] = translated.match(pattern) || [];

      for (const v of origVars) {
        if (!transVars.includes(v)) {
          issues.push({
            index: i, original, translated,
            type: 'missing_variable', severity: 'error',
            message: `Variabile mancante: ${v}`,
          });
          break; // Una sola segnalazione per stringa
        }
      }
    }

    // Troncamento (traduzione che finisce con ... quando l'originale no)
    if (translated.endsWith('...') && !original.endsWith('...') && translated.length > 20) {
      issues.push({
        index: i, original, translated,
        type: 'truncated', severity: 'warning',
        message: 'Possibile troncamento (termina con ...)',
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const total = dialogues.length || 1;
  // Score basato su percentuale di stringhe con problemi (non conta assoluto)
  const errorPenalty = (errorCount / total) * 200;   // errori pesano 2x
  const warningPenalty = (warningCount / total) * 50; // warning pesano 0.5x
  const score = Math.max(0, Math.round(100 - errorPenalty - warningPenalty));

  return {
    totalChecked: dialogues.length,
    issues,
    score,
  };
}

// =========== GLOSSARIO ===========

const GLOSSARY_STORAGE_KEY = 'gs_glossaries';

/** Carica tutti i glossari */
export function loadGlossaries(): Record<string, GameGlossary> {
  try {
    const raw = localStorage.getItem(GLOSSARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Salva glossario per un gioco */
export function saveGlossary(glossary: GameGlossary): void {
  const all = loadGlossaries();
  all[glossary.gameId] = glossary;
  localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(all));
}

/** Carica glossario per un gioco */
export function loadGlossary(gameId: string): GameGlossary | null {
  const all = loadGlossaries();
  return all[gameId] || null;
}

/** Applica glossario a un array di testi prima della traduzione */
export function applyGlossaryToPrompt(
  texts: string[],
  glossary: GameGlossary | null
): { texts: string[]; glossaryHint: string } {
  if (!glossary || glossary.entries.length === 0) {
    return { texts, glossaryHint: '' };
  }

  // Genera hint per il prompt AI
  const lines = glossary.entries.map(e => `"${e.source}" → "${e.target}"`);
  const glossaryHint = `GLOSSARIO (usa SEMPRE questi termini):\n${lines.join('\n')}`;

  return { texts, glossaryHint };
}

/** Glossario di default per giochi comuni */
export function getDefaultGlossaryEntries(genre?: string): GlossaryEntry[] {
  const common: GlossaryEntry[] = [
    { source: 'Save', target: 'Salva' },
    { source: 'Load', target: 'Carica' },
    { source: 'Settings', target: 'Impostazioni' },
    { source: 'Quit', target: 'Esci' },
    { source: 'New Game', target: 'Nuova Partita' },
    { source: 'Continue', target: 'Continua' },
  ];

  if (genre === 'RPG') {
    return [
      ...common,
      { source: 'HP', target: 'PV', context: 'Hit Points → Punti Vita' },
      { source: 'MP', target: 'PM', context: 'Magic Points → Punti Mana' },
      { source: 'XP', target: 'PE', context: 'Experience → Punti Esperienza' },
      { source: 'Guild', target: 'Gilda' },
      { source: 'Quest', target: 'Missione' },
      { source: 'Dungeon', target: 'Dungeon', context: 'Non tradurre' },
      { source: 'Party', target: 'Gruppo' },
      { source: 'Inventory', target: 'Inventario' },
    ];
  }

  if (genre === 'VN') {
    return [
      ...common,
      { source: 'Chapter', target: 'Capitolo' },
      { source: 'Auto', target: 'Auto' },
      { source: 'Skip', target: 'Salta' },
      { source: 'Log', target: 'Cronologia' },
      { source: 'Backlog', target: 'Cronologia' },
    ];
  }

  return common;
}

/** Lingue disponibili per i template glossario */
export interface GlossaryTemplateInfo {
  lang: string;
  label: string;
  flag: string;
  entries: number;
}

/** Ritorna le lingue disponibili per i template glossario */
export function getGlossaryTemplateLanguages(): GlossaryTemplateInfo[] {
  return [
    { lang: 'zh', label: '简体中文 (Cinese Semplificato)', flag: '🇨🇳', entries: 32 },
    { lang: 'pt-BR', label: 'Português Brasileiro', flag: '🇧🇷', entries: 32 },
    { lang: 'ko', label: '한국어 (Coreano)', flag: '🇰🇷', entries: 32 },
    { lang: 'es-419', label: 'Español Latinoamérica', flag: '🇲🇽', entries: 32 },
    { lang: 'ja', label: '日本語 (Giapponese)', flag: '🇯🇵', entries: 32 },
    { lang: 'it', label: 'Italiano', flag: '🇮🇹', entries: 14 },
  ];
}

/** Template glossari per le top 5 lingue di localizzazione gaming + IT */
export function getGlossaryTemplateForLanguage(targetLang: string, genre?: string): GlossaryEntry[] {
  const templates: Record<string, { common: GlossaryEntry[]; rpg: GlossaryEntry[]; action: GlossaryEntry[] }> = {

    // ===== CINESE SEMPLIFICATO =====
    'zh': {
      common: [
        { source: 'Save', target: '保存' },
        { source: 'Load', target: '读取' },
        { source: 'Settings', target: '设置' },
        { source: 'Options', target: '选项' },
        { source: 'Quit', target: '退出' },
        { source: 'New Game', target: '新游戏' },
        { source: 'Continue', target: '继续' },
        { source: 'Resume', target: '恢复' },
        { source: 'Pause', target: '暂停' },
        { source: 'Retry', target: '重试' },
        { source: 'Confirm', target: '确认' },
        { source: 'Cancel', target: '取消' },
        { source: 'Back', target: '返回' },
        { source: 'Accept', target: '接受' },
        { source: 'Decline', target: '拒绝' },
        { source: 'Tutorial', target: '教程' },
        { source: 'Difficulty', target: '难度' },
        { source: 'Easy', target: '简单' },
        { source: 'Normal', target: '普通' },
        { source: 'Hard', target: '困难' },
        { source: 'Volume', target: '音量' },
        { source: 'Brightness', target: '亮度' },
        { source: 'Fullscreen', target: '全屏' },
        { source: 'Achievements', target: '成就' },
        { source: 'Leaderboard', target: '排行榜' },
        { source: 'Multiplayer', target: '多人游戏' },
        { source: 'Player', target: '玩家' },
        { source: 'Level', target: '等级', context: 'Livello personaggio' },
        { source: 'Stage', target: '关卡', context: 'Livello di gioco' },
        { source: 'Score', target: '得分' },
        { source: 'Health', target: '生命值' },
        { source: 'Game Over', target: '游戏结束' },
      ],
      rpg: [
        { source: 'HP', target: 'HP', context: '生命值 — spesso lasciato come HP in ZH' },
        { source: 'MP', target: 'MP', context: '魔法值' },
        { source: 'XP', target: '经验值' },
        { source: 'Attack', target: '攻击' },
        { source: 'Defense', target: '防御' },
        { source: 'Magic', target: '魔法' },
        { source: 'Skill', target: '技能' },
        { source: 'Quest', target: '任务' },
        { source: 'Inventory', target: '背包' },
        { source: 'Equipment', target: '装备' },
        { source: 'Weapon', target: '武器' },
        { source: 'Armor', target: '护甲' },
        { source: 'Potion', target: '药水' },
        { source: 'Guild', target: '公会' },
        { source: 'Party', target: '队伍' },
        { source: 'Dungeon', target: '地下城' },
        { source: 'Boss', target: 'Boss', context: '首领 — spesso lasciato come Boss' },
        { source: 'NPC', target: 'NPC', context: '非玩家角色' },
      ],
      action: [
        { source: 'Ammo', target: '弹药' },
        { source: 'Reload', target: '换弹' },
        { source: 'Shield', target: '护盾' },
        { source: 'Dash', target: '冲刺' },
        { source: 'Dodge', target: '闪避' },
        { source: 'Crouch', target: '蹲下' },
        { source: 'Sprint', target: '冲刺' },
        { source: 'Stealth', target: '潜行' },
      ],
    },

    // ===== PORTOGHESE BRASILIANO =====
    'pt-BR': {
      common: [
        { source: 'Save', target: 'Salvar' },
        { source: 'Load', target: 'Carregar' },
        { source: 'Settings', target: 'Configurações' },
        { source: 'Options', target: 'Opções' },
        { source: 'Quit', target: 'Sair' },
        { source: 'New Game', target: 'Novo Jogo' },
        { source: 'Continue', target: 'Continuar' },
        { source: 'Resume', target: 'Retomar' },
        { source: 'Pause', target: 'Pausar' },
        { source: 'Retry', target: 'Tentar Novamente' },
        { source: 'Confirm', target: 'Confirmar' },
        { source: 'Cancel', target: 'Cancelar' },
        { source: 'Back', target: 'Voltar' },
        { source: 'Accept', target: 'Aceitar' },
        { source: 'Decline', target: 'Recusar' },
        { source: 'Tutorial', target: 'Tutorial' },
        { source: 'Difficulty', target: 'Dificuldade' },
        { source: 'Easy', target: 'Fácil' },
        { source: 'Normal', target: 'Normal' },
        { source: 'Hard', target: 'Difícil' },
        { source: 'Volume', target: 'Volume' },
        { source: 'Brightness', target: 'Brilho' },
        { source: 'Fullscreen', target: 'Tela Cheia' },
        { source: 'Achievements', target: 'Conquistas' },
        { source: 'Leaderboard', target: 'Ranking' },
        { source: 'Multiplayer', target: 'Multijogador' },
        { source: 'Player', target: 'Jogador' },
        { source: 'Level', target: 'Nível' },
        { source: 'Score', target: 'Pontuação' },
        { source: 'Health', target: 'Vida' },
        { source: 'Game Over', target: 'Fim de Jogo' },
        { source: 'Checkpoint', target: 'Checkpoint', context: 'Mantenere in inglese — standard BR gaming' },
      ],
      rpg: [
        { source: 'HP', target: 'PV', context: 'Pontos de Vida' },
        { source: 'MP', target: 'PM', context: 'Pontos de Mana' },
        { source: 'XP', target: 'XP', context: 'Experiência' },
        { source: 'Attack', target: 'Ataque' },
        { source: 'Defense', target: 'Defesa' },
        { source: 'Magic', target: 'Magia' },
        { source: 'Skill', target: 'Habilidade' },
        { source: 'Quest', target: 'Missão' },
        { source: 'Inventory', target: 'Inventário' },
        { source: 'Equipment', target: 'Equipamento' },
        { source: 'Weapon', target: 'Arma' },
        { source: 'Armor', target: 'Armadura' },
        { source: 'Potion', target: 'Poção' },
        { source: 'Guild', target: 'Guilda' },
        { source: 'Party', target: 'Grupo' },
        { source: 'Dungeon', target: 'Masmorra' },
        { source: 'Boss', target: 'Chefe', context: 'Chefão è informale — Chefe è standard' },
        { source: 'NPC', target: 'NPC', context: 'Personagem não jogável' },
      ],
      action: [
        { source: 'Ammo', target: 'Munição' },
        { source: 'Reload', target: 'Recarregar' },
        { source: 'Shield', target: 'Escudo' },
        { source: 'Dash', target: 'Dash', context: 'Mantenere in inglese — gergale gaming BR' },
        { source: 'Dodge', target: 'Esquivar' },
        { source: 'Crouch', target: 'Agachar' },
        { source: 'Sprint', target: 'Correr' },
        { source: 'Stealth', target: 'Furtividade' },
      ],
    },

    // ===== COREANO =====
    'ko': {
      common: [
        { source: 'Save', target: '저장' },
        { source: 'Load', target: '불러오기' },
        { source: 'Settings', target: '설정' },
        { source: 'Options', target: '옵션' },
        { source: 'Quit', target: '종료' },
        { source: 'New Game', target: '새 게임' },
        { source: 'Continue', target: '계속하기' },
        { source: 'Resume', target: '재개' },
        { source: 'Pause', target: '일시정지' },
        { source: 'Retry', target: '다시 시도' },
        { source: 'Confirm', target: '확인' },
        { source: 'Cancel', target: '취소' },
        { source: 'Back', target: '뒤로' },
        { source: 'Accept', target: '수락' },
        { source: 'Decline', target: '거절' },
        { source: 'Tutorial', target: '튜토리얼' },
        { source: 'Difficulty', target: '난이도' },
        { source: 'Easy', target: '쉬움' },
        { source: 'Normal', target: '보통' },
        { source: 'Hard', target: '어려움' },
        { source: 'Volume', target: '볼륨' },
        { source: 'Brightness', target: '밝기' },
        { source: 'Fullscreen', target: '전체 화면' },
        { source: 'Achievements', target: '업적' },
        { source: 'Leaderboard', target: '순위표' },
        { source: 'Multiplayer', target: '멀티플레이' },
        { source: 'Player', target: '플레이어' },
        { source: 'Level', target: '레벨' },
        { source: 'Score', target: '점수' },
        { source: 'Health', target: '체력' },
        { source: 'Game Over', target: '게임 오버' },
        { source: 'Checkpoint', target: '체크포인트' },
      ],
      rpg: [
        { source: 'HP', target: 'HP', context: '체력 — lasciato come HP in KO gaming' },
        { source: 'MP', target: 'MP', context: '마나' },
        { source: 'XP', target: '경험치' },
        { source: 'Attack', target: '공격' },
        { source: 'Defense', target: '방어' },
        { source: 'Magic', target: '마법' },
        { source: 'Skill', target: '스킬' },
        { source: 'Quest', target: '퀘스트' },
        { source: 'Inventory', target: '인벤토리' },
        { source: 'Equipment', target: '장비' },
        { source: 'Weapon', target: '무기' },
        { source: 'Armor', target: '방어구' },
        { source: 'Potion', target: '포션' },
        { source: 'Guild', target: '길드' },
        { source: 'Party', target: '파티' },
        { source: 'Dungeon', target: '던전' },
        { source: 'Boss', target: '보스' },
        { source: 'NPC', target: 'NPC', context: '비플레이어 캐릭터' },
      ],
      action: [
        { source: 'Ammo', target: '탄약' },
        { source: 'Reload', target: '재장전' },
        { source: 'Shield', target: '방패' },
        { source: 'Dash', target: '대시' },
        { source: 'Dodge', target: '회피' },
        { source: 'Crouch', target: '웅크리기' },
        { source: 'Sprint', target: '질주' },
        { source: 'Stealth', target: '은신' },
      ],
    },

    // ===== SPAGNOLO LATINO AMERICANO =====
    'es-419': {
      common: [
        { source: 'Save', target: 'Guardar' },
        { source: 'Load', target: 'Cargar' },
        { source: 'Settings', target: 'Ajustes' },
        { source: 'Options', target: 'Opciones' },
        { source: 'Quit', target: 'Salir' },
        { source: 'New Game', target: 'Nueva Partida' },
        { source: 'Continue', target: 'Continuar' },
        { source: 'Resume', target: 'Reanudar' },
        { source: 'Pause', target: 'Pausa' },
        { source: 'Retry', target: 'Reintentar' },
        { source: 'Confirm', target: 'Confirmar' },
        { source: 'Cancel', target: 'Cancelar' },
        { source: 'Back', target: 'Atrás' },
        { source: 'Accept', target: 'Aceptar' },
        { source: 'Decline', target: 'Rechazar' },
        { source: 'Tutorial', target: 'Tutorial' },
        { source: 'Difficulty', target: 'Dificultad' },
        { source: 'Easy', target: 'Fácil' },
        { source: 'Normal', target: 'Normal' },
        { source: 'Hard', target: 'Difícil' },
        { source: 'Volume', target: 'Volumen' },
        { source: 'Brightness', target: 'Brillo' },
        { source: 'Fullscreen', target: 'Pantalla Completa' },
        { source: 'Achievements', target: 'Logros' },
        { source: 'Leaderboard', target: 'Tabla de Posiciones' },
        { source: 'Multiplayer', target: 'Multijugador' },
        { source: 'Player', target: 'Jugador' },
        { source: 'Level', target: 'Nivel' },
        { source: 'Score', target: 'Puntaje', context: 'LatAm — "Puntuación" è più ES-ES' },
        { source: 'Health', target: 'Salud' },
        { source: 'Game Over', target: 'Fin del Juego' },
        { source: 'Checkpoint', target: 'Punto de Control' },
      ],
      rpg: [
        { source: 'HP', target: 'PV', context: 'Puntos de Vida' },
        { source: 'MP', target: 'PM', context: 'Puntos de Maná' },
        { source: 'XP', target: 'XP', context: 'Experiencia' },
        { source: 'Attack', target: 'Ataque' },
        { source: 'Defense', target: 'Defensa' },
        { source: 'Magic', target: 'Magia' },
        { source: 'Skill', target: 'Habilidad' },
        { source: 'Quest', target: 'Misión' },
        { source: 'Inventory', target: 'Inventario' },
        { source: 'Equipment', target: 'Equipamiento' },
        { source: 'Weapon', target: 'Arma' },
        { source: 'Armor', target: 'Armadura' },
        { source: 'Potion', target: 'Poción' },
        { source: 'Guild', target: 'Gremio' },
        { source: 'Party', target: 'Grupo' },
        { source: 'Dungeon', target: 'Mazmorra' },
        { source: 'Boss', target: 'Jefe' },
        { source: 'NPC', target: 'NPC', context: 'Personaje no jugable' },
      ],
      action: [
        { source: 'Ammo', target: 'Munición' },
        { source: 'Reload', target: 'Recargar' },
        { source: 'Shield', target: 'Escudo' },
        { source: 'Dash', target: 'Embestida' },
        { source: 'Dodge', target: 'Esquivar' },
        { source: 'Crouch', target: 'Agacharse' },
        { source: 'Sprint', target: 'Correr' },
        { source: 'Stealth', target: 'Sigilo' },
      ],
    },

    // ===== GIAPPONESE =====
    'ja': {
      common: [
        { source: 'Save', target: 'セーブ' },
        { source: 'Load', target: 'ロード' },
        { source: 'Settings', target: '設定' },
        { source: 'Options', target: 'オプション' },
        { source: 'Quit', target: '終了' },
        { source: 'New Game', target: 'ニューゲーム' },
        { source: 'Continue', target: 'つづきから' },
        { source: 'Resume', target: '再開' },
        { source: 'Pause', target: 'ポーズ' },
        { source: 'Retry', target: 'リトライ' },
        { source: 'Confirm', target: '決定' },
        { source: 'Cancel', target: 'キャンセル' },
        { source: 'Back', target: '戻る' },
        { source: 'Accept', target: '承諾' },
        { source: 'Decline', target: '辞退' },
        { source: 'Tutorial', target: 'チュートリアル' },
        { source: 'Difficulty', target: '難易度' },
        { source: 'Easy', target: 'イージー' },
        { source: 'Normal', target: 'ノーマル' },
        { source: 'Hard', target: 'ハード' },
        { source: 'Volume', target: '音量' },
        { source: 'Brightness', target: '明るさ' },
        { source: 'Fullscreen', target: 'フルスクリーン' },
        { source: 'Achievements', target: '実績' },
        { source: 'Leaderboard', target: 'ランキング' },
        { source: 'Multiplayer', target: 'マルチプレイ' },
        { source: 'Player', target: 'プレイヤー' },
        { source: 'Level', target: 'レベル' },
        { source: 'Score', target: 'スコア' },
        { source: 'Health', target: '体力' },
        { source: 'Game Over', target: 'ゲームオーバー' },
        { source: 'Checkpoint', target: 'チェックポイント' },
      ],
      rpg: [
        { source: 'HP', target: 'HP', context: 'ヒットポイント — sempre HP in JA' },
        { source: 'MP', target: 'MP', context: 'マジックポイント' },
        { source: 'XP', target: '経験値' },
        { source: 'Attack', target: '攻撃' },
        { source: 'Defense', target: '防御' },
        { source: 'Magic', target: '魔法' },
        { source: 'Skill', target: 'スキル' },
        { source: 'Quest', target: 'クエスト' },
        { source: 'Inventory', target: '所持品' },
        { source: 'Equipment', target: '装備' },
        { source: 'Weapon', target: '武器' },
        { source: 'Armor', target: '防具' },
        { source: 'Potion', target: 'ポーション' },
        { source: 'Guild', target: 'ギルド' },
        { source: 'Party', target: 'パーティー' },
        { source: 'Dungeon', target: 'ダンジョン' },
        { source: 'Boss', target: 'ボス' },
        { source: 'NPC', target: 'NPC', context: 'ノンプレイヤーキャラクター' },
      ],
      action: [
        { source: 'Ammo', target: '弾薬' },
        { source: 'Reload', target: 'リロード' },
        { source: 'Shield', target: 'シールド' },
        { source: 'Dash', target: 'ダッシュ' },
        { source: 'Dodge', target: '回避' },
        { source: 'Crouch', target: 'しゃがむ' },
        { source: 'Sprint', target: 'ダッシュ' },
        { source: 'Stealth', target: 'ステルス' },
      ],
    },

    // ===== ITALIANO (esistente, esteso) =====
    'it': {
      common: [
        { source: 'Save', target: 'Salva' },
        { source: 'Load', target: 'Carica' },
        { source: 'Settings', target: 'Impostazioni' },
        { source: 'Options', target: 'Opzioni' },
        { source: 'Quit', target: 'Esci' },
        { source: 'New Game', target: 'Nuova Partita' },
        { source: 'Continue', target: 'Continua' },
        { source: 'Resume', target: 'Riprendi' },
        { source: 'Pause', target: 'Pausa' },
        { source: 'Retry', target: 'Riprova' },
        { source: 'Confirm', target: 'Conferma' },
        { source: 'Cancel', target: 'Annulla' },
        { source: 'Back', target: 'Indietro' },
        { source: 'Accept', target: 'Accetta' },
        { source: 'Decline', target: 'Rifiuta' },
        { source: 'Tutorial', target: 'Tutorial' },
        { source: 'Difficulty', target: 'Difficoltà' },
        { source: 'Easy', target: 'Facile' },
        { source: 'Normal', target: 'Normale' },
        { source: 'Hard', target: 'Difficile' },
        { source: 'Volume', target: 'Volume' },
        { source: 'Brightness', target: 'Luminosità' },
        { source: 'Fullscreen', target: 'Schermo Intero' },
        { source: 'Achievements', target: 'Obiettivi' },
        { source: 'Leaderboard', target: 'Classifica' },
        { source: 'Multiplayer', target: 'Multigiocatore' },
        { source: 'Player', target: 'Giocatore' },
        { source: 'Level', target: 'Livello' },
        { source: 'Score', target: 'Punteggio' },
        { source: 'Health', target: 'Salute' },
        { source: 'Game Over', target: 'Fine Partita' },
        { source: 'Checkpoint', target: 'Punto di Salvataggio' },
      ],
      rpg: [
        { source: 'HP', target: 'PV', context: 'Punti Vita' },
        { source: 'MP', target: 'PM', context: 'Punti Mana' },
        { source: 'XP', target: 'PE', context: 'Punti Esperienza' },
        { source: 'Attack', target: 'Attacco' },
        { source: 'Defense', target: 'Difesa' },
        { source: 'Magic', target: 'Magia' },
        { source: 'Skill', target: 'Abilità' },
        { source: 'Quest', target: 'Missione' },
        { source: 'Inventory', target: 'Inventario' },
        { source: 'Equipment', target: 'Equipaggiamento' },
        { source: 'Weapon', target: 'Arma' },
        { source: 'Armor', target: 'Armatura' },
        { source: 'Potion', target: 'Pozione' },
        { source: 'Guild', target: 'Gilda' },
        { source: 'Party', target: 'Gruppo' },
        { source: 'Dungeon', target: 'Dungeon', context: 'Non tradurre' },
        { source: 'Boss', target: 'Boss', context: 'Non tradurre' },
        { source: 'NPC', target: 'PNG', context: 'Personaggio Non Giocante' },
      ],
      action: [
        { source: 'Ammo', target: 'Munizioni' },
        { source: 'Reload', target: 'Ricarica' },
        { source: 'Shield', target: 'Scudo' },
        { source: 'Dash', target: 'Scatto' },
        { source: 'Dodge', target: 'Schivata' },
        { source: 'Crouch', target: 'Accovacciarsi' },
        { source: 'Sprint', target: 'Scatto' },
        { source: 'Stealth', target: 'Furtività' },
      ],
    },
  };

  // Normalizza lingua (es-419, es-latam → es-419; pt-br → pt-BR)
  const langKey = targetLang.toLowerCase().replace('es-latam', 'es-419').replace('pt-br', 'pt-BR');
  const resolved = Object.keys(templates).find(k => k.toLowerCase() === langKey.toLowerCase()) || '';
  const tmpl = templates[resolved];
  if (!tmpl) return [];

  const base = [...tmpl.common];
  if (genre === 'RPG' || genre === 'rpg') {
    return [...base, ...tmpl.rpg];
  }
  if (genre === 'Action' || genre === 'action' || genre === 'FPS' || genre === 'TPS') {
    return [...base, ...tmpl.action];
  }
  // Senza genere: common + rpg (più universale)
  return [...base, ...tmpl.rpg];
}

// =========== EXPORT ===========

/** Esporta traduzioni in formato .po (GNU gettext) */
export function exportToPO(
  dialogues: Array<{ original: string; translated: string; file?: string }>,
  targetLang: string,
  gameName: string
): string {
  const header = [
    `# ${gameName} — Translation by GameStringer`,
    `# Generated: ${new Date().toISOString()}`,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Language: ${targetLang}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    ``,
  ].join('\n');

  const entries = dialogues.map((d, i) => {
    const comment = d.file ? `#: ${d.file}:${i}` : `#: string:${i}`;
    const msgid = d.original.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const msgstr = d.translated.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `${comment}\nmsgid "${msgid}"\nmsgstr "${msgstr}"`;
  }).join('\n\n');

  return header + '\n' + entries;
}

/** Esporta traduzioni in formato CSV */
export function exportToCSV(
  dialogues: Array<{ id?: string; original: string; translated: string; speaker?: string; file?: string }>
): string {
  const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const header = 'ID,Speaker,Original,Translated,File';
  const rows = dialogues.map((d, i) =>
    [escape(d.id || String(i)), escape(d.speaker || ''), escape(d.original), escape(d.translated), escape(d.file || '')].join(',')
  );
  return header + '\n' + rows.join('\n');
}

/** Esporta traduzioni in formato XLIFF 1.2 */
export function exportToXLIFF(
  dialogues: Array<{ id?: string; original: string; translated: string }>,
  sourceLang: string,
  targetLang: string,
  gameName: string
): string {
  const units = dialogues.map((d, i) => {
    const id = d.id || `s${i}`;
    const src = escapeXml(d.original);
    const tgt = escapeXml(d.translated);
    return `      <trans-unit id="${id}">\n        <source>${src}</source>\n        <target>${tgt}</target>\n      </trans-unit>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext" original="${escapeXml(gameName)}">
    <header>
      <tool tool-id="GameStringer" tool-name="GameStringer" tool-version="1.0" />
    </header>
    <body>
${units}
    </body>
  </file>
</xliff>`;
}

/** Esporta traduzioni in formato RESX (.NET) */
export function exportToRESX(
  dialogues: Array<{ id?: string; original: string; translated: string }>
): string {
  const entries = dialogues.map((d, i) => {
    const name = escapeXml(d.id || `String${i}`);
    const value = escapeXml(d.translated);
    const comment = escapeXml(d.original);
    return `  <data name="${name}" xml:space="preserve">\n    <value>${value}</value>\n    <comment>${comment}</comment>\n  </data>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <resheader name="resmimetype"><value>text/microsoft-resx</value></resheader>
  <resheader name="version"><value>2.0</value></resheader>
  <resheader name="reader"><value>System.Resources.ResXResourceReader</value></resheader>
  <resheader name="writer"><value>System.Resources.ResXResourceWriter</value></resheader>
${entries}
</root>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
