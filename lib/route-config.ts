/**
 * Configuration for route protection and navigation
 */

export interface RouteConfig {
  path: string;
  requireAuth: boolean;
  adminOnly?: boolean;
  title: string;
  description?: string;
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    requireAuth: true,
    title: 'Dashboard',
    description: 'Sistema di traduzione avanzato con intelligenza artificiale'
  },
  {
    path: '/library',
    requireAuth: true,
    title: 'Libreria Giochi',
    description: 'Gestisci la tua collezione di giochi'
  },
  {
    path: '/injekt-translator',
    requireAuth: true,
    title: 'Neural Translator',
    description: 'Traduzione automatica con AI'
  },
  {
    path: '/editor',
    requireAuth: true,
    title: 'Editor Traduzioni',
    description: 'Modifica e gestisci le traduzioni'
  },
  {
    path: '/dialogue-patcher',
    requireAuth: true,
    title: 'Dialogue Patcher',
    description: 'Applica patch ai dialoghi dei giochi'
  },
  {
    path: '/patches',
    requireAuth: true,
    title: 'Gestione Patch',
    description: 'Crea e gestisci patch per i giochi'
  },
  {
    path: '/store-manager',
    requireAuth: true,
    title: 'Store Manager',
    description: 'Gestisci connessioni agli store digitali'
  },
  {
    path: '/settings',
    requireAuth: true,
    title: 'Impostazioni',
    description: 'Configura GameStringer'
  },
  {
    path: '/admin',
    requireAuth: true,
    adminOnly: true,
    title: 'Amministrazione',
    description: 'Pannello di amministrazione'
  }
];

export const getRouteConfig = (path: string): RouteConfig | undefined => {
  return routes.find(route => route.path === path || path.startsWith(route.path + '/'));
};

export const isProtectedRoute = (path: string): boolean => {
  const config = getRouteConfig(path);
  return config?.requireAuth ?? false;
};

export const isAdminRoute = (path: string): boolean => {
  const config = getRouteConfig(path);
  return config?.adminOnly ?? false;
};

export const getRouteTitle = (path: string): string => {
  const config = getRouteConfig(path);
  return config?.title ?? 'GameStringer';
};

export const getRouteDescription = (path: string): string => {
  const config = getRouteConfig(path);
  return config?.description ?? 'Sistema di traduzione per videogiochi';
};