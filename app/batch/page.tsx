"use client";

import { 
  FolderOpen, 
  Sparkles, 
  Languages, 
  Zap,
  FileText,
  FolderTree
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BatchFolderTranslator } from "@/components/translator/batch-folder-translator";
import { useTranslation } from "@/lib/i18n";

export default function BatchPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Header - Blu Compatto */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Batch Translator</h1>
              <p className="text-white/80 text-xs">Traduci intere cartelle con un click</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1.5 backdrop-blur-sm">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">JSON • PO • CSV • +</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1.5 backdrop-blur-sm">
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Preservata</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1.5 backdrop-blur-sm">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Parallelo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <FolderTree className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Ricorsivo</p>
            <p className="text-xs text-muted-foreground">Scansiona sottocartelle</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-teal-500/10 rounded-lg">
            <FileText className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Multi-formato</p>
            <p className="text-xs text-muted-foreground">10+ formati supportati</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-cyan-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Selezione smart</p>
            <p className="text-xs text-muted-foreground">Filtra per tipo</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Languages className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Output flessibile</p>
            <p className="text-xs text-muted-foreground">Cartella custom o in-place</p>
          </div>
        </div>
      </div>

      {/* Main Component */}
      <BatchFolderTranslator />
    </div>
  );
}
