'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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



