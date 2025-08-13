'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Bell, Trash2, Check, MoreVertical, Filter, CheckCheck, Mail, Search, ArrowUpDown, Square, CheckSquare, HelpCircle } from 'lucide-react';
import { useKeyboardNavigation, useNotificationListNavigation } from '@/hooks/use-keyboard-navigation';
import { announceFilterChange, announceSearchResults, announceBatchOperation } from '@/lib/notification-accessibility';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useNotificationsOptimized } from '@/hooks/use-notifications-optimized';
import { VirtualNotificationList, LazyVirtualNotificationList } from './virtual-notification-list';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority,
  NotificationFilter,
  formatNotificationTime,
  getNotificationTypeColor 
} from '@/types/notifications';

interface NotificationCenterOptimizedProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  className?: string;
  enableVirtualScrolling?: boolean;
  enableLazyLoading?: boolean;
  pageSize?: number;
}

// Tipi per ordinamento
type SortField = 'createdAt' | 'title' | 'priority' | 'type';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Configurazione performance
const VIRTUAL_ITEM_HEIGHT = 120;
const VIRTUAL_CONTAINER_HEIGHT = 400;
const DEFAULT_PAGE_SIZE = 20;

export function NotificationCenterOptimized({
  isOpen,
  onClose,
  profileId,
  className,
  enableVirtualScrolling = true,
  enableLazyLoading = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: NotificationCenterOptimizedProps) {
  // Stati per filtri e ricerca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<NotificationType>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<NotificationPriority>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'createdAt', direction: 'desc' });
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Hook ottimizzato per le notifiche
  const {
    notifications,
    unreadCount,
    totalCount,
    loading,
    error,
    loadNotifications,
    loadNotificationsPage,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearAllNotifications,
    refresh,
    clearError,
  } = useNotificationsOptimized({
    profileId,
    autoRefresh: true,
    refreshInterval: 30000,
    enableBatching: true,
    enableVirtualization: enableVirtualScrolling,
  });

  // Refs per keyboard navigation
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Memoizza il filtro corrente
  const currentFilter = useMemo((): NotificationFilter => {
    const filter: NotificationFilter = {};
    
    if (selectedTypes.size > 0) {
      filter.notification_type = Array.from(selectedTypes)[0]; // Per semplicità, usa il primo tipo
    }
    
    if (selectedPriorities.size > 0) {
      filter.priority = Array.from(selectedPriorities)[0]; // Per semplicità, usa la prima priorità
    }
    
    if (showUnreadOnly) {
      filter.unread_only = true;
    }
    
    return filter;
  }, [selectedTypes, selectedPriorities, showUnreadOnly]);

  // Filtra e ordina le notifiche
  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications;

    // Filtro per ricerca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower)
      );
    }

    // Filtro per tipi
    if (selectedTypes.size > 0) {
      filtered = filtered.filter(notification =>
        selectedTypes.has(notification.type)
      );
    }

    // Filtro per priorità
    if (selectedPriorities.size > 0) {
      filtered = filtered.filter(notification =>
        selectedPriorities.has(notification.priority)
      );
    }

    // Filtro per non lette
    if (showUnreadOnly) {
      filtered = filtered.filter(notification => !notification.readAt);
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortConfig.field) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [notifications, searchTerm, selectedTypes, selectedPriorities, showUnreadOnly, sortConfig]);

  // Callback per azioni notifiche
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      setSelectedNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    } catch (error) {
      console.error('Errore marcatura come letta:', error);
    }
  }, [markAsRead]);

  const handleDelete = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setSelectedNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    } catch (error) {
      console.error('Errore eliminazione notifica:', error);
    }
  }, [deleteNotification]);

  const handleAction = useCallback((notificationId: string, action: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    switch (action) {
      case 'navigate':
        if (notification.actionUrl) {
          // Naviga all'URL dell'azione
          window.location.href = notification.actionUrl;
        }
        break;
      default:
        console.log('Azione non riconosciuta:', action);
    }
  }, [notifications]);

  // Operazioni batch
  const handleBatchMarkAsRead = useCallback(async () => {
    const selectedIds = Array.from(selectedNotifications);
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => markAsRead(id)));
      setSelectedNotifications(new Set());
      announceBatchOperation(`${selectedIds.length} notifiche marcate come lette`);
    } catch (error) {
      console.error('Errore batch mark as read:', error);
    }
  }, [selectedNotifications, markAsRead]);

  const handleBatchDelete = useCallback(async () => {
    const selectedIds = Array.from(selectedNotifications);
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => deleteNotification(id)));
      setSelectedNotifications(new Set());
      announceBatchOperation(`${selectedIds.length} notifiche eliminate`);
    } catch (error) {
      console.error('Errore batch delete:', error);
    }
  }, [selectedNotifications, deleteNotification]);

  // Gestione selezione
  const handleSelectNotification = useCallback((notificationId: string, selected: boolean) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(notificationId);
      } else {
        newSet.delete(notificationId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredAndSortedNotifications.map(n => n.id);
    setSelectedNotifications(new Set(allIds));
  }, [filteredAndSortedNotifications]);

  const handleDeselectAll = useCallback(() => {
    setSelectedNotifications(new Set());
  }, []);

  // Keyboard navigation
  const { activeIndex, setActiveIndex } = useNotificationListNavigation({
    itemCount: filteredAndSortedNotifications.length,
    onEnter: (index) => {
      const notification = filteredAndSortedNotifications[index];
      if (notification) {
        handleMarkAsRead(notification.id);
      }
    },
    onDelete: (index) => {
      const notification = filteredAndSortedNotifications[index];
      if (notification) {
        handleDelete(notification.id);
      }
    },
  });

  // Gestione ordinamento
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // Effetti
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm) {
      announceSearchResults(filteredAndSortedNotifications.length);
    }
  }, [searchTerm, filteredAndSortedNotifications.length]);

  // Render condizionale basato su virtual scrolling
  const renderNotificationList = () => {
    if (enableVirtualScrolling && enableLazyLoading) {
      return (
        <LazyVirtualNotificationList
          totalCount={totalCount}
          pageSize={pageSize}
          loadPage={loadNotificationsPage}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDelete}
          onAction={handleAction}
          itemHeight={VIRTUAL_ITEM_HEIGHT}
          containerHeight={VIRTUAL_CONTAINER_HEIGHT}
          className="flex-1"
        />
      );
    } else if (enableVirtualScrolling) {
      return (
        <VirtualNotificationList
          notifications={filteredAndSortedNotifications}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDelete}
          onAction={handleAction}
          itemHeight={VIRTUAL_ITEM_HEIGHT}
          containerHeight={VIRTUAL_CONTAINER_HEIGHT}
          className="flex-1"
        />
      );
    } else {
      // Fallback alla lista tradizionale
      return (
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-4">
            {filteredAndSortedNotifications.map((notification, index) => (
              <NotificationItemOptimized
                key={notification.id}
                notification={notification}
                isSelected={selectedNotifications.has(notification.id)}
                isActive={index === activeIndex}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onAction={handleAction}
                onSelect={handleSelectNotification}
              />
            ))}
          </div>
        </ScrollArea>
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4",
      className
    )}>
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col"
        role="dialog"
        aria-labelledby="notification-center-title"
        aria-describedby="notification-center-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-600" />
            <div>
              <h2 id="notification-center-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Centro Notifiche
              </h2>
              <p id="notification-center-description" className="text-sm text-gray-500 dark:text-gray-400">
                {totalCount} notifiche totali, {unreadCount} non lette
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              aria-label="Mostra aiuto scorciatoie tastiera"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Chiudi centro notifiche"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Ricerca */}
          <div className="flex-1">
            <Input
              ref={searchInputRef}
              placeholder="Cerca notifiche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filtri */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtri
                {(selectedTypes.size > 0 || selectedPriorities.size > 0 || showUnreadOnly) && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedTypes.size + selectedPriorities.size + (showUnreadOnly ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtri</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuCheckboxItem
                checked={showUnreadOnly}
                onCheckedChange={setShowUnreadOnly}
              >
                Solo non lette
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tipi</DropdownMenuLabel>
              {Object.values(NotificationType).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={selectedTypes.has(type)}
                  onCheckedChange={(checked) => {
                    setSelectedTypes(prev => {
                      const newSet = new Set(prev);
                      if (checked) {
                        newSet.add(type);
                      } else {
                        newSet.delete(type);
                      }
                      return newSet;
                    });
                  }}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priorità</DropdownMenuLabel>
              {Object.values(NotificationPriority).map((priority) => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={selectedPriorities.has(priority)}
                  onCheckedChange={(checked) => {
                    setSelectedPriorities(prev => {
                      const newSet = new Set(prev);
                      if (checked) {
                        newSet.add(priority);
                      } else {
                        newSet.delete(priority);
                      }
                      return newSet;
                    });
                  }}
                >
                  {priority}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Ordinamento */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Ordina
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSort('createdAt')}>
                Data {sortConfig.field === 'createdAt' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('title')}>
                Titolo {sortConfig.field === 'title' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('priority')}>
                Priorità {sortConfig.field === 'priority' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('type')}>
                Tipo {sortConfig.field === 'type' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Azioni batch */}
          {selectedNotifications.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchMarkAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Segna lette ({selectedNotifications.size})
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina ({selectedNotifications.size})
              </Button>
            </div>
          )}

          {/* Azioni globali */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSelectAll}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Seleziona tutto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeselectAll}>
                <Square className="h-4 w-4 mr-2" />
                Deseleziona tutto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Segna tutte come lette
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearAllNotifications}>
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina tutte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={refresh}>
                <Mail className="h-4 w-4 mr-2" />
                Aggiorna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contenuto */}
        <div className="flex-1 flex flex-col min-h-0">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="mt-2"
              >
                Chiudi
              </Button>
            </div>
          )}

          {loading && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Caricamento...</p>
            </div>
          )}

          {!loading && filteredAndSortedNotifications.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nessuna notifica
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm || selectedTypes.size > 0 || selectedPriorities.size > 0 || showUnreadOnly
                    ? 'Nessuna notifica corrisponde ai filtri selezionati.'
                    : 'Non hai notifiche al momento.'}
                </p>
              </div>
            </div>
          )}

          {!loading && filteredAndSortedNotifications.length > 0 && renderNotificationList()}
        </div>

        {/* Aiuto scorciatoie tastiera */}
        {showKeyboardHelp && (
          <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
        )}
      </div>
    </div>
  );
}

// Componente NotificationItem ottimizzato
const NotificationItemOptimized = React.memo(function NotificationItemOptimized({
  notification,
  isSelected,
  isActive,
  onMarkAsRead,
  onDelete,
  onAction,
  onSelect,
}: {
  notification: Notification;
  isSelected: boolean;
  isActive: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction: (id: string, action: string) => void;
  onSelect: (id: string, selected: boolean) => void;
}) {
  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(notification.id, e.target.checked);
  }, [notification.id, onSelect]);

  const handleMarkAsRead = useCallback(() => {
    onMarkAsRead(notification.id);
  }, [notification.id, onMarkAsRead]);

  const handleDelete = useCallback(() => {
    onDelete(notification.id);
  }, [notification.id, onDelete]);

  const handleAction = useCallback(() => {
    onAction(notification.id, 'navigate');
  }, [notification.id, onAction]);

  return (
    <div
      className={cn(
        "p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800",
        "transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700",
        !notification.readAt && "border-l-4 border-l-blue-500",
        isActive && "ring-2 ring-blue-500",
        isSelected && "bg-blue-50 dark:bg-blue-900/20"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelect}
          className="mt-1"
          aria-label={`Seleziona notifica: ${notification.title}`}
        />

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
          
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
            {notification.message}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatNotificationTime(notification.createdAt)}</span>
            <Badge variant="outline" className={getNotificationTypeColor(notification.type)}>
              {notification.type}
            </Badge>
            <Badge variant="outline">
              {notification.priority}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!notification.readAt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAsRead}
              aria-label="Marca come letta"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          
          {notification.actionUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAction}
              aria-label="Vai all'azione"
            >
              Vai
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            aria-label="Elimina notifica"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});