'use client';

import Link from 'next/link';
import { Cpu, Gamepad2, Package, Download, Wand2, Zap, Shield, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnityPatcher } from '@/components/tools/unity-patcher';
import { useTranslation } from '@/lib/i18n';

export default function UnityPatcherPage() {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-sm shadow-lg">
              <Wand2 className="h-4 w-4 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{t('gamePatcher.title')}</h2>
              <p className="text-white/90 text-[10px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{t('gamePatcher.subtitle')}</p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Layers className="h-3 w-3" />
              <span className="text-sm font-bold">5</span>
              <span className="text-[10px] text-white/80">{t('gamePatcher.engines')}</span>
            </div>
            <div className="flex items-center gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Zap className="h-3 w-3" />
              <span className="text-sm font-bold">{t('gamePatcher.autoInstall')}</span>
              <span className="text-[10px] text-white/80">{t('gamePatcher.install')}</span>
            </div>
            <div className="flex items-center gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Shield className="h-3 w-3" />
              <span className="text-sm font-bold">{t('gamePatcher.safeBackup')}</span>
              <span className="text-[10px] text-white/80">{t('gamePatcher.backup')}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="relative flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-white/20">
          <span className="text-[10px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mr-1">{t('gamePatcher.otherPatchers')}</span>
          <Link href="/unreal-translator">
            <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Cpu className="h-3 w-3" />
              Unreal
            </Button>
          </Link>
          <Link href="/telltale-patcher">
            <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Gamepad2 className="h-3 w-3" />
              Telltale
            </Button>
          </Link>
          <Link href="/unity-bundle">
            <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Package className="h-3 w-3" />
              Unity Bundle
            </Button>
          </Link>
          <Link href="/nexus-mods">
            <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Download className="h-3 w-3" />
              Nexus Mods
            </Button>
          </Link>
        </div>
      </div>
      
      <UnityPatcher />
    </div>
  );
}



