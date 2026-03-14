/**
 * Quality Scoring H/V/A System
 * 
 * Tracks the origin and quality of each translation:
 * - H (Human): manually written or edited by a human
 * - V (Validated): AI translation reviewed and approved by a human
 * - A (AI): machine-translated, not yet reviewed
 * - C (Captured): source text captured but not yet translated
 * 
 * Quality Score formula: (H×3 + V×2 + A×1) / (H + V + A)
 * Range: 1.0 (all AI) to 3.0 (all Human)
 * 
 * Labels:
 * - 2.5-3.0: Excellent
 * - 2.0-2.4: Good
 * - 1.5-1.9: Fair
 * - 1.0-1.4: Needs Review
 */

// ─── Types ───────────────────────────────────────────────────

export type QualityTag = 'H' | 'V' | 'A' | 'C';

export interface TranslationEntry {
  sourceText: string;
  translatedText: string;
  tag: QualityTag;
  /** ISO timestamp of last modification */
  updatedAt: string;
  /** Who made the last edit (username or 'ai') */
  editedBy?: string;
  /** AI model used for translation (if tag is A) */
  aiModel?: string;
  /** Number of times this entry was edited */
  editCount: number;
  /** Optional notes */
  notes?: string;
}

export interface QualityStats {
  human: number;
  validated: number;
  ai: number;
  captured: number;
  total: number;
  translated: number;
  score: number;
  label: QualityLabel;
  completionPercent: number;
}

export type QualityLabel = 'Excellent' | 'Good' | 'Fair' | 'Needs Review' | 'Empty';

export interface TranslationProject {
  id: string;
  gameName: string;
  gameAppId?: number;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  entries: Record<string, TranslationEntry>;
  stats: QualityStats;
}

// ─── Constants ───────────────────────────────────────────────

const STORAGE_KEY = 'gs_quality_projects';
const WEIGHT_H = 3;
const WEIGHT_V = 2;
const WEIGHT_A = 1;

// ─── Core Functions ──────────────────────────────────────────

/**
 * Calculate quality score from H/V/A distribution
 */
export function calculateQualityScore(h: number, v: number, a: number): number {
  const total = h + v + a;
  if (total === 0) return 0;
  return (h * WEIGHT_H + v * WEIGHT_V + a * WEIGHT_A) / total;
}

/**
 * Get quality label from score
 */
export function getQualityLabel(score: number): QualityLabel {
  if (score === 0) return 'Empty';
  if (score >= 2.5) return 'Excellent';
  if (score >= 2.0) return 'Good';
  if (score >= 1.5) return 'Fair';
  return 'Needs Review';
}

/**
 * Get color for quality label (Tailwind classes)
 */
export function getQualityColor(label: QualityLabel): string {
  switch (label) {
    case 'Excellent': return 'text-emerald-400';
    case 'Good': return 'text-blue-400';
    case 'Fair': return 'text-amber-400';
    case 'Needs Review': return 'text-red-400';
    case 'Empty': return 'text-zinc-500';
  }
}

/**
 * Get background color for quality label
 */
export function getQualityBgColor(label: QualityLabel): string {
  switch (label) {
    case 'Excellent': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'Good': return 'bg-blue-500/20 border-blue-500/30';
    case 'Fair': return 'bg-amber-500/20 border-amber-500/30';
    case 'Needs Review': return 'bg-red-500/20 border-red-500/30';
    case 'Empty': return 'bg-zinc-500/20 border-zinc-500/30';
  }
}

/**
 * Get tag display info
 */
export function getTagInfo(tag: QualityTag): { label: string; color: string; icon: string; description: string } {
  switch (tag) {
    case 'H': return { label: 'Human', color: 'text-emerald-400 bg-emerald-500/20', icon: '✍️', description: 'Translated or edited by a human' };
    case 'V': return { label: 'Validated', color: 'text-blue-400 bg-blue-500/20', icon: '✅', description: 'AI translation approved by a human' };
    case 'A': return { label: 'AI', color: 'text-amber-400 bg-amber-500/20', icon: '🤖', description: 'Machine translated, not reviewed' };
    case 'C': return { label: 'Captured', color: 'text-zinc-400 bg-zinc-500/20', icon: '📋', description: 'Source text captured, not yet translated' };
  }
}

/**
 * Calculate full stats from entries
 */
export function calculateStats(entries: Record<string, TranslationEntry>): QualityStats {
  let human = 0, validated = 0, ai = 0, captured = 0;

  for (const entry of Object.values(entries)) {
    switch (entry.tag) {
      case 'H': human++; break;
      case 'V': validated++; break;
      case 'A': ai++; break;
      case 'C': captured++; break;
    }
  }

  const total = human + validated + ai + captured;
  const translated = human + validated + ai;
  const score = calculateQualityScore(human, validated, ai);
  const label = getQualityLabel(score);
  const completionPercent = total > 0 ? Math.round((translated / total) * 100) : 0;

  return { human, validated, ai, captured, total, translated, score, label, completionPercent };
}

// ─── Entry Management ────────────────────────────────────────

/**
 * Create a new AI translation entry
 */
export function createAIEntry(sourceText: string, translatedText: string, aiModel?: string): TranslationEntry {
  return {
    sourceText,
    translatedText,
    tag: 'A',
    updatedAt: new Date().toISOString(),
    editedBy: 'ai',
    aiModel,
    editCount: 0,
  };
}

/**
 * Create a captured (untranslated) entry
 */
export function createCapturedEntry(sourceText: string): TranslationEntry {
  return {
    sourceText,
    translatedText: '',
    tag: 'C',
    updatedAt: new Date().toISOString(),
    editCount: 0,
  };
}

/**
 * Mark an entry as human-edited
 */
export function markAsHuman(entry: TranslationEntry, newText: string, editor?: string): TranslationEntry {
  return {
    ...entry,
    translatedText: newText,
    tag: 'H',
    updatedAt: new Date().toISOString(),
    editedBy: editor || 'user',
    editCount: entry.editCount + 1,
  };
}

/**
 * Mark an AI entry as validated (approved without changes)
 */
export function markAsValidated(entry: TranslationEntry, reviewer?: string): TranslationEntry {
  return {
    ...entry,
    tag: 'V',
    updatedAt: new Date().toISOString(),
    editedBy: reviewer || 'user',
    editCount: entry.editCount,
  };
}

/**
 * Determine what tag to assign based on action
 */
export function determineTag(
  currentTag: QualityTag,
  action: 'ai_translate' | 'human_edit' | 'validate' | 'capture'
): QualityTag {
  switch (action) {
    case 'ai_translate': return 'A';
    case 'human_edit': return 'H';
    case 'validate': return currentTag === 'A' ? 'V' : currentTag;
    case 'capture': return 'C';
  }
}

// ─── Project Storage ─────────────────────────────────────────

class QualityScoringService {
  private projects: Map<string, TranslationProject> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.projects = new Map(Object.entries(data));
      }
    } catch (e) {
      console.error('[QualityScoring] Error loading:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.projects)));
    } catch (e) {
      console.error('[QualityScoring] Error saving:', e);
    }
  }

  /**
   * Get or create a project
   */
  getProject(projectId: string): TranslationProject | undefined {
    return this.projects.get(projectId);
  }

  /**
   * List all projects
   */
  listProjects(): TranslationProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Create a new project
   */
  createProject(
    gameName: string,
    sourceLanguage: string,
    targetLanguage: string,
    author: string,
    gameAppId?: number
  ): TranslationProject {
    const id = `${gameName.toLowerCase().replace(/\s+/g, '-')}-${targetLanguage}-${Date.now()}`;
    const project: TranslationProject = {
      id,
      gameName,
      gameAppId,
      sourceLanguage,
      targetLanguage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author,
      entries: {},
      stats: { human: 0, validated: 0, ai: 0, captured: 0, total: 0, translated: 0, score: 0, label: 'Empty', completionPercent: 0 },
    };
    this.projects.set(id, project);
    this.saveToStorage();
    return project;
  }

  /**
   * Add or update entries in a project
   */
  updateEntries(projectId: string, entries: Record<string, TranslationEntry>): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.entries = { ...project.entries, ...entries };
    project.stats = calculateStats(project.entries);
    project.updatedAt = new Date().toISOString();

    this.projects.set(projectId, project);
    this.saveToStorage();
  }

  /**
   * Batch import: add AI translations
   */
  importAITranslations(
    projectId: string,
    translations: { source: string; translated: string }[],
    aiModel?: string
  ): number {
    const project = this.projects.get(projectId);
    if (!project) return 0;

    let added = 0;
    for (const { source, translated } of translations) {
      const key = source;
      if (!project.entries[key]) {
        project.entries[key] = createAIEntry(source, translated, aiModel);
        added++;
      }
    }

    project.stats = calculateStats(project.entries);
    project.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return added;
  }

  /**
   * Batch validate: mark all AI entries as validated
   */
  batchValidate(projectId: string, keys?: string[]): number {
    const project = this.projects.get(projectId);
    if (!project) return 0;

    let validated = 0;
    const targetKeys = keys || Object.keys(project.entries);
    
    for (const key of targetKeys) {
      const entry = project.entries[key];
      if (entry && entry.tag === 'A') {
        project.entries[key] = markAsValidated(entry);
        validated++;
      }
    }

    project.stats = calculateStats(project.entries);
    project.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return validated;
  }

  /**
   * Delete a project
   */
  deleteProject(projectId: string): boolean {
    const result = this.projects.delete(projectId);
    if (result) this.saveToStorage();
    return result;
  }

  /**
   * Export project data (for sharing)
   */
  exportProject(projectId: string): string | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    return JSON.stringify(project, null, 2);
  }

  /**
   * Import project data
   */
  importProject(data: string): TranslationProject | null {
    try {
      const project = JSON.parse(data) as TranslationProject;
      if (!project.id || !project.entries) return null;
      
      project.stats = calculateStats(project.entries);
      this.projects.set(project.id, project);
      this.saveToStorage();
      return project;
    } catch {
      return null;
    }
  }

  /**
   * Get global stats across all projects
   */
  getGlobalStats(): { projects: number; totalEntries: number; avgScore: number; avgLabel: QualityLabel } {
    const projects = this.listProjects();
    const totalEntries = projects.reduce((sum, p) => sum + p.stats.total, 0);
    const avgScore = projects.length > 0
      ? projects.reduce((sum, p) => sum + p.stats.score, 0) / projects.length
      : 0;

    return {
      projects: projects.length,
      totalEntries,
      avgScore: Math.round(avgScore * 10) / 10,
      avgLabel: getQualityLabel(avgScore),
    };
  }
}

// Singleton
export const qualityScoringService = new QualityScoringService();
