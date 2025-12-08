'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Settings } from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';

interface ProfileManagerProps {
  onClose?: () => void;
}

export function ProfileManager({ onClose }: ProfileManagerProps) {
  const { currentProfile } = useProfiles();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profilo Corrente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{currentProfile?.name || 'Nessun profilo'}</h3>
                <p className="text-sm text-muted-foreground">Profilo attivo</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Impostazioni Profilo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Le impostazioni avanzate del profilo saranno disponibili in una futura versione.
          </p>
        </CardContent>
      </Card>

      {onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose}>Chiudi</Button>
        </div>
      )}
    </div>
  );
}
