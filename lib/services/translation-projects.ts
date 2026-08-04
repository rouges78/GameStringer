'use client';

import { get, set } from 'idb-keyval';
import { getSupabase } from '@/lib/social/community-hub-backend';
import { clientLogger } from '@/lib/client-logger';
import { gamePathKey as normalizePathKey } from '@/lib/game-path';

export interface TranslationProject {
  id: string;
  gameId: string;
  gameName: string;
  /**
   * Chiave identità derivata dal percorso di installazione (lib/game-path.ts).
   * Aggiunta 04/08/2026: i chiamanti inventavano gameId diversi per lo stesso
   * gioco (id di libreria, `vis-<path>` dal backfill, gamePathKey dal fallback
   * hero) e findProject — che confronta solo gameId+lingua — non li vedeva come
   * lo stesso progetto: due schede per Foolish Mortals, contatore che sommava.
   * Il percorso su disco è l'unica identità che tutti i chiamanti condividono.
   */
  gamePathKey?: string;
  gameImage?: string;
  engine?: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  progress: number; // 0-100
  totalStrings: number;
  translatedStrings: number;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  // Community sync
  isShared: boolean;
  sharedBy?: string; // user id
  sharedByName?: string;
  collaborators?: string[]; // user ids
  supabaseId?: string; // ID in Supabase for sync
}

export interface ProjectFile {
  path: string;
  name: string;
  type: string;
  totalStrings: number;
  translatedStrings: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface CommunityProject {
  id: string;
  gameId: string;
  gameName: string;
  gameImage?: string;
  sourceLanguage: string;
  targetLanguage: string;
  progress: number;
  sharedBy: string;
  sharedByName: string;
  sharedByAvatar?: string;
  collaboratorsCount: number;
  updatedAt: string;
}

const PROJECTS_KEY = 'gs_translation_projects';
const ACTIVE_PROJECT_KEY = 'gs_active_project';

class TranslationProjectService {
  private async getSupabaseClient() {
    return await getSupabase();
  }

  /**
   * Crea automaticamente un progetto quando inizia una traduzione
   */
  async createOrGetProject(params: {
    gameId: string;
    gameName: string;
    gameImage?: string;
    engine?: string;
    sourceLanguage: string;
    targetLanguage: string;
    gamePathKey?: string;
    files?: { path: string; name: string; type: string; strings: number }[];
  }): Promise<TranslationProject> {
    // Cerca progetto esistente per questo gioco + lingua. Il percorso, se
    // fornito, vale quanto il gameId: due chiamanti con id diversi ma stesso
    // path stanno parlando dello stesso gioco.
    const existing = await this.findProject(params.gameId, params.targetLanguage, params.gamePathKey);

    if (existing) {
      clientLogger.debug(`[Projects] Progetto esistente trovato: ${existing.id}`);
      // Aggiorna lastActivityAt
      existing.lastActivityAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      if (existing.status === 'paused' || existing.status === 'abandoned') {
        existing.status = 'active';
      }
      // Arricchisci l'identità invece di duplicarla: se il progetto era nato
      // dal backfill (gameId sintetico `vis-...`) e ora arriva l'id vero di
      // libreria, adottalo — con nome e copertina, che sono migliori.
      if (params.gamePathKey && !existing.gamePathKey) {
        existing.gamePathKey = params.gamePathKey;
      }
      if (existing.gameId.startsWith('vis-') && !params.gameId.startsWith('vis-')) {
        existing.gameId = params.gameId;
        existing.gameName = params.gameName;
        if (params.gameImage) existing.gameImage = params.gameImage;
      }
      await this.saveProject(existing);
      await this.setActiveProject(existing.id);
      return existing;
    }

    // Crea nuovo progetto
    const project: TranslationProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      gameId: params.gameId,
      gamePathKey: params.gamePathKey,
      gameName: params.gameName,
      gameImage: params.gameImage,
      engine: params.engine,
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      status: 'active',
      progress: 0,
      totalStrings: params.files?.reduce((sum, f) => sum + f.strings, 0) || 0,
      translatedStrings: 0,
      files: params.files?.map(f => ({
        path: f.path,
        name: f.name,
        type: f.type,
        totalStrings: f.strings,
        translatedStrings: 0,
        status: 'pending' as const
      })) || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      isShared: false
    };

    await this.saveProject(project);
    await this.setActiveProject(project.id);
    
    clientLogger.debug(`[Projects] Nuovo progetto creato: ${project.id} per ${params.gameName}`);
    
    // Notifica UI
    window.dispatchEvent(new CustomEvent('gs-project-created', { detail: project }));
    
    return project;
  }

  /**
   * Trova un progetto esistente
   */
  async findProject(gameId: string, targetLanguage: string, pathKey?: string): Promise<TranslationProject | null> {
    const projects = await this.getAllProjects();
    return projects.find(p =>
      p.targetLanguage === targetLanguage &&
      p.status !== 'abandoned' &&
      (p.gameId === gameId ||
        // Stesso percorso su disco = stesso gioco, qualunque sia il gameId.
        // effectivePathKey copre anche i record vecchi senza campo gamePathKey.
        (!!pathKey && this.effectivePathKey(p) === pathKey))
    ) || null;
  }

  /**
   * Chiave-percorso di un progetto, ricostruita anche per i record storici:
   * (1) campo esplicito; (2) gameId sintetico `vis-<pathKey>` del backfill
   * (che dentro ha già la chiave normalizzata); (3) path del primo file,
   * che i chiamanti Visionaire/hero hanno sempre valorizzato con gamePath.
   */
  private effectivePathKey(p: TranslationProject): string | null {
    if (p.gamePathKey) return p.gamePathKey;
    if (p.gameId.startsWith('vis-')) return p.gameId.slice(4);
    const filePath = p.files?.[0]?.path;
    if (filePath && /[\\/]/.test(filePath)) return normalizePathKey(filePath);
    return null;
  }

  /**
   * Fonde i progetti duplicati nati PRIMA dell'identità per percorso
   * (04/08/2026): stesso gioco+lingua registrato con gameId diversi.
   * Vince il record con l'id di libreria (non `vis-`); i contatori prendono
   * il massimo, non la somma — sommarli era esattamente la bugia del
   * contatore in pagina Progetti. Ritorna quanti duplicati ha rimosso.
   */
  async mergeDuplicateProjects(): Promise<number> {
    const projects = await this.getAllProjects();
    const byIdentity = new Map<string, TranslationProject[]>();
    for (const p of projects) {
      if (p.status === 'abandoned') continue;
      const pk = this.effectivePathKey(p);
      if (!pk) continue; // senza percorso non c'è prova che siano lo stesso gioco
      const identity = `${pk}|${p.targetLanguage}`;
      const group = byIdentity.get(identity) || [];
      group.push(p);
      byIdentity.set(identity, group);
    }

    let removed = 0;
    let survivors = projects;
    for (const group of byIdentity.values()) {
      if (group.length < 2) continue;
      // Il migliore: id non sintetico prima, poi il più recente.
      const winner = [...group].sort((a, b) => {
        const aVis = a.gameId.startsWith('vis-') ? 1 : 0;
        const bVis = b.gameId.startsWith('vis-') ? 1 : 0;
        if (aVis !== bVis) return aVis - bVis;
        return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
      })[0];

      for (const loser of group) {
        if (loser.id === winner.id) continue;
        winner.totalStrings = Math.max(winner.totalStrings, loser.totalStrings);
        winner.translatedStrings = Math.max(winner.translatedStrings, loser.translatedStrings);
        winner.gamePathKey = winner.gamePathKey || this.effectivePathKey(winner) || undefined;
        winner.isShared = winner.isShared || loser.isShared;
        winner.supabaseId = winner.supabaseId || loser.supabaseId;
        survivors = survivors.filter(p => p.id !== loser.id);
        removed++;
        clientLogger.debug(`[Projects] Duplicato fuso: ${loser.id} (${loser.gameId}) → ${winner.id} (${winner.gameId})`);
      }
      winner.progress = winner.totalStrings > 0
        ? Math.min(100, Math.round((winner.translatedStrings / winner.totalStrings) * 100))
        : winner.progress;
      winner.updatedAt = new Date().toISOString();
    }

    if (removed > 0) {
      await set(PROJECTS_KEY, survivors);
    }
    return removed;
  }

  /**
   * Ottieni tutti i progetti
   */
  async getAllProjects(): Promise<TranslationProject[]> {
    try {
      const projects = await get<TranslationProject[]>(PROJECTS_KEY);
      return projects || [];
    } catch {
      return [];
    }
  }

  /**
   * Salva un progetto
   */
  async saveProject(project: TranslationProject): Promise<void> {
    const projects = await this.getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.unshift(project); // Aggiungi in cima
    }
    
    await set(PROJECTS_KEY, projects);
  }

  /**
   * Aggiorna progresso di un progetto
   */
  async updateProgress(projectId: string, translatedStrings: number, fileProgress?: { path: string; translated: number }): Promise<void> {
    const projects = await this.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) return;

    project.translatedStrings = translatedStrings;
    project.progress = project.totalStrings > 0 
      ? Math.round((translatedStrings / project.totalStrings) * 100) 
      : 0;
    project.updatedAt = new Date().toISOString();
    project.lastActivityAt = new Date().toISOString();

    if (fileProgress) {
      const file = project.files.find(f => f.path === fileProgress.path);
      if (file) {
        file.translatedStrings = fileProgress.translated;
        file.status = file.translatedStrings >= file.totalStrings ? 'completed' : 'in_progress';
      }
    }

    if (project.progress >= 100) {
      project.status = 'completed';
    }

    await this.saveProject(project);
    
    // Notifica UI
    window.dispatchEvent(new CustomEvent('gs-project-updated', { detail: project }));
  }

  /**
   * Imposta progetto attivo
   */
  async setActiveProject(projectId: string): Promise<void> {
    await set(ACTIVE_PROJECT_KEY, projectId);
  }

  /**
   * Ottieni progetto attivo
   */
  async getActiveProject(): Promise<TranslationProject | null> {
    const activeId = await get<string>(ACTIVE_PROJECT_KEY);
    if (!activeId) return null;
    
    const projects = await this.getAllProjects();
    return projects.find(p => p.id === activeId) || null;
  }

  /**
   * Condividi progetto con la community
   */
  async shareProject(projectId: string): Promise<boolean> {
    try {
      const project = (await this.getAllProjects()).find(p => p.id === projectId);
      if (!project) return false;

      const supabase = await this.getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clientLogger.warn('[Projects] Utente non autenticato, impossibile condividere');
        return false;
      }

      // Inserisci in Supabase
      const { data, error } = await supabase
        .from('translation_projects')
        .upsert({
          game_id: project.gameId,
          game_name: project.gameName,
          game_image: project.gameImage,
          source_language: project.sourceLanguage,
          target_language: project.targetLanguage,
          progress: project.progress,
          total_strings: project.totalStrings,
          translated_strings: project.translatedStrings,
          status: project.status,
          shared_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'game_id,target_language,shared_by'
        })
        .select()
        .single();

      if (error) {
        clientLogger.error('[Projects] Errore condivisione:', error);
        return false;
      }

      // Aggiorna locale
      project.isShared = true;
      project.sharedBy = user.id;
      project.supabaseId = data.id;
      await this.saveProject(project);

      clientLogger.debug(`[Projects] Progetto condiviso: ${project.gameName}`);
      return true;
    } catch (e) {
      clientLogger.error('[Projects] Errore condivisione:', e);
      return false;
    }
  }

  /**
   * Cerca progetti della community per un gioco
   */
  async findCommunityProjects(gameId: string, targetLanguage?: string): Promise<CommunityProject[]> {
    try {
      const supabase = await this.getSupabaseClient();
      let query = supabase
        .from('translation_projects')
        .select(`
          id,
          game_id,
          game_name,
          game_image,
          source_language,
          target_language,
          progress,
          shared_by,
          updated_at,
          profiles!shared_by (
            display_name,
            avatar_url
          )
        `)
        .eq('game_id', gameId)
        .order('progress', { ascending: false });

      if (targetLanguage) {
        query = query.eq('target_language', targetLanguage);
      }

      const { data, error } = await query;

      if (error) {
        clientLogger.error('[Projects] Errore ricerca community:', error);
        return [];
      }

      return (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        gameId: p.game_id as string,
        gameName: p.game_name as string,
        gameImage: p.game_image as string | undefined,
        sourceLanguage: p.source_language as string,
        targetLanguage: p.target_language as string,
        progress: p.progress as number,
        sharedBy: p.shared_by as string,
        sharedByName: (p.profiles as Record<string, unknown>)?.display_name as string || 'Anonimo',
        sharedByAvatar: (p.profiles as Record<string, unknown>)?.avatar_url as string | undefined,
        collaboratorsCount: 0,
        updatedAt: p.updated_at as string
      }));
    } catch (e) {
      clientLogger.error('[Projects] Errore ricerca community:', e);
      return [];
    }
  }

  /**
   * Verifica se qualcuno sta già traducendo questo gioco
   */
  async checkExistingTranslation(gameId: string, targetLanguage: string): Promise<CommunityProject | null> {
    const projects = await this.findCommunityProjects(gameId, targetLanguage);
    // Ritorna il progetto più avanzato
    return projects.length > 0 ? projects[0] : null;
  }

  /**
   * Elimina un progetto
   */
  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getAllProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await set(PROJECTS_KEY, filtered);
    
    // Rimuovi da Supabase se condiviso
    const project = projects.find(p => p.id === projectId);
    if (project?.supabaseId) {
      const supabase = await this.getSupabaseClient();
      await supabase
        .from('translation_projects')
        .delete()
        .eq('id', project.supabaseId);
    }
  }

  /**
   * Abbandona un progetto (non lo elimina, lo marca come abbandonato)
   */
  async abandonProject(projectId: string): Promise<void> {
    const projects = await this.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      project.status = 'abandoned';
      project.updatedAt = new Date().toISOString();
      await this.saveProject(project);
    }
  }

  /**
   * Metti in pausa un progetto
   */
  async pauseProject(projectId: string): Promise<void> {
    const projects = await this.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      project.status = 'paused';
      project.updatedAt = new Date().toISOString();
      await this.saveProject(project);
    }
  }
}

export const projectService = new TranslationProjectService();
