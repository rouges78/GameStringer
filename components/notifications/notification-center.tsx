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
import { useNotifications } from '@/hooks/use-notifications';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority,
  NotificationFilter,
  formatNotificationTime,
  getNotificationTypeColor 
} from '@/types/notifications';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// Tipi per ordinamento
type SortField = 'createdAt' | 'title' | 'priority' | 'type';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Configurazione virtual scrolling
const ITEM_HEIGHT = 120; // Altezza approssimativa di ogni notifica in px
const BUFFER_SIZE = 5; // Numero di elementi extra da renderizzare sopra/sotto

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    deleteNotification, 
    clearAllNotifications,
    refreshNotifications 
  } = useNotifications();

  // Stati per filtri
  const [selectedTypes, setSelectedTypes] = useState<Set<NotificationType>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<NotificationPriority>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  
  // Stati per ricerca e ordinamento
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'createdAt',
    direction: 'desc'
  });
  
  // Stati per selezione batch
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Stati per virtual scrolling
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Stati per navigazione tastiera
  const [selectedNotificationIndex, setSelectedNotificationIndex] = useState(-1);
  const [keyboardNavigationActive, setKeyboardNavigationActive] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Enhanced keyboard navigation - DEVE essere prima degli useEffect che lo usano
  const { focusManager } = useKeyboardNavigation({
    isActive: isOpen,
    onEscape: () => {
      if (isSelectMode) {
        setIsSelectMode(false);
        setSelectedNotifications(new Set());
        setSelectedNotificationIndex(-1);
      } else if (searchQuery) {
        setSearchQuery('');
        setSelectedNotificationIndex(-1);
      } else {
        onClose();
      }
    },
    onEnter: () => {
      // Gestione click notifica - implementazione semplificata
      if (selectedNotificationIndex >= 0) {
        // Marca come letta se non letta
        const notification = processedNotifications?.[selectedNotificationIndex];
        if (notification && !notification.readAt) {
          handleMarkAsRead(notification.id);
        }
      }
    },
    onCtrlF: () => {
      focusManager?.focusSearch();
    },
    onDelete: () => {
      if (selectedNotificationIndex >= 0) {
        const notification = processedNotifications?.[selectedNotificationIndex];
        if (notification) {
          handleDelete(notification.id);
        }
      }
    },
  });

  // Gestione apertura/chiusura con focus management
  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
      setSelectedNotifications(new Set());
      setIsSelectMode(false);
      setSelectedNotificationIndex(-1);
      setKeyboardNavigationActive(false);
      
      // Focus management
      setTimeout(() => {
        focusManager?.focusNotificationCenter();
        setKeyboardNavigationActive(true);
      }, 100);
    } else {
      // Restore focus when closing
      focusManager?.restoreFocus();
      setKeyboardNavigationActive(false);
    }
  }, [isOpen, refreshNotifications, focusManager]);

  // Gestione dimensioni container per virtual scrolling
  useEffect(() => {
    if (isOpen && scrollAreaRef.current) {
      const updateHeight = () => {
        const rect = scrollAreaRef.current?.getBoundingClientRect();
        if (rect) {
          setContainerHeight(rect.height);
        }
      };
      
      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [isOpen]);

  // Filtra, cerca e ordina notifiche
  const processedNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Filtro per tipo
    if (selectedTypes.size > 0) {
      filtered = filtered.filter(n => selectedTypes.has(n.type));
    }

    // Filtro per priorità
    if (selectedPriorities.size > 0) {
      filtered = filtered.filter(n => selectedPriorities.has(n.priority));
    }

    // Filtro solo non lette
    if (showUnreadOnly) {
      filtered = filtered.filter(n => !n.readAt);
    }

    // Ricerca testuale
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const beforeSearchCount = filtered.length;
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        n.metadata.category.toLowerCase().includes(query) ||
        n.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
      
      // Announce search results for screen readers
      if (searchQuery !== '') {
        setTimeout(() => {
          announceSearchResults(query, filtered.length, beforeSearchCount);
        }, 300);
      }
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
          const priorityOrder = { 'Urgent': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }

      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [notifications, selectedTypes, selectedPriorities, showUnreadOnly, searchQuery, sortConfig]);

  // Conteggio notifiche filtrate
  const filteredUnreadCount = useMemo(() => {
    return processedNotifications.filter(n => !n.readAt).length;
  }, [processedNotifications]);

  // Virtual scrolling - calcola elementi visibili
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      processedNotifications.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    
    return {
      startIndex,
      endIndex,
      items: processedNotifications.slice(startIndex, endIndex),
      totalHeight: processedNotifications.length * ITEM_HEIGHT,
      offsetY: startIndex * ITEM_HEIGHT
    };
  }, [processedNotifications, scrollTop, containerHeight]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
  };

  // Funzioni per azioni batch
  const handleSelectAll = useCallback(() => {
    if (selectedNotifications.size === processedNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(processedNotifications.map(n => n.id)));
    }
  }, [processedNotifications, selectedNotifications.size]);

  const handleToggleSelect = useCallback((notificationId: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  }, [selectedNotifications]);

  const handleBatchMarkAsRead = useCallback(async () => {
    const selectedIds = Array.from(selectedNotifications);
    for (const id of selectedIds) {
      await markAsRead(id);
    }
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  }, [selectedNotifications, markAsRead]);

  const handleBatchDelete = useCallback(async () => {
    const selectedIds = Array.from(selectedNotifications);
    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  }, [selectedNotifications, deleteNotification]);

  // Funzioni per ordinamento
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  // Gestione scroll per virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Gestione filtri
  const handleTypeFilter = (type: NotificationType, checked: boolean) => {
    const newTypes = new Set(selectedTypes);
    if (checked) {
      newTypes.add(type);
    } else {
      newTypes.delete(type);
    }
    setSelectedTypes(newTypes);
    
    // Announce filter change
    setTimeout(() => {
      const filterDescription = `Filtro tipo: ${getTypeDisplayName(type)} ${checked ? 'attivato' : 'disattivato'}`;
      announceFilterChange(notifications.length, processedNotifications.length, filterDescription);
    }, 100);
  };

  const handlePriorityFilter = (priority: NotificationPriority, checked: boolean) => {
    const newPriorities = new Set(selectedPriorities);
    if (checked) {
      newPriorities.add(priority);
    } else {
      newPriorities.delete(priority);
    }
    setSelectedPriorities(newPriorities);
    
    // Announce filter change
    setTimeout(() => {
      const filterDescription = `Filtro priorità: ${getPriorityDisplayName(priority)} ${checked ? 'attivato' : 'disattivato'}`;
      announceFilterChange(notifications.length, processedNotifications.length, filterDescription);
    }, 100);
  };

  const clearAllFilters = () => {
    setSelectedTypes(new Set());
    setSelectedPriorities(new Set());
    setShowUnreadOnly(false);
    setSearchQuery('');
  };

  const markAllAsRead = async () => {
    const unreadNotifications = processedNotifications.filter(n => !n.readAt);
    for (const notification of unreadNotifications) {
      await markAsRead(notification.id);
    }
  };

  // Verifica se ci sono filtri attivi
  const hasActiveFilters = selectedTypes.size > 0 || selectedPriorities.size > 0 || showUnreadOnly || searchQuery.trim().length > 0;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.SECURITY:
        return '🔒';
      case NotificationType.SYSTEM:
        return '⚙️';
      case NotificationType.PROFILE:
        return '👤';
      case NotificationType.UPDATE:
        return '🔄';
      case NotificationType.GAME:
        return '🎮';
      case NotificationType.STORE:
        return '🏪';
      default:
        return '📢';
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case NotificationPriority.HIGH:
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case NotificationPriority.NORMAL:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      case NotificationPriority.LOW:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  // Funzioni helper per nomi display
  const getTypeDisplayName = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.SYSTEM:
        return 'Sistema';
      case NotificationType.PROFILE:
        return 'Profilo';
      case NotificationType.SECURITY:
        return 'Sicurezza';
      case NotificationType.UPDATE:
        return 'Aggiornamenti';
      case NotificationType.GAME:
        return 'Giochi';
      case NotificationType.STORE:
        return 'Store';
      case NotificationType.CUSTOM:
        return 'Personalizzate';
      default:
        return type;
    }
  };

  const getPriorityDisplayName = (priority: NotificationPriority): string => {
    switch (priority) {
      case NotificationPriority.LOW:
        return 'Bassa';
      case NotificationPriority.NORMAL:
        return 'Normale';
      case NotificationPriority.HIGH:
        return 'Alta';
      case NotificationPriority.URGENT:
        return 'Urgente';
      default:
        return priority;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm",
        className
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Centro notifiche"
    >
      <div 
        className="fixed top-16 right-4 w-96 max-h-[80vh] bg-background border rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="document"
        aria-labelledby="notification-center-title"
        aria-describedby="notification-center-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5" aria-hidden="true" />
            <h3 id="notification-center-title" className="font-semibold">Notifiche</h3>
            {filteredUnreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredUnreadCount} nuove
              </Badge>
            )}
            {hasActiveFilters && (
              <Badge variant="outline" className="text-xs">
                Filtrate ({processedNotifications.length})
              </Badge>
            )}
            {isSelectMode && selectedNotifications.size > 0 && (
              <Badge variant="default" className="text-xs">
                {selectedNotifications.size} selezionate
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Modalità selezione */}
            {processedNotifications.length > 0 && (
              <Button
                variant={isSelectMode ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedNotifications(new Set());
                }}
                title={isSelectMode ? "Esci dalla modalità selezione" : "Modalità selezione"}
              >
                {isSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </Button>
            )}

            {/* Ordinamento */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ordina per</DropdownMenuLabel>
                <DropdownMenuSeparator />
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

            {/* Filtri */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8",
                    hasActiveFilters && "text-primary"
                  )}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filtri</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Filtro solo non lette */}
                <DropdownMenuCheckboxItem
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Solo non lette
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                
                {Object.values(NotificationType).map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={selectedTypes.has(type)}
                    onCheckedChange={(checked) => handleTypeFilter(type, checked)}
                  >
                    {getTypeDisplayName(type)}
                  </DropdownMenuCheckboxItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Priorità</DropdownMenuLabel>
                
                {Object.values(NotificationPriority).map((priority) => (
                  <DropdownMenuCheckboxItem
                    key={priority}
                    checked={selectedPriorities.has(priority)}
                    onCheckedChange={(checked) => handlePriorityFilter(priority, checked)}
                  >
                    {getPriorityDisplayName(priority)}
                  </DropdownMenuCheckboxItem>
                ))}
                
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Rimuovi filtri
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowKeyboardHelp(true)}
              title="Mostra scorciatoie tastiera"
              aria-label="Mostra guida scorciatoie tastiera"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Azioni */}
            {processedNotifications.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isSelectMode && selectedNotifications.size > 0 ? (
                    <>
                      <DropdownMenuItem onClick={handleSelectAll}>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        {selectedNotifications.size === processedNotifications.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleBatchMarkAsRead}>
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Marca selezionate come lette
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBatchDelete} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina selezionate
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      {filteredUnreadCount > 0 && (
                        <DropdownMenuItem onClick={markAllAsRead}>
                          <CheckCheck className="h-4 w-4 mr-2" />
                          Marca tutte come lette
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleClearAll} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina tutte
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Descrizione nascosta per screen reader */}
        <div id="notification-center-description" className="sr-only">
          Centro notifiche con {processedNotifications.length} notifiche. 
          {filteredUnreadCount > 0 && `${filteredUnreadCount} non lette. `}
          Usa i filtri per cercare notifiche specifiche. 
          Premi Escape per chiudere, Ctrl+A per selezionare tutto, Ctrl+F per cercare.
        </div>

        {/* Barra di ricerca */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="notification-search"
              placeholder="Cerca nelle notifiche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Cerca nelle notifiche per titolo, messaggio o categoria"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Digita per cercare nelle notifiche. La ricerca include titolo, messaggio e categorie.
            </div>
          </div>
        </div>

        {/* Statistiche filtri */}
        {hasActiveFilters && (
          <div className="px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground">
            Mostrando {processedNotifications.length} di {notifications.length} notifiche
            {searchQuery && (
              <span className="ml-2">
                • Ricerca: "{searchQuery}"
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          ref={scrollAreaRef}
          className="h-96 overflow-auto"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : processedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="font-medium text-muted-foreground mb-2">
                {hasActiveFilters ? "Nessuna notifica corrispondente" : "Nessuna notifica"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters 
                  ? "Prova a modificare i filtri per vedere più notifiche"
                  : "Le tue notifiche appariranno qui"
                }
              </p>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="mt-3"
                >
                  Rimuovi filtri
                </Button>
              )}
            </div>
          ) : (
            <div 
              className="relative"
              style={{ height: visibleItems.totalHeight }}
            >
              <div 
                className="absolute w-full"
                style={{ 
                  transform: `translateY(${visibleItems.offsetY}px)`,
                  top: 0,
                  left: 0
                }}
              >
                <div className="p-2 space-y-2">
                  {visibleItems.items.map((notification, index) => {
                    const actualIndex = visibleItems.startIndex + index;
                    return (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDelete}
                        isSelected={selectedNotifications.has(notification.id)}
                        isSelectMode={isSelectMode}
                        onToggleSelect={handleToggleSelect}
                        style={{ height: ITEM_HEIGHT }}
                        index={actualIndex}
                        isKeyboardSelected={selectedNotificationIndex === actualIndex}
                        onFocus={() => setSelectedNotificationIndex(actualIndex)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp 
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
        />
      </div>
    </div>
  );
};

// Componente per singola notifica
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
  style?: React.CSSProperties;
  index?: number;
  isKeyboardSelected?: boolean;
  onFocus?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect,
  style,
  index = -1,
  isKeyboardSelected = false,
  onFocus
}) => {
  const isUnread = !notification.readAt;
  const itemId = `notification-item-${notification.id}`;
  const titleId = `${itemId}-title`;
  const messageId = `${itemId}-message`;
  const timeId = `${itemId}-time`;
  
  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case NotificationPriority.HIGH:
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case NotificationPriority.NORMAL:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      case NotificationPriority.LOW:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.SECURITY:
        return '🔒';
      case NotificationType.SYSTEM:
        return '⚙️';
      case NotificationType.PROFILE:
        return '👤';
      case NotificationType.UPDATE:
        return '🔄';
      case NotificationType.GAME:
        return '🎮';
      case NotificationType.STORE:
        return '🏪';
      default:
        return '📢';
    }
  };

  const handleClick = () => {
    if (isSelectMode && onToggleSelect) {
      onToggleSelect(notification.id);
    } else if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      id={itemId}
      data-notification-index={index}
      className={cn(
        "group relative p-3 rounded-lg border-l-4 transition-all duration-200",
        "hover:shadow-sm cursor-pointer focus-within:ring-2 focus-within:ring-primary",
        getPriorityColor(notification.priority),
        isUnread && "ring-1 ring-primary/20",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isKeyboardSelected && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20",
        isSelectMode && "hover:ring-2 hover:ring-primary/50"
      )}
      onClick={handleClick}
      onFocus={onFocus}
      style={style}
      role={isSelectMode ? "checkbox" : "article"}
      aria-checked={isSelectMode ? isSelected : undefined}
      aria-labelledby={titleId}
      aria-describedby={`${messageId} ${timeId}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          onDelete(notification.id);
        } else if (e.key === 'm' && !isSelectMode) {
          e.preventDefault();
          if (isUnread) {
            onMarkAsRead(notification.id);
          }
        }
      }}
    >
      <div className="flex items-start space-x-3">
        {/* Checkbox per selezione */}
        {isSelectMode && (
          <div className="flex-shrink-0 pt-1">
            <div className={cn(
              "w-4 h-4 border-2 rounded flex items-center justify-center transition-colors",
              isSelected 
                ? "bg-primary border-primary text-primary-foreground" 
                : "border-muted-foreground hover:border-primary"
            )}>
              {isSelected && <Check className="h-3 w-3" />}
            </div>
          </div>
        )}

        {/* Icona */}
        <div className="flex-shrink-0 text-lg" aria-hidden="true">
          {notification.icon ? (
            <img 
              src={notification.icon} 
              alt=""
              className="h-5 w-5"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span role="img" aria-label={`Icona ${notification.type.toLowerCase()}`}>
              {getNotificationIcon(notification.type)}
            </span>
          )}
        </div>

        {/* Contenuto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 
                id={titleId}
                className={cn(
                  "text-sm leading-tight mb-1",
                  isUnread ? "font-semibold" : "font-medium"
                )}
              >
                {notification.title}
                {isUnread && <span className="sr-only"> (non letta)</span>}
              </h4>
              <p 
                id={messageId}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {notification.message}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span 
                  id={timeId}
                  className="text-xs text-muted-foreground"
                  aria-label={`Ricevuta ${formatNotificationTime(notification.createdAt)}`}
                >
                  {formatNotificationTime(notification.createdAt)}
                </span>
                {notification.metadata?.category && (
                  <Badge variant="outline" className="text-xs">
                    {notification.metadata.category}
                  </Badge>
                )}
              </div>
            </div>

            {/* Azioni */}
            {!isSelectMode && (
              <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {isUnread && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead(notification.id);
                    }}
                    title="Marca come letta"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-red-100 dark:hover:bg-red-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  title="Elimina notifica"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Indicatore non letta */}
      {isUnread && (
        <div className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
      )}
    </div>
  );
};

export default NotificationCenter;