'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Trash2,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  History,
  Gamepad2,
  Languages,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import {
  Wrench,
  RotateCcw,
  Plus,
  Play,
  User,
  Settings,
  Package,
  FileText,
} from 'lucide-react';
import {
  activityHistory,
  Activity,
  ActivityType,
  activityIcons,
  activityColors,
  activityNames,
} from '@/lib/activity-history';

const PAGE_SIZE = 15;

// Icone Lucide per tipo
const typeIcons: Record<ActivityType, React.ReactNode> = {
  translation: <Languages className="h-4 w-4" />,
  patch: <Wrench className="h-4 w-4" />,
  steam_sync: <RotateCcw className="h-4 w-4" />,
  game_added: <Plus className="h-4 w-4" />,
  game_launched: <Play className="h-4 w-4" />,
  profile_created: <User className="h-4 w-4" />,
  settings_changed: <Settings className="h-4 w-4" />,
  import_export: <Package className="h-4 w-4" />,
  translation_bridge: <Gamepad2 className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

export default function ActivityHistoryPage() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Load activities
  const loadActivities = useCallback(async (pageNum: number = 0, activityType?: ActivityType) => {
    setIsLoading(true);
    try {
      const result = await activityHistory.get({
        activity_type: activityType,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      
      if (result) {
        setActivities(result.activities);
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.has_more);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load counts by type
  const loadCounts = useCallback(async () => {
    const result = await activityHistory.countByType();
    setCounts(result);
  }, []);

  // Initial load
  useEffect(() => {
    loadActivities(0, filter === 'all' ? undefined : filter);
    loadCounts();
  }, [filter, loadActivities, loadCounts]);

  // Page change
  const handlePageChange = (newPage: number) => {
    loadActivities(newPage, filter === 'all' ? undefined : filter);
  };

  // Elimina singola attività
  const handleDelete = async (id: string) => {
    const success = await activityHistory.delete(id);
    if (success) {
      loadActivities(page, filter === 'all' ? undefined : filter);
      loadCounts();
    }
  };

  // Cancella tutto
  const handleClearAll = async () => {
    if (!confirm(t('activity.clearConfirm'))) return;
    
    const success = await activityHistory.clear();
    if (success) {
      setActivities([]);
      setTotal(0);
      setCounts({});
    }
  };

  // Colore badge per tipo
  const getColorClass = (type: ActivityType) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      slate: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return colorMap[activityColors[type]] || colorMap.slate;
  };

  // Totale attività
  const totalActivities = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800/50 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
              <History className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {t('activity.title')}
              </h1>
              <p className="text-muted-foreground">
                {totalActivities} attività registrate
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadActivities(0, filter === 'all' ? undefined : filter)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('common.search')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={totalActivities === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('activity.clearHistory')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['translation', 'patch', 'steam_sync', 'game_launched', 'other'] as ActivityType[]).map((type) => (
            <Card 
              key={type}
              className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:scale-105 ${
                filter === type ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setFilter(filter === type ? 'all' : type)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{activityIcons[type]}</span>
                  <div>
                    <p className="text-xl font-bold">{counts[type] || 0}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {activityNames[type]}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter by:</span>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as ActivityType | 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('activity.all')}</SelectItem>
              {(Object.keys(activityNames) as ActivityType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {activityIcons[type]} {activityNames[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {filter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
              {t('common.filter')}
            </Button>
          )}
        </div>

        {/* Activity List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              {total} results {filter !== 'all' && `(filter: ${activityNames[filter]})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity recorded</p>
                <p className="text-sm mt-1">Your actions will be tracked here</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 transition-colors group"
                    >
                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${getColorClass(activity.activity_type)}`}>
                        {typeIcons[activity.activity_type]}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{activity.title}</p>
                          <Badge variant="outline" className={`text-[10px] ${getColorClass(activity.activity_type)}`}>
                            {activityNames[activity.activity_type]}
                          </Badge>
                        </div>
                        
                        {activity.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {activity.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activityHistory.formatRelativeTime(activity.timestamp)}
                          </span>
                          {activity.game_name && (
                            <span className="flex items-center gap-1">
                              <Gamepad2 className="h-3 w-3" />
                              {activity.game_name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => handleDelete(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-muted-foreground">
                  Pagina {page + 1} di {Math.ceil(total / PAGE_SIZE)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Precedente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!hasMore || isLoading}
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



