'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Heart, Coffee, Github, ExternalLink } from 'lucide-react';

interface SupportButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

// Configura questi link quando crei gli account
const SUPPORT_LINKS = {
  kofi: 'https://ko-fi.com/gamestringer', // Cambia con il tuo username
  github: 'https://github.com/sponsors/rouges78', // Cambia con il tuo username
  paypal: '', // Opzionale: https://paypal.me/tuousername
};

export function SupportButton({ 
  variant = 'ghost', 
  size = 'sm',
  showLabel = true,
  className = ''
}: SupportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenLink = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop blur overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60]" />
      )}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={`text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 group ${className}`}
        >
          <Heart className="h-4 w-4 animate-pulse fill-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] group-hover:scale-125 transition-transform" />
          {showLabel && <span className="ml-1.5">Support</span>}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56 z-[70]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-pink-500" />
          Support GameStringer
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleOpenLink(SUPPORT_LINKS.kofi)}
          className="cursor-pointer"
        >
          <Coffee className="h-4 w-4 mr-2 text-yellow-500" />
          <div className="flex-1">
            <p className="font-medium">Ko-fi</p>
            <p className="text-xs text-muted-foreground">Buy me a coffee ☕</p>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleOpenLink(SUPPORT_LINKS.github)}
          className="cursor-pointer"
        >
          <Github className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <p className="font-medium">GitHub Sponsors</p>
            <p className="text-xs text-muted-foreground">Sponsor on GitHub</p>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <div className="px-2 py-2">
          <p className="text-[10px] text-muted-foreground text-center">
            GameStringer is free and open source.<br />
            Your support helps development! 💜
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}



