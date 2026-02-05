'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Languages, TrendingUp, Clock, Target, Award,
  Flame, Calendar, AlertTriangle, CheckCircle2, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectProgress {
  id: string;
  name: string;
  totalStrings: number;
  translatedStrings: number;
  reviewedStrings: number;
  targetLanguage: string;
  lastActivity: number;
  qualityScore: number;
}

interface GlobalProgressWidgetProps {
  projects: ProjectProgress[];
  className?: string;
}

export function GlobalProgressWidget({ projects, className }: GlobalProgressWidgetProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'projects' | 'insights'>('overview');

  // Aggregate stats
  const stats = useMemo(() => {
    const totalStrings = projects.reduce((sum, p) => sum + p.totalStrings, 0);
    const translatedStrings = projects.reduce((sum, p) => sum + p.translatedStrings, 0);
    const reviewedStrings = projects.reduce((sum, p) => sum + p.reviewedStrings, 0);
    const avgQuality = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.qualityScore, 0) / projects.length)
      : 0;

    const activeProjects = projects.filter(p => 
      Date.now() - p.lastActivity < 7 * 24 * 60 * 60 * 1000
    ).length;

    const completedProjects = projects.filter(p => 
      p.translatedStrings === p.totalStrings
    ).length;

    const languages = new Set(projects.map(p => p.targetLanguage)).size;

    return {
      totalStrings,
      translatedStrings,
      reviewedStrings,
      overallProgress: totalStrings > 0 ? Math.round((translatedStrings / totalStrings) * 100) : 0,
      reviewProgress: translatedStrings > 0 ? Math.round((reviewedStrings / translatedStrings) * 100) : 0,
      avgQuality,
      activeProjects,
      completedProjects,
      totalProjects: projects.length,
      languages,
    };
  }, [projects]);

  // Milestones
  const milestones = useMemo(() => {
    const milestoneThresholds = [25, 50, 75, 100];
    return milestoneThresholds.map(threshold => ({
      threshold,
      reached: stats.overallProgress >= threshold,
      label: threshold === 100 ? '🎉 Completato!' : `${threshold}%`,
    }));
  }, [stats.overallProgress]);

  // Streak calculation (mock)
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    // In real app, calculate from activity data
    const storedStreak = localStorage.getItem('translation_streak');
    setStreak(storedStreak ? parseInt(storedStreak, 10) : 0);
  }, []);

  // Estimated completion
  const estimatedCompletion = useMemo(() => {
    if (stats.overallProgress >= 100) return null;
    if (stats.overallProgress === 0) return null;
    
    // Assume average of 50 strings/day based on activity
    const remaining = stats.totalStrings - stats.translatedStrings;
    const daysNeeded = Math.ceil(remaining / 50);
    const date = new Date();
    date.setDate(date.getDate() + daysNeeded);
    return date;
  }, [stats]);

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 70) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-blue-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Progresso Globale</h3>
              <p className="text-sm text-white/80">{stats.totalProjects} progetti attivi</p>
            </div>
          </div>
          
          {/* Streak Badge */}
          {streak > 0 && (
            <Badge className="bg-orange-500 text-white gap-1">
              <Flame className="h-3 w-3" />
              {streak} giorni
            </Badge>
          )}
        </div>

        {/* Main Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>{stats.translatedStrings.toLocaleString()} / {stats.totalStrings.toLocaleString()} stringhe</span>
            <span className="font-bold">{stats.overallProgress}%</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${stats.overallProgress}%` }}
            />
          </div>
          
          {/* Milestones */}
          <div className="flex justify-between mt-1">
            {milestones.map((m, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      m.reached ? 'bg-white text-purple-600' : 'bg-white/30 text-white/70'
                    )}>
                      {m.reached ? '✓' : m.threshold}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{m.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* View Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['overview', 'projects', 'insights'] as const).map(view => (
            <Button
              key={view}
              variant={selectedView === view ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setSelectedView(view)}
            >
              {view === 'overview' && 'Panoramica'}
              {view === 'projects' && 'Progetti'}
              {view === 'insights' && 'Insights'}
            </Button>
          ))}
        </div>

        {/* Overview View */}
        {selectedView === 'overview' && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Languages className="h-4 w-4" />}
              label="Lingue"
              value={stats.languages.toString()}
              color="text-blue-500"
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Completati"
              value={`${stats.completedProjects}/${stats.totalProjects}`}
              color="text-green-500"
            />
            <StatCard
              icon={<Award className="h-4 w-4" />}
              label="Qualità Media"
              value={`${stats.avgQuality}%`}
              color={getQualityColor(stats.avgQuality)}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Revisionate"
              value={`${stats.reviewProgress}%`}
              color="text-purple-500"
            />
            
            {estimatedCompletion && (
              <div className="col-span-2 p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Completamento stimato</p>
                  <p className="font-medium">
                    {estimatedCompletion.toLocaleDateString('it-IT', { 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects View */}
        {selectedView === 'projects' && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun progetto attivo
              </p>
            ) : (
              projects
                .sort((a, b) => b.lastActivity - a.lastActivity)
                .map(project => {
                  const progress = project.totalStrings > 0
                    ? Math.round((project.translatedStrings / project.totalStrings) * 100)
                    : 0;
                  
                  return (
                    <div key={project.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate max-w-[150px]">
                            {project.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {project.targetLanguage}
                          </Badge>
                        </div>
                        <span className="text-sm font-bold">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{project.translatedStrings}/{project.totalStrings}</span>
                        <span>Qualità: {project.qualityScore}%</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* Insights View */}
        {selectedView === 'insights' && (
          <div className="space-y-3">
            {stats.overallProgress < 50 && (
              <InsightCard
                icon={<AlertTriangle className="h-4 w-4" />}
                type="warning"
                title="Progresso lento"
                description="Considera la traduzione batch con AI per velocizzare"
              />
            )}
            {stats.avgQuality < 70 && (
              <InsightCard
                icon={<AlertTriangle className="h-4 w-4" />}
                type="warning"
                title="Qualità sotto la media"
                description="Rivedi le traduzioni per migliorare il punteggio"
              />
            )}
            {stats.reviewProgress < 30 && stats.translatedStrings > 100 && (
              <InsightCard
                icon={<Target className="h-4 w-4" />}
                type="info"
                title="Revisioni in ritardo"
                description={`${stats.translatedStrings - stats.reviewedStrings} stringhe da revisionare`}
              />
            )}
            {stats.completedProjects > 0 && (
              <InsightCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                type="success"
                title="Ottimo lavoro!"
                description={`${stats.completedProjects} progetti completati al 100%`}
              />
            )}
            {streak >= 7 && (
              <InsightCard
                icon={<Flame className="h-4 w-4" />}
                type="success"
                title="Streak settimanale!"
                description={`${streak} giorni consecutivi di traduzioni`}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function InsightCard({
  icon,
  type,
  title,
  description,
}: {
  icon: React.ReactNode;
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
}) {
  const colors = {
    success: 'bg-green-500/10 border-green-500/20 text-green-600',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
  };

  return (
    <div className={cn('p-3 rounded-lg border', colors[type])}>
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs opacity-80">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default GlobalProgressWidget;
