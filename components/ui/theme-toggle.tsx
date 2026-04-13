'use client';

import { Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  // Dark mode forzato — l'app non supporta tema chiaro
  return (
    <Button variant="outline" size="icon" className="h-8 w-8" disabled title="Dark mode">
      <Moon className="h-4 w-4" />
      <span className="sr-only">Dark mode</span>
    </Button>
  );
}

export function ThemeSelector() {
  // Dark mode forzato — l'app non supporta tema chiaro
  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        size="sm"
        className="flex-1"
        disabled
      >
        <Moon className="h-4 w-4 mr-2" />
        Dark
      </Button>
    </div>
  );
}



