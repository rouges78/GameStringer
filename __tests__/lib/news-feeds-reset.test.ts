/**
 * «Ripristina predefiniti» della scheda RSS delle Impostazioni riapplica
 * DEFAULT_FEED_SOURCES[].enabled con toggleSource. Il servizio partiva da
 * `[...DEFAULT_FEED_SOURCES]` (stessi oggetti) e toggleSource li modifica sul
 * posto: spegnere una fonte spegneva anche il suo default, e il ripristino
 * rimetteva lo stato modificato mostrando comunque «feed ripristinati».
 */
import { describe, it, expect } from 'vitest';
import { newsFeedService, DEFAULT_FEED_SOURCES } from '@/lib/news-feeds';

describe('newsFeedService: i default restano intatti', () => {
  it('spegnere una fonte non cambia DEFAULT_FEED_SOURCES, e il ripristino la riaccende', () => {
    const def = DEFAULT_FEED_SOURCES.find((s) => s.enabled);
    expect(def).toBeDefined();
    const id = def!.id;

    newsFeedService.toggleSource(id, false);
    expect(newsFeedService.getSources().find((s) => s.id === id)?.enabled).toBe(false);
    expect(DEFAULT_FEED_SOURCES.find((s) => s.id === id)?.enabled).toBe(true);

    // come handleResetNewsSources in app/settings/page.tsx
    for (const d of DEFAULT_FEED_SOURCES) newsFeedService.toggleSource(d.id, d.enabled);
    expect(newsFeedService.getSources().find((s) => s.id === id)?.enabled).toBe(true);
  });

  it('spegnere una categoria non cambia i default di quella categoria', () => {
    const before = DEFAULT_FEED_SOURCES.filter((s) => s.category === 'translations').map((s) => s.enabled);
    newsFeedService.toggleCategory('translations', false);
    const after = DEFAULT_FEED_SOURCES.filter((s) => s.category === 'translations').map((s) => s.enabled);
    expect(after).toEqual(before);
  });
});
