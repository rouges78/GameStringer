'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n';

const SystemMonitor = dynamic(
  () => import('@/components/tools/system-monitor').then(mod => mod.SystemMonitor),
  { ssr: false, loading: () => <div className="p-4 text-center text-slate-500 text-sm">Caricamento...</div> }
);

const OllamaSetupWizard = dynamic(
  () => import('@/components/tools/ollama-setup-wizard').then(mod => mod.OllamaSetupWizard),
  { ssr: false, loading: () => <div className="p-4 text-center text-slate-500 text-sm">Caricamento...</div> }
);

export default function SystemMonitorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-slate-200">System Monitor & AI Setup</h1>
      </div>
      <p className="text-sm text-slate-400 -mt-4">
        Monitora le risorse del sistema (VRAM, RAM) e configura l'AI locale.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-300">Risorse Sistema</h2>
          <SystemMonitor />
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-300">Setup AI Locale</h2>
          <OllamaSetupWizard onComplete={() => window.location.href = '/ai-translator'} />
        </div>
      </div>
    </div>
  );
}
