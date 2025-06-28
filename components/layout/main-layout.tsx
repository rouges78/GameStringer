
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Gamepad2, 
  Languages, 
  Zap, 
  FileText, 
  Archive, 
  Store, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Giochi', href: '/games', icon: Gamepad2 },
  { name: 'Traduttore', href: '/translator', icon: Languages },
  { name: 'Libreria', href: '/library', icon: Gamepad2 }, // Usiamo un'icona adatta
  { name: 'Tempo Reale', href: '/realtime', icon: Zap },
  { name: 'Editor', href: '/editor', icon: FileText },
  { name: 'Patch', href: '/patches', icon: Archive },
  { name: 'Store', href: '/stores', icon: Store },
  { name: 'Impostazioni', href: '/settings', icon: Settings },
];

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="relative flex items-center justify-center h-52 px-4 border-b">
            <div className="flex items-center">
              <Image src="/logo.png" alt="GameStringer Logo" width={768} height={192} className="w-auto h-48" priority />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-4 -translate-y-1/2 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start space-x-3",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t">
            <div className="text-sm text-muted-foreground">
              <p>Versione 3.2.1</p>
              <p> 2024 GameStringer</p>
            </div>
          </div>
        </aside>

        {/* Overlay per mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-card border-b flex items-center justify-between px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 lg:flex-none">
              <h1 className="text-xl font-semibold">
                {navigationItems.find(item => item.href === pathname)?.name || 'GameStringer'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Sistema Online</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
  );
}
