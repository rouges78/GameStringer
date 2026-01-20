'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, Check, X, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { offlineSupportService, type OfflineStatus } from '@/lib/offline-support';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setStatus(offlineSupportService.getStatus());
    
    const unsubscribe = offlineSupportService.onStatusChange(() => {
      setStatus(offlineSupportService.getStatus());
    });

    return unsubscribe;
  }, []);

  if (!status) return null;

  const features = offlineSupportService.getOfflineFeatures();
  const availableOffline = features.filter(f => f.available).length;
  const cacheSize = offlineSupportService.formatCacheSize();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 relative",
            !status.isOnline && "text-yellow-500"
          )}
        >
          {status.isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {!status.isOnline && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status.isOnline ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="font-medium">Online</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="font-medium text-yellow-500">Offline</span>
                </>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              <HardDrive className="h-3 w-3 mr-1" />
              {cacheSize}
            </Badge>
          </div>

          {/* Cache Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/50 rounded">
              <p className="text-lg font-bold">{status.cachedData.translations}</p>
              <p className="text-xs text-muted-foreground">Translations</p>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <p className="text-lg font-bold">{status.cachedData.games}</p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <p className="text-lg font-bold">{status.cachedData.packs}</p>
              <p className="text-xs text-muted-foreground">Packs</p>
            </div>
          </div>

          <Separator />

          {/* Offline Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Offline Features</span>
              <span className="text-xs text-muted-foreground">
                {availableOffline}/{features.length} available
              </span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between p-2 rounded text-sm",
                    feature.available ? "bg-green-500/10" : "bg-muted/30"
                  )}
                >
                  <span className={cn(!feature.available && "text-muted-foreground")}>
                    {feature.name}
                  </span>
                  {feature.available ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {!status.isOnline && status.lastOnline && (
            <p className="text-xs text-muted-foreground text-center">
              Ultimo online: {new Date(status.lastOnline).toLocaleString('it-IT')}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default OfflineIndicator;
