'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { t } = useTranslation();

  // Forza dark mode all'avvio — corregge qualsiasi stato salvato errato
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('gamestringer-theme', 'dark');
  }, []);

  // Dark mode forzato — l'app non supporta tema chiaro
  return (
    <Button variant="ghost" size="sm" className={className} disabled title="Dark mode">
      <Moon className="h-4 w-4" />
      <span className="sr-only">Dark mode</span>
    </Button>
  );
};

export default ThemeToggle;



