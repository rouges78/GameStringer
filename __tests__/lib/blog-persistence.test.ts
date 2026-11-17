/**
 * Persistenza delle news del blog (lib/blog.ts) in Tauri.
 *
 * Bug fissati qui:
 * 1. In Tauri i post andavano solo in blog.json, ma la lettura sincrona
 *    guardava solo localStorage: al riavvio la lista era vuota.
 * 2. Peggio: con la cache vuota il primo post nuovo riscriveva blog.json con
 *    [nuovoPost], cancellando davvero quelli vecchi.
 * 3. Il pin mutava l'array in cache e la pagina riceveva lo stesso
 *    riferimento: React non ri-renderizzava.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failWrites: false,
}));

vi.mock('@/lib/tauri-api', () => ({
  isTauri: () => true,
  invoke: vi.fn(async (cmd: string, args: { filename: string; content?: string }) => {
    if (cmd === 'read_app_data_file') {
      const content = h.files.get(args.filename);
      if (content === undefined) throw new Error(`File not found: ${args.filename}`);
      return content;
    }
    if (cmd === 'write_app_data_file') {
      if (h.failWrites) throw new Error('disk full');
      h.files.set(args.filename, args.content ?? '');
      return undefined;
    }
    throw new Error(`unexpected command ${cmd}`);
  }),
}));

/** Il modulo tiene la cache a livello di modulo: un import pulito = un riavvio dell'app. */
async function restartApp() {
  vi.resetModules();
  return (await import('@/lib/blog')).blogService;
}

function fileTitles(): string[] {
  return JSON.parse(h.files.get('blog.json') ?? '[]').map((p: { title: string }) => p.title);
}

const draft = (title: string) => ({ date: '1 Oct', title, description: '', tag: 'News' });

describe('blog: persistenza in Tauri', () => {
  beforeEach(() => {
    h.files.clear();
    h.failWrites = false;
  });

  it('i post sopravvivono al riavvio anche se localStorage è vuoto', async () => {
    let blog = await restartApp();
    expect(await blog.addPost(draft('Primo'))).not.toBeNull();

    // Stato reale dopo un riavvio con la versione vecchia: solo blog.json
    localStorage.removeItem('gamestringer_blog_posts');
    blog = await restartApp();

    expect((await blog.getPostsAsync()).map(p => p.title)).toEqual(['Primo']);
  });

  it('una lettura sincrona prima del caricamento non fa sovrascrivere blog.json', async () => {
    h.files.set('blog.json', JSON.stringify([{ id: 'a', date: '1', title: 'Vecchio', description: '', tag: 'News', createdAt: 1 }]));
    const blog = await restartApp();

    // La dashboard legge in modo sincrono prima che la pagina carichi
    blog.getRecentPosts(5);
    await blog.addPost(draft('Nuovo'));

    expect(fileTitles()).toEqual(['Nuovo', 'Vecchio']);
  });

  it('la copia in localStorage si riallinea a blog.json per le letture sincrone', async () => {
    h.files.set('blog.json', JSON.stringify([{ id: 'a', date: '1', title: 'Dal file', description: '', tag: 'News', createdAt: 1 }]));
    const blog = await restartApp();
    await blog.init();

    const copy = JSON.parse(localStorage.getItem('gamestringer_blog_posts') ?? '[]');
    expect(copy.map((p: { title: string }) => p.title)).toEqual(['Dal file']);
  });

  it('il pin produce un array nuovo (React ri-renderizza) senza mutare il precedente', async () => {
    const blog = await restartApp();
    const created = await blog.addPost(draft('Da fissare'));
    const before = await blog.getPostsAsync();

    expect(await blog.updatePost(created!.id, { pinned: true })).toBe(true);
    const after = await blog.getPostsAsync();

    expect(after).not.toBe(before);
    expect(after[0].pinned).toBe(true);
    expect(before[0].pinned).toBeUndefined();
  });

  it('se la scrittura di blog.json fallisce lo dice e non finge il salvataggio', async () => {
    const blog = await restartApp();
    await blog.addPost(draft('Salvato'));
    h.failWrites = true;

    expect(await blog.addPost(draft('Perso'))).toBeNull();
    expect((await blog.getPostsAsync()).map(p => p.title)).toEqual(['Salvato']);
    expect(fileTitles()).toEqual(['Salvato']);
  });

  it('due modifiche ravvicinate non si perdono a vicenda', async () => {
    const blog = await restartApp();
    await Promise.all([blog.addPost(draft('Uno')), blog.addPost(draft('Due'))]);

    expect(fileTitles().sort()).toEqual(['Due', 'Uno']);
  });

  it('getRecentPosts non riordina la cache', async () => {
    const blog = await restartApp();
    await blog.addPost(draft('Vecchio'));
    const fixed = await blog.addPost(draft('Nuovo'));
    await blog.updatePost((await blog.getPostsAsync())[1].id, { pinned: true });
    const cache = await blog.getPostsAsync();

    expect(blog.getRecentPosts(5)[0].title).toBe('Vecchio');
    expect(cache[0].id).toBe(fixed!.id);
  });
});
