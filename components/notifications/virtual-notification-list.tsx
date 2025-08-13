'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Notification } from '@/types/notifications';
import { NotificationItem } from './notification-item';

interface VirtualNotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
}

interface VirtualItem {
  index: number;
  notification: Notification;
  top: number;
  height: number;
}

export function VirtualNotificationList({
  notifications,
  onMarkAsRead,
  onDelete,
  onAction,
  itemHeight = 120,
  containerHeight = 400,
  overscan = 5,
  className = '',
}: VirtualNotificationListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Calcola gli elementi visibili
  const visibleItems = useMemo(() => {
    const totalHeight = notifications.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      notifications.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (notifications[i]) {
        items.push({
          index: i,
          notification: notifications[i],
          top: i * itemHeight,
          height: itemHeight,
        });
      }
    }

    return { items, totalHeight, startIndex, endIndex };
  }, [notifications, scrollTop, containerHeight, itemHeight, overscan]);

  // Gestisce lo scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
    setIsScrolling(true);

    // Debounce per ottimizzare le performance
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Memoizza i callback per evitare re-render inutili
  const memoizedOnMarkAsRead = useCallback(onMarkAsRead, [onMarkAsRead]);
  const memoizedOnDelete = useCallback(onDelete, [onDelete]);
  const memoizedOnAction = useCallback(onAction || (() => {}), [onAction]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        {/* Contenitore virtuale con altezza totale */}
        <div style={{ height: visibleItems.totalHeight, position: 'relative' }}>
          {/* Elementi visibili */}
          {visibleItems.items.map((item) => (
            <div
              key={item.notification.id}
              style={{
                position: 'absolute',
                top: item.top,
                left: 0,
                right: 0,
                height: item.height,
              }}
            >
              <MemoizedNotificationItem
                notification={item.notification}
                onMarkAsRead={memoizedOnMarkAsRead}
                onDelete={memoizedOnDelete}
                onAction={memoizedOnAction}
                isScrolling={isScrolling}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Indicatore di scroll per debug (solo in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
          {visibleItems.startIndex}-{visibleItems.endIndex} / {notifications.length}
          {isScrolling && ' (scrolling)'}
        </div>
      )}
    </div>
  );
}

// Componente NotificationItem memoizzato per performance
const MemoizedNotificationItem = React.memo(function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onAction,
  isScrolling,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction: (id: string, action: string) => void;
  isScrolling: boolean;
}) {
  // Durante lo scroll, riduci le animazioni per migliorare le performance
  const shouldReduceAnimations = isScrolling;

  return (
    <div
      className={`
        p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
        ${shouldReduceAnimations ? '' : 'transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700'}
        ${!notification.readAt ? 'border-l-4 border-l-blue-500' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {notification.icon && (
              <span className="text-lg" role="img" aria-label="notification icon">
                {notification.icon}
              </span>
            )}
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {notification.title}
            </h4>
            {!notification.readAt && (
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" aria-label="Non letta" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {notification.message}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
            <span className="capitalize">{notification.type}</span>
            <span className="capitalize">{notification.priority}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {!notification.readAt && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              aria-label="Marca come letta"
            >
              Segna letta
            </button>
          )}
          
          {notification.actionUrl && (
            <button
              onClick={() => onAction(notification.id, 'navigate')}
              className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
              aria-label="Vai all'azione"
            >
              Vai
            </button>
          )}
          
          <button
            onClick={() => onDelete(notification.id)}
            className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            aria-label="Elimina notifica"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
});

// Hook per gestire il virtual scrolling con lazy loading
export function useVirtualNotifications(
  totalCount: number,
  pageSize: number = 20,
  loadPage: (offset: number, limit: number) => Promise<Notification[]>
) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadNotificationsPage = useCallback(async (pageIndex: number) => {
    if (loadedPages.has(pageIndex) || loading) return;

    setLoading(true);
    try {
      const offset = pageIndex * pageSize;
      const newNotifications = await loadPage(offset, pageSize);
      
      setNotifications(prev => {
        const updated = [...prev];
        newNotifications.forEach((notification, index) => {
          updated[offset + index] = notification;
        });
        return updated;
      });
      
      setLoadedPages(prev => new Set([...prev, pageIndex]));
    } catch (error) {
      console.error('Errore caricamento notifiche:', error);
    } finally {
      setLoading(false);
    }
  }, [loadPage, pageSize, loadedPages, loading]);

  // Carica le pagine necessarie basandosi sugli elementi visibili
  const ensurePagesLoaded = useCallback((startIndex: number, endIndex: number) => {
    const startPage = Math.floor(startIndex / pageSize);
    const endPage = Math.floor(endIndex / pageSize);
    
    for (let page = startPage; page <= endPage; page++) {
      if (!loadedPages.has(page)) {
        loadNotificationsPage(page);
      }
    }
  }, [pageSize, loadedPages, loadNotificationsPage]);

  return {
    notifications,
    loading,
    ensurePagesLoaded,
    loadNotificationsPage,
    setNotifications,
  };
}

// Componente wrapper che combina virtual scrolling e lazy loading
export function LazyVirtualNotificationList({
  totalCount,
  pageSize = 20,
  loadPage,
  onMarkAsRead,
  onDelete,
  onAction,
  ...props
}: Omit<VirtualNotificationListProps, 'notifications'> & {
  totalCount: number;
  pageSize?: number;
  loadPage: (offset: number, limit: number) => Promise<Notification[]>;
}) {
  const { notifications, loading, ensurePagesLoaded } = useVirtualNotifications(
    totalCount,
    pageSize,
    loadPage
  );

  // Carica le pagine necessarie quando cambiano gli elementi visibili
  const handleVisibleRangeChange = useCallback((startIndex: number, endIndex: number) => {
    ensurePagesLoaded(startIndex, endIndex);
  }, [ensurePagesLoaded]);

  return (
    <div className="relative">
      <VirtualNotificationList
        notifications={notifications}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
        onAction={onAction}
        {...props}
      />
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 dark:bg-gray-800 dark:bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}