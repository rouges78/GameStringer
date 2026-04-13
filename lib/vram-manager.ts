import { safeGetItem, safeSetItem } from './safe-storage';
import { clientLogger } from '@/lib/client-logger';

const VRAM_CONFIG_KEY = 'vram_manager_config';
const POLL_INTERVAL_MS = 10_000; // Poll ogni 10 secondi

// ═══════════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════════

export interface SystemStats {
  cpu_usage_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_usage_percent: number;
  gpu_name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  vram_usage_percent: number;
  gpu_temp_celsius: number | null;
  gpu_available: boolean;
  warning: string | null;
}

export type VramTier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal' | 'cloud';

export interface ModelRecommendation {
  tier: VramTier;
  localModel: string | null;
  localModelSize: string;
  cloudFallback: string;
  reason: string;
  maxConcurrentBatches: number;
  batchSize: number;
}

export interface VramConfig {
  enabled: boolean;
  autoSwitch: boolean;
  thresholds: {
    ultra: number;   // VRAM free >= 12GB → modelli 70B/30B
    high: number;    // VRAM free >= 8GB  → modelli 13B
    medium: number;  // VRAM free >= 4GB  → modelli 7B
    low: number;     // VRAM free >= 2GB  → modelli 2B/3B
    minimal: number; // VRAM free < 2GB   → cloud only
  };
  preferLocalModels: boolean;
  cloudProvider: 'openai' | 'claude' | 'deepseek' | 'auto';
  alertOnHighUsage: boolean;
  alertThresholdPercent: number;
}

export interface VramSnapshot {
  timestamp: number;
  vramUsedMb: number;
  vramFreeMb: number;
  vramPercent: number;
  ramUsedMb: number;
  ramPercent: number;
  tier: VramTier;
  activeModel: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAZIONE DEFAULT
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: VramConfig = {
  enabled: true,
  autoSwitch: true,
  thresholds: {
    ultra: 12288,   // 12 GB
    high: 8192,     // 8 GB
    medium: 4096,   // 4 GB
    low: 2048,      // 2 GB
    minimal: 0,
  },
  preferLocalModels: true,
  cloudProvider: 'auto',
  alertOnHighUsage: true,
  alertThresholdPercent: 85,
};

// Mappa tier → modello consigliato
const TIER_MODELS: Record<VramTier, ModelRecommendation> = {
  ultra: {
    tier: 'ultra',
    localModel: 'qwen2.5:32b',
    localModelSize: '32B',
    cloudFallback: 'gpt-4o',
    reason: 'VRAM abbondante (≥12GB): modelli grandi per massima qualità',
    maxConcurrentBatches: 4,
    batchSize: 50,
  },
  high: {
    tier: 'high',
    localModel: 'qwen2.5:14b',
    localModelSize: '14B',
    cloudFallback: 'gpt-4o-mini',
    reason: 'VRAM buona (≥8GB): modelli medi, buon bilanciamento qualità/velocità',
    maxConcurrentBatches: 3,
    batchSize: 30,
  },
  medium: {
    tier: 'medium',
    localModel: 'qwen2.5:7b',
    localModelSize: '7B',
    cloudFallback: 'gpt-4o-mini',
    reason: 'VRAM media (≥4GB): modelli 7B, qualità decente',
    maxConcurrentBatches: 2,
    batchSize: 20,
  },
  low: {
    tier: 'low',
    localModel: 'qwen2.5:3b',
    localModelSize: '3B',
    cloudFallback: 'deepseek-chat',
    reason: 'VRAM limitata (<4GB): modelli piccoli, velocità prioritaria',
    maxConcurrentBatches: 1,
    batchSize: 10,
  },
  minimal: {
    tier: 'minimal',
    localModel: null,
    localModelSize: '-',
    cloudFallback: 'deepseek-chat',
    reason: 'VRAM insufficiente (<2GB): solo provider cloud',
    maxConcurrentBatches: 2,
    batchSize: 25,
  },
  cloud: {
    tier: 'cloud',
    localModel: null,
    localModelSize: '-',
    cloudFallback: 'gpt-4o-mini',
    reason: 'GPU non disponibile: solo provider cloud',
    maxConcurrentBatches: 3,
    batchSize: 30,
  },
};

// ═══════════════════════════════════════════════════════════════════
// VRAM MANAGER
// ═══════════════════════════════════════════════════════════════════

type VramEventType = 'stats-update' | 'tier-change' | 'model-switch' | 'alert';
type VramListener = (event: VramEventType, data: unknown) => void;

class VramManager {
  private config: VramConfig;
  private currentStats: SystemStats | null = null;
  private currentTier: VramTier = 'cloud';
  private currentModel: string | null = null;
  private history: VramSnapshot[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: VramListener[] = [];
  private invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

  constructor() {
    this.config = this.loadConfig();
  }

  // ── Inizializzazione ──

  /** Inizializza il manager con il riferimento a Tauri invoke */
  async init(): Promise<void> {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.invoke = invoke;
      } catch {
        this.invoke = null;
      }
    }

    // Prima lettura
    await this.poll();

    // Start polling
    if (this.config.enabled) {
      this.startPolling();
    }
  }

  /** Ferma il polling */
  destroy(): void {
    this.stopPolling();
    this.listeners = [];
  }

  // ── Config ──

  getConfig(): VramConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<VramConfig>): void {
    this.config = { ...this.config, ...partial };
    safeSetItem(VRAM_CONFIG_KEY, this.config);

    if (this.config.enabled && !this.pollTimer) {
      this.startPolling();
    } else if (!this.config.enabled && this.pollTimer) {
      this.stopPolling();
    }
  }

  private loadConfig(): VramConfig {
    const saved = safeGetItem<VramConfig>(VRAM_CONFIG_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...saved } : { ...DEFAULT_CONFIG };
  }

  // ── Polling ──

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Esegue una singola lettura */
  async poll(): Promise<SystemStats | null> {
    if (!this.invoke) return null;

    try {
      const stats = await this.invoke('get_system_stats') as SystemStats;
      this.currentStats = stats;

      const prevTier = this.currentTier;
      this.currentTier = this.calculateTier(stats);

      // Snapshot per cronologia
      const snapshot: VramSnapshot = {
        timestamp: Date.now(),
        vramUsedMb: stats.vram_used_mb,
        vramFreeMb: stats.vram_free_mb,
        vramPercent: stats.vram_usage_percent,
        ramUsedMb: stats.ram_used_mb,
        ramPercent: stats.ram_usage_percent,
        tier: this.currentTier,
        activeModel: this.currentModel,
      };
      this.history.push(snapshot);
      if (this.history.length > 360) this.history = this.history.slice(-180); // max 30 min

      this.emit('stats-update', { stats, snapshot });

      // Tier cambiato?
      if (prevTier !== this.currentTier) {
        const rec = this.getRecommendation();
        this.currentModel = rec.localModel;
        this.emit('tier-change', { from: prevTier, to: this.currentTier, recommendation: rec });
        if (this.config.autoSwitch) {
          this.emit('model-switch', rec);
        }
      }

      // Alert alta VRAM
      if (this.config.alertOnHighUsage && stats.gpu_available && stats.vram_usage_percent >= this.config.alertThresholdPercent) {
        this.emit('alert', {
          type: 'vram-high',
          percent: stats.vram_usage_percent,
          message: `VRAM al ${stats.vram_usage_percent.toFixed(0)}% — ${stats.vram_free_mb}MB liberi`,
        });
      }

      return stats;
    } catch (e: unknown) {
      clientLogger.warn('[VramManager] Poll failed:', e);
      return null;
    }
  }

  // ── Tier & Raccomandazioni ──

  private calculateTier(stats: SystemStats): VramTier {
    if (!stats.gpu_available) return 'cloud';

    const freeMb = stats.vram_free_mb;
    const t = this.config.thresholds;

    if (freeMb >= t.ultra) return 'ultra';
    if (freeMb >= t.high) return 'high';
    if (freeMb >= t.medium) return 'medium';
    if (freeMb >= t.low) return 'low';
    return 'minimal';
  }

  /** Ottieni raccomandazione modello per il tier corrente */
  getRecommendation(): ModelRecommendation {
    return { ...TIER_MODELS[this.currentTier] };
  }

  /** Ottieni raccomandazione per un tier specifico */
  getRecommendationForTier(tier: VramTier): ModelRecommendation {
    return { ...TIER_MODELS[tier] };
  }

  /** Ottieni il modello da usare (locale o cloud) */
  getActiveModel(): { provider: 'local' | 'cloud'; model: string; tier: VramTier } {
    const rec = this.getRecommendation();

    if (this.config.preferLocalModels && rec.localModel) {
      return { provider: 'local', model: rec.localModel, tier: rec.tier };
    }

    return { provider: 'cloud', model: rec.cloudFallback, tier: rec.tier };
  }

  // ── Getters ──

  getCurrentStats(): SystemStats | null { return this.currentStats; }
  getCurrentTier(): VramTier { return this.currentTier; }
  getHistory(): VramSnapshot[] { return [...this.history]; }

  /** Info rapida per UI */
  getStatusSummary(): {
    tier: VramTier;
    vramPercent: number;
    ramPercent: number;
    gpuName: string;
    model: { provider: 'local' | 'cloud'; model: string };
    warning: string | null;
  } {
    const stats = this.currentStats;
    const active = this.getActiveModel();
    return {
      tier: this.currentTier,
      vramPercent: stats?.vram_usage_percent ?? 0,
      ramPercent: stats?.ram_usage_percent ?? 0,
      gpuName: stats?.gpu_name ?? 'N/A',
      model: { provider: active.provider, model: active.model },
      warning: stats?.warning ?? null,
    };
  }

  // ── Events ──

  on(listener: VramListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: VramEventType, data: unknown): void {
    this.listeners.forEach(l => {
      try { l(event, data); } catch {}
    });
  }
}

// ── Singleton ──
export const vramManager = new VramManager();
