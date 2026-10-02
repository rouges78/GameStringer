/**
 * Dati inventati e demo spacciate per reali (Fase 0, lotto L10).
 *
 * - /stats mostrava stringhe = traduzioni*150, parole = stringhe*8, lingue a
 *   percentuali fisse 70/15/10/5, 60% progetti "completati", 45 min a progetto
 *   e un avanzamento medio 65-85% a caso a ogni apertura.
 * - Il VR overlay faceva girare un setInterval vuoto e la UI diceva "avviato".
 * - Il tema scelto nel customizer non veniva riapplicato al riavvio.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Activity } from '@/lib/activity-history';

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const now = new Date(2026, 9, 1, 12, 0, 0);

function activity(over: Partial<Activity>): Activity {
  return {
    id: Math.random().toString(36).slice(2),
    activity_type: 'translation',
    title: 't',
    timestamp: new Date(2026, 9, 1, 10, 0, 0).toISOString(),
    ...over,
  };
}

describe('statistiche traduzione: solo dati reali', () => {
  const activities: Activity[] = [
    activity({ game_id: 'g1', metadata: { target_language: 'it' } }),
    activity({ game_id: 'g1', metadata: { target_language: 'IT' } }),
    activity({ game_id: 'g2' }), // nessuna lingua registrata
    activity({ activity_type: 'patch', game_id: 'g3' }),
  ];

  it('conta traduzioni, giochi e lingue registrate, senza stime', async () => {
    const { computeTranslationStats } = await import('@/components/dashboard/translation-stats-widget');
    const stats = computeTranslationStats(activities, now);

    expect(stats.totalTranslations).toBe(3);
    expect(stats.totalProjects).toBe(2);
    expect(stats.todayTranslations).toBe(3);
    expect(stats.topLanguages).toEqual([{ lang: 'Italiano', count: 2 }]);
    for (const invented of ['totalStrings', 'totalWords', 'averageProgress', 'completedProjects', 'estimatedTimeRemaining']) {
      expect(stats).not.toHaveProperty(invented);
    }
  });

  it('è deterministico: stessi dati, stessi numeri', async () => {
    const { computeTranslationStats } = await import('@/components/dashboard/translation-stats-widget');
    expect(computeTranslationStats(activities, now)).toEqual(computeTranslationStats(activities, now));
  });

  it('senza lingue nei metadata non inventa una ripartizione', async () => {
    const { computeTranslationStats } = await import('@/components/dashboard/translation-stats-widget');
    const stats = computeTranslationStats([activity({ game_id: 'g1' })], now);
    expect(stats.totalTranslations).toBe(1);
    expect(stats.topLanguages).toEqual([]);
  });
});

describe('VR overlay: nessun avvio finto', () => {
  it('start() dichiara di non essere partito e non lascia timer accesi', async () => {
    vi.useFakeTimers();
    try {
      const { vrOverlayService } = await import('@/lib/vr-overlay');
      expect(vrOverlayService.start()).toBe(false);
      expect(vrOverlayService.isActive()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('theme customizer: il tema salvato si riapplica all\'avvio', () => {
  it('applySavedCustomTheme imposta le variabili CSS dal tema salvato', async () => {
    const { applySavedCustomTheme } = await import('@/components/theme/theme-customizer');
    localStorage.setItem('gamestringer-custom-theme', JSON.stringify({
      id: 'cyberpunk',
      name: 'Cyberpunk 2077',
      preview: '',
      colors: {
        primary: '#ff0000',
        accent: '#00ff00',
        success: '#00ff9f',
        warning: '#ff6b00',
        destructive: '#ff0055',
        sidebar: '#0d0d1a',
        headerGradient: 'from-yellow-400 via-pink-500 to-purple-600',
      },
    }));

    applySavedCustomTheme();

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--primary')).toBe('0 100% 50%');
    expect(root.getPropertyValue('--accent')).toBe('120 100% 50%');
  });

  it('senza tema salvato (o con JSON rotto) non tocca nulla e non lancia', async () => {
    const { applySavedCustomTheme } = await import('@/components/theme/theme-customizer');
    document.documentElement.style.removeProperty('--primary');

    expect(() => applySavedCustomTheme()).not.toThrow();
    localStorage.setItem('gamestringer-custom-theme', '{rotto');
    expect(() => applySavedCustomTheme()).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });
});
