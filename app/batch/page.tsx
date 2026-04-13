"use client";

import {
  Sparkles,
  Languages,
  Zap,
  FileText,
  FolderTree,
  Edit3,
  BookOpen
} from "lucide-react";
import { BatchFolderTranslator } from "@/components/translator/batch-folder-translator";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

export default function BatchPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      {/* Hero Header - Blu Compatto */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-4 shadow-xl shadow-blue-900/50 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t('batchTranslator.title')}</h1>
              <p className="text-white/80 text-xs">{t('batchTranslator.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('batchTranslator.formats')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('batchTranslator.parallel')}</span>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <Link href="/editor">
              <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 border border-white/10 transition-all cursor-pointer">
                <Edit3 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t('batchPage.editor')}</span>
              </div>
            </Link>
            <Link href="/glossary">
              <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 border border-white/10 transition-all cursor-pointer">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t('batchPage.glossario')}</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/30 border border-slate-700/50">
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30 feature-card">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <FolderTree className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('batchTranslator.recursive')}</p>
            <p className="text-xs text-muted-foreground">{t('batchTranslator.scanSubfolders')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30 feature-card">
          <div className="p-2 bg-teal-500/10 rounded-lg">
            <FileText className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('batchTranslator.multiFormat')}</p>
            <p className="text-xs text-muted-foreground">{t('batchTranslator.formatsSupported')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30 feature-card">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-cyan-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('batchTranslator.smartSelection')}</p>
            <p className="text-xs text-muted-foreground">{t('batchTranslator.filterByType')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30 feature-card">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Languages className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('batchTranslator.flexibleOutput')}</p>
            <p className="text-xs text-muted-foreground">{t('batchTranslator.customFolder')}</p>
          </div>
        </div>
      </div>

      {/* Main Component */}
      <BatchFolderTranslator />
    </div>
  );
}
