'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  AlertTriangle,
  Info,
  Bug,
  Activity,
  Users,
  Server,
  Clock
} from 'lucide-react';
import { useLogging } from '@/hooks/useLogging';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  component?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byComponent: Record<string, number>;
  recentErrors: number;
}

export function LoggingDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({
    total: 0,
    byLevel: {},
    byComponent: {},
    recentErrors: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const { logUserAction } = useLogging({ component: 'LOGGING_DASHBOARD' });

  // Mock data for demonstration
  const mockLogs: LogEntry[] = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'User logged in successfully',
      component: 'AUTH',
      metadata: { userId: 'user123', ip: '192.168.1.1' }
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'error',
      message: 'Failed to connect to Steam API',
      component: 'STEAM',
      error: {
        name: 'ConnectionError',
        message: 'ECONNREFUSED',
        stack: 'Error: ECONNREFUSED\n  at ...'
      },
      metadata: { endpoint: 'api.steampowered.com', retryCount: 3 }
    },
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'warn',
      message: 'High memory usage detected',
      component: 'SYSTEM',
      metadata: { memoryUsage: '85%', threshold: '80%' }
    },
    {
      timestamp: new Date(Date.now() - 180000).toISOString(),
      level: 'info',
      message: 'Translation job completed',
      component: 'TRANSLATOR',
      metadata: { gameId: 'game123', translationsCount: 150, duration: 2300 }
    }
  ];

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch from your logging API
      setLogs(mockLogs);
      
      // Calculate stats
      const total = mockLogs.length;
      const byLevel = mockLogs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const byComponent = mockLogs.reduce((acc, log) => {
        const component = log.component || 'Unknown';
        acc[component] = (acc[component] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recentErrors = mockLogs.filter(log => 
        log.level === 'error' && 
        new Date(log.timestamp).getTime() > Date.now() - 3600000 // Last hour
      ).length;
      
      setStats({ total, byLevel, byComponent, recentErrors });
      
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      setStats({ total: 0, byLevel: {}, byComponent: {}, recentErrors: 0 });
      logUserAction('clear_logs');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logUserAction('export_logs');
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.component?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesComponent = componentFilter === 'all' || log.component === componentFilter;
    
    return matchesSearch && matchesLevel && matchesComponent;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'debug': return 'bg-gray-100 text-gray-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'fatal': return 'bg-red-600 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <Bug className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      case 'warn': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'fatal': return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logging Dashboard</h1>
          <p className="text-muted-foreground">Monitor application logs and errors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchLogs} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={clearLogs} variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.recentErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Components</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.byComponent).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="fatal">Fatal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={componentFilter} onValueChange={setComponentFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Component" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Components</SelectItem>
                {Object.keys(stats.byComponent).map(component => (
                  <SelectItem key={component} value={component}>
                    {component} ({stats.byComponent[component]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Log Entries ({filteredLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-4 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getLevelIcon(log.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Badge className={getLevelColor(log.level)}>
                            {log.level.toUpperCase()}
                          </Badge>
                          {log.component && (
                            <Badge variant="outline">{log.component}</Badge>
                          )}
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <p className="text-sm mt-1">{log.message}</p>
                        {log.error && (
                          <p className="text-xs text-destructive mt-1">
                            {log.error.name}: {log.error.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs by Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byLevel).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <Badge className={getLevelColor(level)}>{level.toUpperCase()}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Logs by Component</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byComponent).map(([component, count]) => (
                    <div key={component} className="flex items-center justify-between">
                      <Badge variant="outline">{component}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getLevelIcon(selectedLog.level)}
                Log Details
                <Badge className={getLevelColor(selectedLog.level)}>
                  {selectedLog.level.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                {new Date(selectedLog.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Message</h4>
                <p className="text-sm text-muted-foreground">{selectedLog.message}</p>
              </div>
              
              {selectedLog.component && (
                <div>
                  <h4 className="font-medium">Component</h4>
                  <Badge variant="outline">{selectedLog.component}</Badge>
                </div>
              )}
              
              {selectedLog.error && (
                <div>
                  <h4 className="font-medium">Error Details</h4>
                  <div className="bg-muted p-3 rounded">
                    <p className="text-sm"><strong>Name:</strong> {selectedLog.error.name}</p>
                    <p className="text-sm"><strong>Message:</strong> {selectedLog.error.message}</p>
                    {selectedLog.error.stack && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Stack Trace:</p>
                        <Textarea
                          value={selectedLog.error.stack}
                          readOnly
                          className="font-mono text-xs h-32"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {selectedLog.metadata && (
                <div>
                  <h4 className="font-medium">Metadata</h4>
                  <Textarea
                    value={JSON.stringify(selectedLog.metadata, null, 2)}
                    readOnly
                    className="font-mono text-xs h-32"
                  />
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => setSelectedLog(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}