'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Settings,
  User,
  TestTube,
  Zap
} from 'lucide-react';
import { useNotificationSystem } from './notification-provider';
import { NotificationType, NotificationPriority } from '@/types/notifications';

export const NotificationIntegrationTest: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showWarningNotification,
    markAllAsRead,
    clearAllNotifications,
    handleSystemEvent,
    handleProfileEvent
  } = useNotificationSystem();

  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testBasicNotifications = async () => {
    addTestResult('🧪 Testing basic notifications...');
    
    try {
      await showSuccessNotification('Test Successo', 'Questa è una notifica di successo di test');
      addTestResult('✅ Success notification created');
      
      await showErrorNotification('Test Errore', 'Questa è una notifica di errore di test');
      addTestResult('✅ Error notification created');
      
      await showInfoNotification('Test Info', 'Questa è una notifica informativa di test');
      addTestResult('✅ Info notification created');
      
      await showWarningNotification('Test Warning', 'Questa è una notifica di avviso di test');
      addTestResult('✅ Warning notification created');
      
      addTestResult('🎉 Basic notifications test completed successfully');
    } catch (error) {
      addTestResult(`❌ Basic notifications test failed: ${error}`);
    }
  };

  const testSystemEvents = async () => {
    addTestResult('🧪 Testing system events...');
    
    try {
      await handleSystemEvent('app-update-available', { version: '1.2.3' });
      addTestResult('✅ App update event handled');
      
      await handleSystemEvent('system-error', { message: 'Test system error' });
      addTestResult('✅ System error event handled');
      
      await handleSystemEvent('backup-completed', {});
      addTestResult('✅ Backup completed event handled');
      
      addTestResult('🎉 System events test completed successfully');
    } catch (error) {
      addTestResult(`❌ System events test failed: ${error}`);
    }
  };

  const testProfileEvents = async () => {
    addTestResult('🧪 Testing profile events...');
    
    try {
      await handleProfileEvent('profile-created', 'test-profile-123');
      addTestResult('✅ Profile created event handled');
      
      await handleProfileEvent('credential-added', 'test-profile-123', { store: 'Steam' });
      addTestResult('✅ Credential added event handled');
      
      await handleProfileEvent('settings-updated', 'test-profile-123');
      addTestResult('✅ Settings updated event handled');
      
      addTestResult('🎉 Profile events test completed successfully');
    } catch (error) {
      addTestResult(`❌ Profile events test failed: ${error}`);
    }
  };

  const testNotificationManagement = async () => {
    addTestResult('🧪 Testing notification management...');
    
    try {
      const initialCount = unreadCount;
      addTestResult(`📊 Initial unread count: ${initialCount}`);
      
      // Create some test notifications
      await showInfoNotification('Test 1', 'First test notification');
      await showInfoNotification('Test 2', 'Second test notification');
      
      // Wait a bit for state updates
      setTimeout(async () => {
        addTestResult(`📊 Unread count after adding: ${unreadCount}`);
        
        // Mark all as read
        const markedCount = await markAllAsRead();
        addTestResult(`✅ Marked ${markedCount} notifications as read`);
        
        // Clear all notifications
        const cleared = await clearAllNotifications();
        if (cleared) {
          addTestResult('✅ All notifications cleared');
        }
        
        addTestResult('🎉 Notification management test completed successfully');
      }, 1000);
    } catch (error) {
      addTestResult(`❌ Notification management test failed: ${error}`);
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    addTestResult('🚀 Starting comprehensive notification system test...');
    
    await testBasicNotifications();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testSystemEvents();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testProfileEvents();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testNotificationManagement();
    
    addTestResult('🏁 All tests completed!');
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5 text-blue-500" />
            <span>Test Integrazione Sistema Notifiche</span>
          </CardTitle>
          <CardDescription>
            Test completo dell'integrazione del sistema di notifiche nell'applicazione principale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <Bell className="h-8 w-8 text-blue-500 mb-2" />
              <span className="text-2xl font-bold">{notifications.length}</span>
              <span className="text-sm text-muted-foreground">Totali</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-orange-500 mb-2" />
              <span className="text-2xl font-bold">{unreadCount}</span>
              <span className="text-sm text-muted-foreground">Non Lette</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <Zap className="h-8 w-8 text-green-500 mb-2" />
              <Badge variant={isLoading ? "secondary" : "default"}>
                {isLoading ? 'Caricamento' : 'Pronto'}
              </Badge>
              <span className="text-sm text-muted-foreground">Stato</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <Settings className="h-8 w-8 text-purple-500 mb-2" />
              <Badge variant={error ? "destructive" : "default"}>
                {error ? 'Errore' : 'OK'}
              </Badge>
              <span className="text-sm text-muted-foreground">Sistema</span>
            </div>
          </div>

          <Separator />

          {/* Test Controls */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Individuali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={testBasicNotifications}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <Bell className="h-5 w-5" />
                <span className="text-sm">Notifiche Base</span>
              </Button>

              <Button
                onClick={testSystemEvents}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm">Eventi Sistema</span>
              </Button>

              <Button
                onClick={testProfileEvents}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <User className="h-5 w-5" />
                <span className="text-sm">Eventi Profilo</span>
              </Button>

              <Button
                onClick={testNotificationManagement}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">Gestione</span>
              </Button>
            </div>

            <div className="flex space-x-4">
              <Button onClick={runAllTests} className="flex-1">
                <TestTube className="h-4 w-4 mr-2" />
                Esegui Tutti i Test
              </Button>
              <Button onClick={clearTestResults} variant="outline">
                Pulisci Risultati
              </Button>
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Risultati Test</h3>
              <Badge variant="outline">
                {testResults.length} risultati
              </Badge>
            </div>

            <div className="bg-black/10 dark:bg-black/30 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
              <div className="font-mono text-sm space-y-1">
                {testResults.length > 0 ? (
                  testResults.map((result, index) => (
                    <div key={index} className="text-gray-300">
                      {result}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">
                    Nessun test eseguito - Clicca un pulsante per iniziare...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current Notifications Preview */}
          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Notifiche Correnti</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        {notification.type === NotificationType.SYSTEM && <Info className="h-4 w-4 text-blue-500" />}
                        {notification.type === NotificationType.PROFILE && <User className="h-4 w-4 text-green-500" />}
                        {notification.type === NotificationType.SECURITY && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {notification.type === NotificationType.UPDATE && <Zap className="h-4 w-4 text-purple-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {notification.priority}
                          </Badge>
                          {!notification.readAt && (
                            <Badge variant="default" className="text-xs">
                              Non letta
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {notifications.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground">
                      ... e altre {notifications.length - 5} notifiche
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationIntegrationTest;