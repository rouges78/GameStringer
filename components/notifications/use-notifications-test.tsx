'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Plus, 
  Search, 
  CheckCircle, 
  Trash2, 
  RefreshCw,
  BarChart3,
  Filter,
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { 
  NotificationType, 
  NotificationPriority, 
  CreateNotificationRequest 
} from '@/types/notifications';

export const UseNotificationsTest: React.FC = () => {
  const {
    // Stato base
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    lastUpdated,
    
    // Operazioni CRUD
    createNotification,
    markAsRead,
    deleteNotification,
    clearAllNotifications,
    
    // Operazioni batch
    markMultipleAsRead,
    markAllAsRead,
    
    // Caricamento e refresh
    refreshNotifications,
    loadMoreNotifications,
    
    // Funzioni di utilità
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    hasUnreadNotifications,
    getNotificationById,
    filterNotifications,
    searchNotifications,
    getNotificationStats
  } = useNotifications({
    autoRefresh: true,
    refreshInterval: 10000, // 10 secondi per test
    enableRealTime: true,
    maxNotifications: 50
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NotificationType | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<NotificationPriority | 'all'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  // Crea notifica di test
  const handleCreateTestNotification = async (type: 'info' | 'warning' | 'error' | 'success') => {
    const requests: Record<string, CreateNotificationRequest> = {
      info: {
        type: NotificationType.SYSTEM,
        title: 'Informazione di Test',
        message: 'Questa è una notifica informativa di test per verificare il funzionamento dell\'hook.',
        priority: NotificationPriority.NORMAL,
        icon: 'info',
        metadata: {
          source: 'test',
          category: 'info',
          tags: ['test', 'info']
        }
      },
      warning: {
        type: NotificationType.SECURITY,
        title: 'Avviso di Sicurezza',
        message: 'Rilevata attività sospetta. Controlla le impostazioni di sicurezza.',
        priority: NotificationPriority.HIGH,
        icon: 'alert-triangle',
        metadata: {
          source: 'test',
          category: 'security',
          tags: ['test', 'warning', 'security']
        }
      },
      error: {
        type: NotificationType.SYSTEM,
        title: 'Errore di Sistema',
        message: 'Si è verificato un errore durante l\'operazione. Riprova più tardi.',
        priority: NotificationPriority.URGENT,
        icon: 'x-circle',
        metadata: {
          source: 'test',
          category: 'error',
          tags: ['test', 'error', 'system']
        }
      },
      success: {
        type: NotificationType.PROFILE,
        title: 'Operazione Completata',
        message: 'L\'operazione è stata completata con successo.',
        priority: NotificationPriority.LOW,
        icon: 'check-circle',
        metadata: {
          source: 'test',
          category: 'success',
          tags: ['test', 'success']
        }
      }
    };

    await createNotification(requests[type]);
  };

  // Gestisce selezione notifiche
  const handleSelectNotification = (notificationId: string, selected: boolean) => {
    if (selected) {
      setSelectedNotifications(prev => [...prev, notificationId]);
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  // Filtra notifiche in base ai criteri
  const getFilteredNotifications = () => {
    let filtered = notifications;

    // Filtro per ricerca
    if (searchQuery) {
      filtered = searchNotifications(searchQuery);
    }

    // Filtro per tipo
    if (selectedType !== 'all') {
      filtered = filtered.filter(n => n.type === selectedType);
    }

    // Filtro per priorità
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(n => n.priority === selectedPriority);
    }

    return filtered;
  };

  const filteredNotifications = getFilteredNotifications();
  const stats = getNotificationStats();

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.LOW: return 'bg-blue-100 text-blue-800';
      case NotificationPriority.NORMAL: return 'bg-gray-100 text-gray-800';
      case NotificationPriority.HIGH: return 'bg-orange-100 text-orange-800';
      case NotificationPriority.URGENT: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.SYSTEM: return '⚙️';
      case NotificationType.PROFILE: return '👤';
      case NotificationType.SECURITY: return '🔒';
      case NotificationType.UPDATE: return '🔄';
      case NotificationType.GAME: return '🎮';
      case NotificationType.STORE: return '🏪';
      case NotificationType.CUSTOM: return '📝';
      default: return '📢';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Test Hook useNotifications</span>
          </CardTitle>
          <CardDescription>
            Test completo delle funzionalità avanzate dell'hook useNotifications con real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Statistiche */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Statistiche</span>
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Totali:</span>
                  <Badge variant="outline">{stats.total}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Non lette:</span>
                  <Badge variant={stats.unread > 0 ? "default" : "secondary"}>
                    {stats.unread}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Selezionate:</span>
                  <Badge variant="outline">{selectedNotifications.length}</Badge>
                </div>
              </div>
            </div>

            {/* Stato */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Info className="h-4 w-4" />
                <span>Stato</span>
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Caricamento:</span>
                  <Badge variant={isLoading ? "default" : "secondary"}>
                    {isLoading ? 'Sì' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Altre disponibili:</span>
                  <Badge variant={hasMore ? "default" : "secondary"}>
                    {hasMore ? 'Sì' : 'No'}
                  </Badge>
                </div>
                {lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Ultimo aggiornamento: {lastUpdated.toLocaleTimeString('it-IT')}
                  </div>
                )}
              </div>
            </div>

            {/* Azioni rapide */}
            <div className="space-y-2">
              <h4 className="font-medium">Azioni Rapide</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateTestNotification('info')}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Info
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateTestNotification('warning')}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Warning
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateTestNotification('error')}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Error
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateTestNotification('success')}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Success
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Errore: {error}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controlli */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtri e Controlli</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ricerca */}
          <div className="space-y-2">
            <Label htmlFor="search">Ricerca</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Cerca nelle notifiche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtri */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as NotificationType | 'all')}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">Tutti i tipi</option>
                {Object.values(NotificationType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Priorità</Label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as NotificationPriority | 'all')}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">Tutte le priorità</option>
                {Object.values(NotificationPriority).map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Azioni batch */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={refreshNotifications}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Aggiorna
            </Button>

            {selectedNotifications.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markMultipleAsRead(selectedNotifications)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Marca Selezionate ({selectedNotifications.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedNotifications([])}
                >
                  Deseleziona Tutto
                </Button>
              </>
            )}

            {hasUnreadNotifications() && (
              <Button
                size="sm"
                variant="outline"
                onClick={markAllAsRead}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Marca Tutte ({unreadCount})
              </Button>
            )}

            {notifications.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Elimina Tutte
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista notifiche */}
      <Card>
        <CardHeader>
          <CardTitle>
            Notifiche ({filteredNotifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna notifica trovata</p>
              {searchQuery && (
                <p className="text-sm">Prova a modificare i filtri di ricerca</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg ${
                    !notification.readAt ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={(e) => handleSelectNotification(notification.id, e.target.checked)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getTypeIcon(notification.type)}</span>
                        <h4 className="font-medium truncate">{notification.title}</h4>
                        <Badge className={getPriorityColor(notification.priority)}>
                          {notification.priority}
                        </Badge>
                        {!notification.readAt && (
                          <Badge variant="default" className="text-xs">
                            Non letta
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(notification.createdAt).toLocaleString('it-IT')}</span>
                        </div>
                        
                        <div className="flex space-x-1">
                          {notification.metadata.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-1">
                      {!notification.readAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMoreNotifications}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Caricamento...' : 'Carica Altre'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UseNotificationsTest;