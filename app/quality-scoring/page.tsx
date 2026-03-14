'use client';

import { Shield } from 'lucide-react';
import { QualityScoringDashboard } from '@/components/tools/quality-scoring-dashboard';

export default function QualityScoringPage() {
  return (
    <div className="container mx-auto p-4 space-y-3">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 p-3 text-white">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-2.5">
          <div className="p-2 bg-black/30 rounded-lg border border-white/10">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Quality Scoring H/V/A</h1>
            <p className="text-white/60 text-[10px]">
              Traccia l&apos;origine e la qualit&agrave; di ogni traduzione: Human, Validated, AI
            </p>
          </div>
        </div>
      </div>

      <QualityScoringDashboard />
    </div>
  );
}
