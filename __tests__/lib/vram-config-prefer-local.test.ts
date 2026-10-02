import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeSetItem } from '@/lib/safe-storage';

// L'interruttore «preferisci modelli locali» non c'è più in Impostazioni: un
// false salvato prima non deve restare attivo senza modo di tornare indietro.
describe('vramManager config: preferLocalModels salvato', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('ignora un preferLocalModels=false salvato e conserva il resto', async () => {
    safeSetItem('vram_manager_config', { preferLocalModels: false, alertThresholdPercent: 70 });

    const { vramManager } = await import('@/lib/vram-manager');
    const config = vramManager.getConfig();

    expect(config.preferLocalModels).toBe(true);
    expect(config.alertThresholdPercent).toBe(70);
  });

  it('senza config salvata usa il default (true)', async () => {
    const { vramManager } = await import('@/lib/vram-manager');
    expect(vramManager.getConfig().preferLocalModels).toBe(true);
  });
});
