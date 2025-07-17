'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Activity, 
  Clock, 
  HardDrive, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface DatabaseHealthData {
  status: 'healthy' | 'unhealthy' | 'error';
  timestamp: string;
  latency: number;
  uptime: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  detailed?: {
    version?: string;
    diskSpace?: {
      used: number;
      available: number;
      total: number;
    };
    errors?: string[];
    stats?: {
      tables: Array<{
        name: string;
        rowCount: number;
        size?: number;
      }>;
      totalRows: number;
      performance: {
        avgQueryTime: number;
        slowQueries: number;
      };
    };
  };
  errors?: string[];
}

export default function DatabaseHealthPage() {
  const [healthData, setHealthData] = useState<DatabaseHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchHealthData = async (detailed: boolean = false, force: boolean = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (detailed) params.set('detailed', 'true');
      if (force) params.set('force', 'true');
      
      const response = await fetch(`/api/health/database?${params}`);
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      setHealthData({
        status: 'error',
        timestamp: new Date().toISOString(),
        latency: 0,
        uptime: 0,
        connections: { active: 0, idle: 0, total: 0 },
        errors: ['Failed to fetch health data']
      });
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string, options?: any) => {
    try {
      const response = await fetch('/api/health/database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...options }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Action ${action} completed:`, result);
        await fetchHealthData(true, true); // Refresh data after action
      } else {
        console.error(`Action ${action} failed:`, result);
      }
    } catch (error) {
      console.error(`Failed to perform action ${action}:`, error);
    }
  };

  const toggleAutoRefresh = () => {
    if (autoRefresh) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      setAutoRefresh(false);
    } else {
      const interval = setInterval(() => {
        fetchHealthData(true);
      }, 30000); // 30 seconds
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  useEffect(() => {
    fetchHealthData(true);
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'healthy' ? 'default' : 'destructive';
    const color = status === 'healthy' ? 'bg-green-500' : 
                  status === 'unhealthy' ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <Badge variant={variant} className={color}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Database Health Monitor</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleAutoRefresh}
            className={autoRefresh ? 'bg-green-100' : ''}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={() => fetchHealthData(true, true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {healthData && (
        <>
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData.status)}
                Database Status
                {getStatusBadge(healthData.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Last Check</p>
                  <p className="font-medium">
                    {new Date(healthData.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Response Time</p>
                  <p className="font-medium">{healthData.latency}ms</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                  <p className="font-medium">{formatUptime(healthData.uptime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Connections</p>
                  <p className="font-medium">
                    {healthData.connections.active}/{healthData.connections.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {healthData.errors && healthData.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {healthData.errors.map((error, index) => (
                    <li key={index} className="text-red-600 text-sm">
                      • {error}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Database Info */}
          {healthData.detailed && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Database Version & Disk Space */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {healthData.detailed.version && (
                      <div>
                        <p className="text-sm text-muted-foreground">Version</p>
                        <p className="font-medium">{healthData.detailed.version}</p>
                      </div>
                    )}
                    {healthData.detailed.diskSpace && (
                      <div>
                        <p className="text-sm text-muted-foreground">Database Size</p>
                        <p className="font-medium">
                          {formatBytes(healthData.detailed.diskSpace.used)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Performance Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {healthData.detailed.stats && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Query Time</p>
                          <p className="font-medium">
                            {healthData.detailed.stats.performance.avgQueryTime}ms
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Records</p>
                          <p className="font-medium">
                            {healthData.detailed.stats.totalRows.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Slow Queries</p>
                          <p className="font-medium">
                            {healthData.detailed.stats.performance.slowQueries}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tables Stats */}
              {healthData.detailed.stats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Table Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {healthData.detailed.stats.tables.map((table) => (
                        <div key={table.name} className="border rounded-lg p-3">
                          <h4 className="font-medium">{table.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {table.rowCount.toLocaleString()} rows
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Database Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => performAction('reconnect')}
                  className="flex items-center gap-2"
                >
                  <Database className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  onClick={() => performAction('start-monitoring', { interval: 60000 })}
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Start Monitoring
                </Button>
                <Button
                  variant="outline"
                  onClick={() => performAction('stop-monitoring')}
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Stop Monitoring
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}