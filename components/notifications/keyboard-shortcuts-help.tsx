'use client';

import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getKeyboardShortcuts } from '@/lib/notification-accessibility';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const shortcuts = getKeyboardShortcuts();

  if (!isOpen) return null;

  // Raggruppa le scorciatoie per categoria
  const globalShortcuts = Object.entries(shortcuts).filter(([key]) => 
    key.includes('Ctrl+Shift+N') || key.includes('F2') || key.includes('Ctrl+Alt+B')
  );
  
  const navigationShortcuts = Object.entries(shortcuts).filter(([key]) => 
    key.includes('Arrow') || key.includes('Home') || key.includes('End') || key.includes('Tab')
  );
  
  const actionShortcuts = Object.entries(shortcuts).filter(([key]) => 
    !key.includes('Arrow') && !key.includes('Home') && !key.includes('End') && 
    !key.includes('Tab') && !key.includes('Ctrl+Shift+N') && 
    !key.includes('F2') && !key.includes('Ctrl+Alt+B')
  );

  const renderShortcutGroup = (title: string, shortcuts: [string, string][]) => (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      <div className="space-y-2">
        {shortcuts.map(([key, description]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground flex-1">{description}</span>
            <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
              {key}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm",
        className
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Guida scorciatoie tastiera"
    >
      <div 
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-background border rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="document"
        aria-labelledby="shortcuts-help-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 id="shortcuts-help-title" className="text-lg font-semibold">
              Scorciatoie Tastiera
            </h3>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Chiudi guida scorciatoie"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Introduzione */}
            <div className="text-sm text-muted-foreground">
              <p>
                Usa queste scorciatoie per navigare velocemente nel sistema di notifiche. 
                Le scorciatoie globali funzionano ovunque nell'applicazione, mentre quelle 
                di navigazione sono attive solo quando il centro notifiche è aperto.
              </p>
            </div>

            {/* Scorciatoie globali */}
            {globalShortcuts.length > 0 && renderShortcutGroup('Scorciatoie Globali', globalShortcuts)}

            {/* Scorciatoie di navigazione */}
            {navigationShortcuts.length > 0 && renderShortcutGroup('Navigazione', navigationShortcuts)}

            {/* Scorciatoie di azione */}
            {actionShortcuts.length > 0 && renderShortcutGroup('Azioni', actionShortcuts)}

            {/* Suggerimenti */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">💡 Suggerimenti</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Usa le frecce per navigare rapidamente tra le notifiche</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">M</Badge> per marcare velocemente una notifica come letta</li>
                <li>• La modalità selezione ti permette di gestire più notifiche contemporaneamente</li>
                <li>• Le scorciatoie funzionano anche con screen reader attivi</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-muted/20">
          <Button onClick={onClose} size="sm">
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;