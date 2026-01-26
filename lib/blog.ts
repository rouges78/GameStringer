// Mini Blog System per GameStringer

export interface BlogPost {
  id: string;
  date: string;
  title: string;
  description: string;
  tag: string;
  pinned?: boolean;
  createdAt: number;
}

const BLOG_STORAGE_KEY = 'gamestringer_blog_posts';

// Post di default
const defaultPosts: BlogPost[] = [
  { 
    id: '1', 
    date: '24 Gen', 
    title: '🎮 Steam OpenID automatico', 
    description: 'Login Steam con callback locale come Fanatical', 
    tag: 'Feature',
    pinned: true,
    createdAt: Date.now() 
  },
  { 
    id: '2', 
    date: '23 Gen', 
    title: '🌍 Community Hub rinnovato', 
    description: 'Nuova UI arancione, card compatte', 
    tag: 'UI',
    createdAt: Date.now() - 86400000 
  },
  { 
    id: '3', 
    date: '22 Gen', 
    title: '🔐 Recovery Key System', 
    description: '12 parole mnemoniche per recupero password', 
    tag: 'Security',
    createdAt: Date.now() - 172800000 
  },
  { 
    id: '4', 
    date: '21 Gen', 
    title: '🧠 Neural Translator Pro', 
    description: 'Traduzione AI con emotion-aware', 
    tag: 'AI',
    createdAt: Date.now() - 259200000 
  },
];

export const blogService = {
  getPosts(): BlogPost[] {
    if (typeof window === 'undefined') return defaultPosts;
    
    const stored = localStorage.getItem(BLOG_STORAGE_KEY);
    if (!stored) {
      // Inizializza con post di default
      localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(defaultPosts));
      return defaultPosts;
    }
    
    try {
      return JSON.parse(stored);
    } catch {
      return defaultPosts;
    }
  },

  addPost(post: Omit<BlogPost, 'id' | 'createdAt'>): BlogPost {
    const posts = this.getPosts();
    const newPost: BlogPost = {
      ...post,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    posts.unshift(newPost);
    localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
    return newPost;
  },

  updatePost(id: string, updates: Partial<BlogPost>): boolean {
    const posts = this.getPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    posts[index] = { ...posts[index], ...updates };
    localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
    return true;
  },

  deletePost(id: string): boolean {
    const posts = this.getPosts();
    const filtered = posts.filter(p => p.id !== id);
    if (filtered.length === posts.length) return false;
    
    localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(filtered));
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
  }
};
