'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Activity, 
  Clock, 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';

interface RateLimitStats {
  timestamp: string;
  statistics: Record<string, {
    requests: number;
    blocked: number;
    blockRate: number;
  }>;
  summary: {
    totalRequests: number;
    totalBlocked: number;
    overallBlockRate: number;
  };
}

export default function RateLimitDashboardPage() {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/rate-limit');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch rate limit stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetStats = async () => {
    try {
      const response = await fetch('/api/admin/rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset' }),
      });
      
      if (response.ok) {
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to reset stats:', error);
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
        fetchStats();
      }, 5000); // 5 seconds
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  const getStatusColor = (blockRate: number) => {
    if (blockRate < 5) return 'text-green-500';
    if (blockRate < 15) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = (blockRate: number) => {
    if (blockRate < 5) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (blockRate < 15) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const formatRate = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  useEffect(() => {
    fetchStats();
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Rate Limit Dashboard</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleAutoRefresh}
            className={autoRefresh ? 'bg-green-100' : ''}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={resetStats}>
            <Shield className="h-4 w-4 mr-2" />
            Reset Stats
          </Button>
        </div>
      </div>

      {stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalRequests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Since last reset
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.summary.totalBlocked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Rate limited
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Block Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(stats.summary.overallBlockRate)}`}>
                  {formatRate(stats.summary.overallBlockRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Percentage blocked
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(stats.timestamp).toLocaleTimeString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(stats.timestamp).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Statistics by Endpoint Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.statistics).map(([endpoint, stat]) => (
                  <div key={endpoint} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(stat.blockRate)}
                      <div>
                        <h4 className="font-medium capitalize">{endpoint}</h4>
                        <p className="text-sm text-muted-foreground">
                          {stat.requests} requests • {stat.blocked} blocked
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getStatusColor(stat.blockRate)}`}>
                        {formatRate(stat.blockRate)}
                      </div>
                      <p className="text-sm text-muted-foreground">block rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rate Limit Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Authentication Endpoints</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>• Window: 15 minutes</p>
                    <p>• Max requests: 10 per IP</p>
                    <p>• Scope: /api/auth, /login, /verify</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Translation Endpoints</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>• Window: 10 minutes</p>
                    <p>• Max requests: 50 per IP</p>
                    <p>• Scope: /api/translations, /api/translate</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Steam API Endpoints</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>• Window: 1 minute</p>
                    <p>• Max requests: 10 per IP</p>
                    <p>• Scope: /steam, /stores/status</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">AI Service Endpoints</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>• Window: 1 minute</p>
                    <p>• Max requests: 5 per IP</p>
                    <p>• Scope: /ai, /suggestions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}