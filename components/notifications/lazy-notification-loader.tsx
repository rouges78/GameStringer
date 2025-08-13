'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Notification, NotificationFilter } from '@/types/notifications';
import { useNotificationsOptimized } from '@/hooks/use-notifications-optimized';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, Archive } from 'lucide-react';

interface LazyNotificationLoaderProps {
  profileId: string;
  initialPageSize?: number;
  maxPages?: number;
  filter?: NotificationFilter;
  onNotificationLoad?: (notifications: Notification[]) => void;
  className?: string;
}

interface LoadedPage {
  pageIndex: number;
  notifications: Notification[];
  timestamp: number;
}

export function LazyNotificationLoader({
  profileId,
  initialPageSize = 20,
  maxPages = 10,
  filter = {},
  onNotificationLoad,
  className = '',
}: LazyNotificationLoaderProps) {
  const [loadedPages, setLoadedPages] = useState<LoadedPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const cacheTimeoutRef = useRef<NodeJS.Timeout>();

  const { loadNotificationsPage } = useNotificationsOptimized({
    profileId,
    enableVirtualization: true,
  });

  // Memoizza tutte le notifiche caricate
  const allNotifications = useMemo(() => {
    return loadedPages
      .sort((a, b) => a.pageIndex - b.pageIndex)
      .flatMap(page => page.notifications);
  }, [loadedPages]);

  // Carica una pagina specifica
  const loadPage = useCallback(async (pageIndex: number) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const offset = pageIndex * initialPageSize;
      const notifications = await loadNotificationsPage(offset, initialPageSize, filter);
      
      if (notifications.length === 0) {
        setHasMore(false);
        return;
      }

      const newPage: LoadedPage = {
        pageIndex,
        notifications,
        timestamp: Date.now(),
      };

      setLoadedPages(prev => {
        // Rimuovi la pagina esistente se presente
        const filtered = prev.filter(p => p.pageIndex !== pageIndex);
        return [...filtered, newPage];
      });

      // Notifica il caricamento
      if (onNotificationLoad) {
        onNotificationLoad(notifications);
      }

      // Se la pagina è parzialmente piena, non ci sono più notifiche
      if (notifications.length < initialPageSize) {
        setHasMore(false);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento notifiche';
      setError(errorMessage);
      console.error('Errore caricamento pagina:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, initialPageSize, loadNotificationsPage, filter, onNotificationLoad]);

  // Carica la prossima pagina
  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || currentPage >= maxPages) return;
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadPage(nextPage);
  }, [hasMore, loading, currentPage, maxPages, loadPage]);

  // Intersection Observer per caricamento automatico
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          loadNextPage();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadNextPage]);

  // Caricamento iniziale
  useEffect(() => {
    if (loadedPages.length === 0) {
      loadPage(0);
      setCurrentPage(0);
    }
  }, [loadPage, loadedPages.length]);

  // Pulizia cache periodica
  useEffect(() => {
    const cleanupCache = () => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minuti

      setLoadedPages(prev => 
        prev.filter(page => (now - page.timestamp) < maxAge)
      );
    };

    cacheTimeoutRef.current = setInterval(cleanupCache, 5 * 60 * 1000); // Ogni 5 minuti

    return () => {
      if (cacheTimeoutRef.current) {
        clearInterval(cacheTimeoutRef.current);
      }
    };
  }, []);

  // Reset quando cambia il filtro
  useEffect(() => {
    setLoadedPages([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
  }, [filter, profileId]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Notifiche caricate */}
      <div className="space-y-2">
        {allNotifications.map((notification) => (
          <LazyNotificationItem
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>

      {/* Indicatore di caricamento */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            Caricamento notifiche...
          </span>
        </div>
      )}

      {/* Errore */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadPage(currentPage)}
            className="mt-2"
          >
            Riprova
          </Button>
        </div>
      )}

      {/* Pulsante carica altro */}
      {hasMore && !loading && currentPage < maxPages && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={loadNextPage}
            className="w-full"
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            Carica altre notifiche
          </Button>
        </div>
      )}

      {/* Elemento per intersection observer */}
      <div ref={loadMoreRef} className="h-1" />

      {/* Messaggio fine notifiche */}
      {!hasMore && allNotifications.length > 0 && (
        <div className="text-center py-8">
          <Archive className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hai raggiunto la fine delle notifiche
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {allNotifications.length} notifiche caricate
          </p>
        </div>
      )}

      {/* Messaggio nessuna notifica */}
      {!hasMore && allNotifications.length === 0 && !loading && (
        <div className="text-center py-8">
          <Archive className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nessuna notifica trovata
          </p>
        </div>
      )}

      {/* Limite pagine raggiunto */}
      {currentPage >= maxPages && hasMore && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Limite di caricamento raggiunto ({maxPages} pagine)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentPage(0);
              setLoadedPages([]);
              setHasMore(true);
              loadPage(0);
            }}
            className="mt-2"
          >
            Ricomincia dall'inizio
          </Button>
        </div>
      )}
    </div>
  );
}

// Componente per singola notifica lazy-loaded
const LazyNotificationItem = React.memo(function LazyNotificationItem({
  notification,
}: {
  notification: Notification;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={itemRef}
      className={`
        p-4 border border-gray-200 dark:border-gray-700 rounded-lg
        transition-all duration-300
        ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-50 transform translate-y-2'}
        ${!notification.readAt ? 'border-l-4 border-l-blue-500' : ''}
      `}
    >
      {isVisible ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {notification.icon && (
              <span className="text-lg" role="img" aria-label="notification icon">
                {notification.icon}
              </span>
            )}
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {notification.title}
            </h4>
            {!notification.readAt && (
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {notification.message}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
            <span className="capitalize">{notification.type}</span>
            <span className="capitalize">{notification.priority}</span>
          </div>
        </div>
      ) : (
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      )}
    </div>
  );
});

// Hook per gestire il lazy loading con cache intelligente
export function useLazyNotificationCache(profileId: string, pageSize: number = 20) {
  const [cache, setCache] = useState<Map<string, LoadedPage>>(new Map());
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());

  const getCacheKey = useCallback((pageIndex: number, filter: NotificationFilter) => {
    return `${profileId}-${pageIndex}-${JSON.stringify(filter)}`;
  }, [profileId]);

  const getCachedPage = useCallback((pageIndex: number, filter: NotificationFilter) => {
    const key = getCacheKey(pageIndex, filter);
    const cached = cache.get(key);
    
    if (!cached) return null;
    
    // Controlla se la cache è ancora valida (5 minuti)
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > maxAge) {
      cache.delete(key);
      return null;
    }
    
    return cached;
  }, [cache, getCacheKey]);

  const setCachedPage = useCallback((pageIndex: number, filter: NotificationFilter, notifications: Notification[]) => {
    const key = getCacheKey(pageIndex, filter);
    const page: LoadedPage = {
      pageIndex,
      notifications,
      timestamp: Date.now(),
    };
    
    setCache(prev => new Map(prev).set(key, page));
  }, [getCacheKey]);

  const isPageLoading = useCallback((pageIndex: number) => {
    return loadingPages.has(pageIndex);
  }, [loadingPages]);

  const setPageLoading = useCallback((pageIndex: number, loading: boolean) => {
    setLoadingPages(prev => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(pageIndex);
      } else {
        newSet.delete(pageIndex);
      }
      return newSet;
    });
  }, []);

  const clearCache = useCallback(() => {
    setCache(new Map());
    setLoadingPages(new Set());
  }, []);

  return {
    getCachedPage,
    setCachedPage,
    isPageLoading,
    setPageLoading,
    clearCache,
  };
}