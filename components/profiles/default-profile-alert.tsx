'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, X, Eye, EyeOff } from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';

export function DefaultProfileAlert() {
  const { currentProfile } = useProfiles();
  const [isVisible, setIsVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    // Mostra l'alert solo se il profilo corrente è "Default"
    if (currentProfile?.name === 'Default') {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [currentProfile]);

  if (!isVisible) {
    return null;
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
            🔧 Default Profile Active
          </p>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            You are using the automatically created default profile. 
            <br />
            <strong>Username:</strong> Default
            <br />
            <strong>Password:</strong> 
            <span className="ml-1 font-mono">
              {showPassword ? 'password123' : '••••••••••'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-auto p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </p>
          <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
            💡 You can create a new custom profile from profile settings.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-auto p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}


