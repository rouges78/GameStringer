// Mini Blog / Devlog System per GameStringer
// Persistenza: Tauri filesystem (appdata/blog.json) con fallback localStorage

import { invoke } from '@/lib/tauri-api';

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

let _cachedPosts: BlogPost[] | null = null;

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

function writeToLocalStorage(posts: BlogPost[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
  } catch {}
}

async function loadPosts(): Promise<BlogPost[]> {
  if (_cachedPosts) return _cachedPosts;

  // Try Tauri first
  const tauriPosts = await readFromTauri();
  if (tauriPosts) {
    _cachedPosts = tauriPosts;
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
}

async function savePosts(posts: BlogPost[]): Promise<void> {
  _cachedPosts = posts;
  const saved = await writeToTauri(posts);
  if (!saved) {
    writeToLocalStorage(posts);
  }
}

export const blogService = {
  getPosts(): BlogPost[] {
    // Sincrono — usa cache o localStorage
    if (_cachedPosts) return _cachedPosts;
    const local = readFromLocalStorage();
    _cachedPosts = local;
    return local;
  },

  async getPostsAsync(): Promise<BlogPost[]> {
    return loadPosts();
  },

  addPost(post: Omit<BlogPost, 'id' | 'createdAt'>): BlogPost {
    const posts = this.getPosts();
    const newPost: BlogPost = {
      ...post,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    posts.unshift(newPost);
    savePosts(posts);
    return newPost;
  },

  updatePost(id: string, updates: Partial<BlogPost>): boolean {
    const posts = this.getPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    posts[index] = { ...posts[index], ...updates };
    savePosts(posts);
    return true;
  },

  deletePost(id: string): boolean {
    const posts = this.getPosts();
    const filtered = posts.filter(p => p.id !== id);
    if (filtered.length === posts.length) return false;
    
    savePosts(filtered);
    return true;
  },

  getRecentPosts(limit: number = 5): BlogPost[] {
    const posts = this.getPosts();
    // Pinned first, then by date
    return posts
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
