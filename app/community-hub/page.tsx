'use client';

import Link from 'next/link';
import { Download, Database, HelpCircle, Globe, Users, Star, Package, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommunityHub } from '@/components/tools/community-hub';
import { useTranslation } from '@/lib/i18n';

export default function CommunityHubPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Hero Header - Compact */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                Community Hub
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                Share and download translations • 100+ packs • 500+ translators
              </p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Package className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">100+</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Star className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">4.5★</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-[10px] text-white/50 mr-2 self-center">Resources:</span>
          <Link href="/nexus-mods">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Download className="h-3 w-3" />
              Nexus
            </Button>
          </Link>
          <Link href="/memory">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Database className="h-3 w-3" />
              Dictionary
            </Button>
          </Link>
          <Link href="/workshop">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Cloud className="h-3 w-3" />
              Workshop
            </Button>
          </Link>
        </div>
      </div>
      
      <CommunityHub />
    </div>
  );
}



