// Mini Blog / Devlog System per GameStringer
// Persistenza: Tauri filesystem (appdata/blog.json) con fallback localStorage
//
// In Tauri blog.json è la fonte autorevole e localStorage ne tiene una copia
// per le letture sincrone (dashboard). Prima localStorage veniva scritto solo
// se la scrittura del file falliva — cioè mai in Tauri — e la lettura
// sincrona guardava solo localStorage: al riavvio i post sparivano e il primo
// post nuovo sovrascriveva blog.json, cancellandoli davvero.

import { invoke, isTauri } from '@/lib/tauri-api';

export interface BlogPost {
  id: string;
  date: string;
  title: string;
  description: string;
  tag: string;
  pinned?: boolean;
  createdAt: number;
  image?: string;
  gameName?: string;
}

const BLOG_STORAGE_KEY = 'gamestringer_blog_posts';
const BLOG_FILENAME = 'blog.json';

// Valorizzata SOLO dalla fonte autorevole (loadPosts) o da un salvataggio
// riuscito: mai dalla lettura sincrona di localStorage, altrimenti un []
// letto lì nasconderebbe blog.json.
let _cachedPosts: BlogPost[] | null = null;
let _loading: Promise<BlogPost[]> | null = null;
// Le modifiche girano una alla volta: due click ravvicinati (es. pin) non
// devono partire dalla stessa lista né scrivere blog.json fuori ordine.
let _pending: Promise<unknown> = Promise.resolve();

async function readFromTauri(): Promise<BlogPost[] | null> {
  try {
    const content = await invoke<string>('read_app_data_file', { filename: BLOG_FILENAME });
    if (content) return JSON.parse(content);
  } catch {}
  return null;
}

async function writeToTauri(posts: BlogPost[]): Promise<boolean> {
  try {
    await invoke('write_app_data_file', { filename: BLOG_FILENAME, content: JSON.stringify(posts, null, 2) });
    return true;
  } catch {}
  return false;
}

function readFromLocalStorage(): BlogPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BLOG_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function writeToLocalStorage(posts: BlogPost[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
    return true;
  } catch {}
  return false;
}

async function loadPosts(): Promise<BlogPost[]> {
  if (_cachedPosts) return _cachedPosts;
  if (_loading) return _loading;

  _loading = (async () => {
    // Try Tauri first
    const tauriPosts = await readFromTauri();
    if (tauriPosts) {
      _cachedPosts = tauriPosts;
      // Copia per le letture sincrone
      writeToLocalStorage(tauriPosts);
      return tauriPosts;
    }

    // Fallback to localStorage
    const localPosts = readFromLocalStorage();
    _cachedPosts = localPosts;

    // Migrate localStorage to Tauri if posts exist
    if (localPosts.length > 0) {
      writeToTauri(localPosts).catch(() => {});
    }

    return localPosts;
  })();

  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

/** Ritorna true solo se i post sono stati salvati dove verranno riletti. */
async function savePosts(posts: BlogPost[]): Promise<boolean> {
  if (isTauri()) {
    if (!(await writeToTauri(posts))) return false;
    // Copia per le letture sincrone
    writeToLocalStorage(posts);
  } else if (!writeToLocalStorage(posts)) {
    return false;
  }
  _cachedPosts = posts;
  return true;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = _pending.then(task);
  _pending = run.catch(() => {});
  return run;
}

export const blogService = {
  getPosts(): BlogPost[] {
    // Sincrono — usa cache o la copia in localStorage, e avvia il caricamento
    // vero così la copia si riallinea a blog.json.
    if (_cachedPosts) return _cachedPosts;
    void loadPosts();
    return readFromLocalStorage();
  },

  async getPostsAsync(): Promise<BlogPost[]> {
    return loadPosts();
  },

  /** Ritorna null se il salvataggio è fallito. */
  addPost(post: Omit<BlogPost, 'id' | 'createdAt'>): Promise<BlogPost | null> {
    return enqueue(async () => {
      const posts = await loadPosts();
      const newPost: BlogPost = {
        ...post,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      return (await savePosts([newPost, ...posts])) ? newPost : null;
    });
  },

  /** Ritorna false se il post non esiste o il salvataggio è fallito. */
  updatePost(id: string, updates: Partial<BlogPost>): Promise<boolean> {
    return enqueue(async () => {
      const posts = await loadPosts();
      if (!posts.some(p => p.id === id)) return false;
      // Array nuovo, non mutato: React deve vedere il cambiamento (pin)
      return savePosts(posts.map(p => (p.id === id ? { ...p, ...updates } : p)));
    });
  },

  /** Ritorna false se il post non esiste o il salvataggio è fallito. */
  deletePost(id: string): Promise<boolean> {
    return enqueue(async () => {
      const posts = await loadPosts();
      const filtered = posts.filter(p => p.id !== id);
      if (filtered.length === posts.length) return false;
      return savePosts(filtered);
    });
  },

  getRecentPosts(limit: number = 5): BlogPost[] {
    const posts = this.getPosts();
    // Pinned first, then by date (su una copia: non riordinare la cache)
    return [...posts]
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
      })
      .slice(0, limit);
  },

  async init(): Promise<void> {
    await loadPosts();
  }
};

