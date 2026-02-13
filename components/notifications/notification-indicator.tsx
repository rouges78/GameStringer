'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { announceNotificationCount, createHelpText } from '@/lib/notification-accessibility';
import { open } from '@tauri-apps/plugin-shell';
import { toast } from 'sonner';

interface NotificationIndicatorProps {
  onClick?: () => void;
  className?: string;
  showBadge?: boolean;
  maxCount?: number;
  animate?: boolean;
}

export const NotificationIndicator: React.FC<NotificationIndicatorProps> = ({
  onClick,
  className,
  showBadge = true,
  maxCount = 99,
  animate = true
}) => {
  const { unreadCount, isLoading } = useNotifications();
  const { hasUpdate, updateInfo, showPopup, setShowPopup, dismissUpdate } = useUpdateCheck();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCount, setPrevCount] = useState(unreadCount);
  const [lastAnnouncedCount, setLastAnnouncedCount] = useState(0);

  // Animazione e annunci screen reader quando arrivano nuove notifiche o update
  useEffect(() => {
    if ((animate && unreadCount > prevCount && unreadCount > 0) || hasUpdate) {
      setIsAnimating(true);
      
      // Annuncia le nuove notifiche agli screen reader
      if (unreadCount !== lastAnnouncedCount) {
        announceNotificationCount(unreadCount, lastAnnouncedCount);
        setLastAnnouncedCount(unreadCount);
      }
      
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount, animate, lastAnnouncedCount, hasUpdate]);

  // Testo di aiuto per screen reader
  const helpText = createHelpText('indicator');

  const displayCount = unreadCount > maxCount ? `${maxCount}+` : unreadCount.toString();
  const hasNotifications = unreadCount > 0 || hasUpdate;

  // Parse release notes
  const parseReleaseNotes = (notes: string) => {
    return notes
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').replace(/`[^`]*`/g, '').trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('Download'))
      .map(line => line.length > 60 ? line.substring(0, 57) + '...' : line);
  };

  const releaseItems = updateInfo?.release_notes ? parseReleaseNotes(updateInfo.release_notes) : [];

  const handleDownload = async () => {
    if (updateInfo?.download_url) {
      try {
        await open(updateInfo.download_url);
        toast.success('Browser aperto per il download!');
      } catch (e) {
        window.open(updateInfo.download_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleClick = () => {
    if (hasUpdate) {
      setShowPopup(!showPopup);
    } else if (onClick) {
      onClick();
    }
  };

  // Genera descrizione dettagliata per screen reader
  const getAriaLabel = () => {
    if (isLoading) return 'Loading notifications...';
    if (!hasNotifications) return 'No unread notifications. Click to open notification center.';
    
    const countText = unreadCount === 1 ? '1 unread notification' : `${unreadCount} unread notifications`;
    return `${countText}. Click to open notification center.`;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className={cn(
          "relative h-10 w-10 rounded-full transition-all duration-200",
          "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isAnimating && "animate-pulse",
          hasUpdate && "ring-2 ring-emerald-500/50",
          className
        )}
        aria-label={getAriaLabel()}
        aria-describedby={hasNotifications ? "notification-count-description notification-help" : "notification-help"}
        disabled={isLoading}
        type="button"
      >
        {/* Testo di aiuto nascosto per screen reader */}
        <div id="notification-help" className="sr-only">
          {helpText}
        </div>
        {/* Icona campana */}
        <div className="relative">
          {hasUpdate ? (
            <BellRing 
              className={cn(
                "h-5 w-5 transition-all duration-200 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse"
              )}
              aria-hidden="true"
            />
          ) : hasNotifications ? (
            <BellRing 
              className={cn(
                "h-5 w-5 transition-all duration-200 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]",
                isAnimating && "animate-bounce"
              )}
              aria-hidden="true"
            />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
          
          {/* Indicatore animato per nuove notifiche */}
          {(isAnimating || hasUpdate) && (
            <div className="absolute -top-1 -right-1" aria-hidden="true">
              <div className={cn(
                "h-2 w-2 rounded-full animate-ping",
                hasUpdate ? "bg-emerald-500" : "bg-primary"
              )} />
            </div>
          )}
        </div>

        {/* Descrizione nascosta per screen reader */}
        {hasNotifications && (
          <div id="notification-count-description" className="sr-only">
            {hasUpdate 
              ? `Update available: ${updateInfo?.latest_version}`
              : unreadCount === 1 
                ? 'You have 1 unread notification' 
                : `You have ${unreadCount} unread notifications`
            }
          </div>
        )}

        {/* Badge conteggio o update */}
        {showBadge && hasUpdate && (
          <Badge
            className={cn(
              "absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1",
              "text-xs font-medium flex items-center justify-center",
              "transition-all duration-200 transform bg-emerald-500 hover:bg-emerald-600",
              "animate-pulse"
            )}
            aria-hidden="true"
          >
            <Download className="h-3 w-3" />
          </Badge>
        )}
        
        {showBadge && !hasUpdate && unreadCount > 0 && (
          <Badge
            variant="destructive"
            className={cn(
              "absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1",
              "text-xs font-medium flex items-center justify-center",
              "transition-all duration-200 transform",
              isAnimating && "scale-110"
            )}
            aria-hidden="true"
          >
            {displayCount}
          </Badge>
        )}
        
        {/* Indicatore semplice senza conteggio */}
        {!showBadge && hasNotifications && (
          <div 
            className={cn(
              "absolute -top-1 -right-1 h-3 w-3 rounded-full",
              "border-2 border-background",
              hasUpdate ? "bg-emerald-500 animate-pulse" : "bg-red-500",
              isAnimating && "animate-pulse"
            )}
            aria-hidden="true"
          />
        )}
      </Button>

      {/* Popup aggiornamento */}
      {showPopup && hasUpdate && updateInfo && (
        <div className="absolute top-12 right-0 z-[9999] animate-in slide-in-from-top-2 fade-in duration-200 pointer-events-auto">
          <div className="bg-slate-900 rounded-xl shadow-2xl shadow-black/50 w-[340px] border border-slate-700/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm leading-tight">
                    Aggiornamento disponibile!
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Versione <span className="font-mono text-emerald-400">{updateInfo.latest_version}</span>
                    <span className="text-slate-500"> (attuale: {updateInfo.current_version})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {releaseItems.length > 0 && (
              <div className="px-4 pb-2">
                <p className="text-slate-500 text-[9px] uppercase tracking-widest mb-1.5">Novità</p>
                <ul className="space-y-0.5 max-h-[120px] overflow-y-auto pr-1">
                  {releaseItems.slice(0, 6).map((item, i) => (
                    <li key={i} className="text-slate-300 text-[11px] flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-500 mt-px shrink-0">•</span>
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex gap-2 px-4 py-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 h-8 text-xs px-4 rounded-lg font-medium shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Scarica
              </button>
              <button
                type="button"
                onClick={dismissUpdate}
                className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 text-xs px-3 rounded-lg transition-all"
              >
                Dopo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationIndicator;


