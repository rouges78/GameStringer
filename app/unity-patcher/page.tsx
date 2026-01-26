'use client';

import Link from 'next/link';
import { Cpu, Gamepad2, Package, Download, Wand2, Zap, Shield, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnityPatcher } from '@/components/tools/unity-patcher';
import { useTranslation } from '@/lib/i18n';

export default function UnityPatcherPage() {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('gamePatcher.title')}</h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('gamePatcher.subtitle')}</p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Layers className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">5</span>
              <span className="text-[10px] text-white/70">{t('gamePatcher.engines')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Zap className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{t('gamePatcher.autoInstall')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Shield className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{t('gamePatcher.safeBackup')}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-[10px] text-white/50 mr-2 self-center">{t('gamePatcher.otherPatchers')}</span>
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



