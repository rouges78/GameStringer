'use client';

import { LoreAssistantChat } from '@/components/tools/lore-assistant';
import { AutoHookScanner } from '@/components/tools/auto-hook-scanner';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export default function AdvancedToolsPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-6 w-6 text-violet-400" />
        <h1 className="text-2xl font-bold text-slate-200">Advanced Tools</h1>
        <Badge className="bg-violet-500/20 text-violet-300 text-[10px]">Next-Gen</Badge>
      </div>
      <p className="text-sm text-slate-400 -mt-4">
        Strumenti avanzati che rendono GameStringer unico: Lore Assistant, Auto-Hook Scanner, Vision LLM.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LoreAssistantChat defaultExpanded={true} />
        </div>
        <div className="space-y-4">
          <AutoHookScanner />
        </div>
      </div>
    </div>
  );
}
