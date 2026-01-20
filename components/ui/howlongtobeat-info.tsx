'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Gamepad2, Trophy, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface HowLongToBeatData {
  found: boolean;
  name?: string;
  imageUrl?: string;
  times?: {
    mainStory?: { hours: number; label: string };
    mainExtra?: { hours: number; label: string };
    completionist?: { hours: number; label: string };
  };
}

interface HowLongToBeatInfoProps {
  gameName: string;
  currentPlaytime?: number; // in hours
}

export function HowLongToBeatInfo({ gameName, currentPlaytime = 0 }: HowLongToBeatInfoProps) {
  const [data, setData] = useState<HowLongToBeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHLTBData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/utilities/howlongtobeat?name=${encodeURIComponent(gameName)}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Error fetching data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (gameName) {
      fetchHLTBData();
    }
  }, [gameName]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            HowLongToBeat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.found) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            HowLongToBeat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error || 'No information found for this game'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getProgressPercentage = (targetHours: number) => {
    if (!targetHours || targetHours === 0) return 0;
    return Math.min((currentPlaytime / targetHours) * 100, 100);
  };

  const formatHours = (hours: number) => {
    if (!hours) return 'N/D';
    return `${hours}h`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Tempi di Completamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.times?.mainStory && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">{data.times.mainStory.label}</span>
              </div>
              <span className="text-sm font-bold">{formatHours(data.times.mainStory.hours)}</span>
            </div>
            {currentPlaytime > 0 && (
              <div className="space-y-1">
                <Progress value={getProgressPercentage(data.times.mainStory.hours)} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {currentPlaytime}h / {data.times.mainStory.hours}h ({Math.round(getProgressPercentage(data.times.mainStory.hours))}%)
                </p>
              </div>
            )}
          </div>
        )}

        {data.times?.mainExtra && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{data.times.mainExtra.label}</span>
              </div>
              <span className="text-sm font-bold">{formatHours(data.times.mainExtra.hours)}</span>
            </div>
            {currentPlaytime > 0 && (
              <div className="space-y-1">
                <Progress value={getProgressPercentage(data.times.mainExtra.hours)} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {currentPlaytime}h / {data.times.mainExtra.hours}h ({Math.round(getProgressPercentage(data.times.mainExtra.hours))}%)
                </p>
              </div>
            )}
          </div>
        )}

        {data.times?.completionist && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">{data.times.completionist.label}</span>
              </div>
              <span className="text-sm font-bold">{formatHours(data.times.completionist.hours)}</span>
            </div>
            {currentPlaytime > 0 && (
              <div className="space-y-1">
                <Progress value={getProgressPercentage(data.times.completionist.hours)} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {currentPlaytime}h / {data.times.completionist.hours}h ({Math.round(getProgressPercentage(data.times.completionist.hours))}%)
                </p>
              </div>
            )}
          </div>
        )}

        {currentPlaytime > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Tempo di game attuale: <span className="font-semibold">{currentPlaytime} ore</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


