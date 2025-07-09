
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
  X,
  Bug,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVersion } from '@/lib/version';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Libreria', href: '/library', icon: Gamepad2 },
  { name: 'Neural Translator', href: '/injekt-translator', icon: Zap },
  { name: 'Editor', href: '/editor', icon: FileText },
  { name: 'Dialogue Patcher', href: '/dialogue-patcher', icon: Languages },
  { name: 'Patch', href: '/patches', icon: Archive },
  { name: 'Stores Manager', href: '/store-manager', icon: Store },
  { name: 'Impostazioni', href: '/settings', icon: Settings },
];

interface SystemStatus {
  neuralEngine: { status: 'online' | 'offline' | 'error'; color: string; text: string };
  steamApi: { status: 'connected' | 'disconnected' | 'error'; color: string; text: string };
  cache: { percentage: number; color: string; text: string };
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    neuralEngine: { status: 'online', color: 'bg-green-500', text: 'ON' },
    steamApi: { status: 'connected', color: 'bg-blue-500', text: 'OK' },
    cache: { percentage: 0, color: 'bg-purple-500', text: '0%' }
  });
  const pathname = usePathname();
  const { version, buildInfo } = useVersion();

  useEffect(() => {
    setIsMounted(true);
    // Carica preferenza sidebar dal localStorage
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setSidebarOpen(JSON.parse(savedSidebarState));
    }
    
    // Aggiorna status del sistema
    updateSystemStatus();
    const statusInterval = setInterval(updateSystemStatus, 10000); // Ogni 10 secondi
    
    return () => clearInterval(statusInterval);
  }, []);

  const updateSystemStatus = async () => {
    try {
      // Controlla Neural Engine (sempre online se l'app funziona)
      const neuralEngine = { 
        status: 'online' as const, 
        color: 'bg-green-500', 
        text: 'ON' 
      };

      // Controlla Steam API
      let steamApi = { 
        status: 'disconnected' as const, 
        color: 'bg-red-500', 
        text: 'OFF' 
      };
      
      try {
        const steamSettings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
        if (steamSettings.steam?.apiKey && steamSettings.steam?.steamId) {
          // Se API key e Steam ID sono configurati, assume connessione
          steamApi = { 
            status: 'connected', 
            color: 'bg-blue-500', 
            text: 'OK' 
          };
        }
      } catch (error) {
        console.error('Error checking Steam API status:', error);
      }

      // Calcola uso cache
      const cacheData = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) cacheData.push(value);
        }
      }
      
      const cacheSize = JSON.stringify(cacheData).length;
      const maxCache = 5 * 1024 * 1024; // 5MB max
      const cachePercentage = Math.min(Math.round((cacheSize / maxCache) * 100), 100);
      
      const cache = {
        percentage: cachePercentage,
        color: cachePercentage > 80 ? 'bg-red-500' : cachePercentage > 60 ? 'bg-yellow-500' : 'bg-purple-500',
        text: `${cachePercentage}%`
      };

      setSystemStatus({ neuralEngine, steamApi, cache });
    } catch (error) {
      console.error('Error updating system status:', error);
    }
  };

  // Salva preferenza sidebar
  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
  };

  if (!isMounted) {
    return null;
  }

  return (
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card border-r transform transition-all duration-300 ease-in-out",
            sidebarOpen ? "w-64 translate-x-0" : "w-16 translate-x-0"
          )}
        >
          {/* Header con logo e toggle */}
          <div className="relative flex items-center justify-center h-16 px-2 border-b">
            {sidebarOpen && (
              <div className="flex items-center flex-1 px-2">
                <Image 
                  src="/logo.png" 
                  alt="GameStringer Logo" 
                  width={200} 
                  height={50} 
                  className="w-full h-auto max-h-10" 
                  priority 
                />
              </div>
            )}
            
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-300 hover:bg-primary/10 hover:scale-110",
                sidebarOpen ? "ml-auto" : "mx-auto"
              )}
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4 transition-transform duration-300" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform duration-300 animate-pulse" />
              )}
            </Button>
          </div>
          
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full transition-all duration-300",
                      sidebarOpen 
                        ? "justify-start space-x-3 px-3" 
                        : "justify-center px-0",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    title={!sidebarOpen ? item.name : undefined}
                  >
                    <Icon className={cn(
                      "transition-all duration-300",
                      sidebarOpen ? "h-5 w-5" : "h-6 w-6"
                    )} />
                    {sidebarOpen && (
                      <span className="transition-opacity duration-300">
                        {item.name}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          {/* System Status Section */}
          <div className="p-2 border-t border-b bg-gradient-to-r from-slate-800/50 to-slate-700/50">
            {sidebarOpen ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">System Status</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">Neural Engine</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 ${systemStatus.neuralEngine.color} rounded-full animate-pulse`}></div>
                      <span className={`text-xs ${systemStatus.neuralEngine.color === 'bg-green-500' ? 'text-green-400' : 'text-red-400'}`}>
                        {systemStatus.neuralEngine.text}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">Steam API</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 ${systemStatus.steamApi.color} rounded-full animate-pulse`}></div>
                      <span className={`text-xs ${
                        systemStatus.steamApi.color === 'bg-blue-500' ? 'text-blue-400' : 
                        systemStatus.steamApi.color === 'bg-yellow-500' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {systemStatus.steamApi.text}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">Cache</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 ${systemStatus.cache.color} rounded-full animate-pulse`}></div>
                      <span className={`text-xs ${
                        systemStatus.cache.color === 'bg-purple-500' ? 'text-purple-400' : 
                        systemStatus.cache.color === 'bg-yellow-500' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {systemStatus.cache.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div 
                  className={`w-2 h-2 ${systemStatus.neuralEngine.color} rounded-full animate-pulse`} 
                  title={`Neural Engine - ${systemStatus.neuralEngine.text}`}
                ></div>
                <div 
                  className={`w-2 h-2 ${systemStatus.steamApi.color} rounded-full animate-pulse`} 
                  title={`Steam API - ${systemStatus.steamApi.text}`}
                ></div>
                <div 
                  className={`w-2 h-2 ${systemStatus.cache.color} rounded-full animate-pulse`} 
                  title={`Cache - ${systemStatus.cache.text}`}
                ></div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-2">
            {sidebarOpen ? (
              <div className="text-xs text-muted-foreground transition-opacity duration-300">
                <p className="font-mono">v{version}.{buildInfo.build}</p>
                <p>© 2024 GameStringer</p>
                <p className="text-xs text-gray-500 truncate" title={buildInfo.git}>
                  {buildInfo.git.slice(0, 7)}
                </p>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="text-xs text-gray-500 font-mono">v{version}</div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}>
          {/* Header */}
          <header className="h-16 bg-card border-b flex items-center justify-between px-6">
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                {navigationItems.find(item => item.href === pathname)?.name || 'GameStringer'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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
