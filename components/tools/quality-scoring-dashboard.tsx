'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, CheckCircle2, Bot, FileText, TrendingUp,
  Download, Upload, Trash2, Search, Filter, ChevronDown,
  ChevronRight, Eye, Edit3, Check, X, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  qualityScoringService,
  calculateQualityScore,
  getQualityLabel,
  getQualityColor,
  getQualityBgColor,
  getTagInfo,
  type TranslationProject,
  type QualityStats,
  type QualityTag,
  type TranslationEntry
} from '@/lib/quality-scoring';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

// ─── Quality Bar Component ───────────────────────────────────

function QualityBar({ stats }: { stats: QualityStats }) {
  const total = stats.human + stats.validated + stats.ai;
  if (total === 0) return <div className="h-3 rounded-full bg-zinc-800" />;

  const hPct = (stats.human / total) * 100;
  const vPct = (stats.validated / total) * 100;
  const aPct = (stats.ai / total) * 100;

  return (
    <div className="h-3 rounded-full overflow-hidden flex bg-zinc-800">
      {hPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${hPct}%` }} />}
      {vPct > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${vPct}%` }} />}
      {aPct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${aPct}%` }} />}
    </div>
  );
}

// ─── Score Badge ─────────────────────────────────────────────

function ScoreBadge({ stats }: { stats: QualityStats }) {
  const label = stats.label;
  const color = getQualityBgColor(label);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${color}`}>
      {stats.score.toFixed(1)}/3 — {label}
    </span>
  );
}

// ─── Tag Badge ───────────────────────────────────────────────

function TagBadge({ tag }: { tag: QualityTag }) {
  const info = getTagInfo(tag);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold ${info.color}`}>
      {info.icon} {info.label}
    </span>
  );
}

// ─── Stats Cards ─────────────────────────────────────────────

function StatsCards({ stats }: { stats: QualityStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          <div className="text-2xs text-zinc-400">{t('qualityScoringDashboardComp.totale')}</div>
        </CardContent>
      </Card>
      <Card className="bg-emerald-950/30 border-emerald-900/30">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.human.toLocaleString()}</div>
          <div className="text-2xs text-emerald-400/60">✍️ Human</div>
        </CardContent>
      </Card>
      <Card className="bg-blue-950/30 border-blue-900/30">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.validated.toLocaleString()}</div>
          <div className="text-2xs text-blue-400/60">✅ Validated</div>
        </CardContent>
      </Card>
      <Card className="bg-amber-950/30 border-amber-900/30">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{stats.ai.toLocaleString()}</div>
          <div className="text-2xs text-amber-400/60">🤖 AI</div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-zinc-400">{stats.captured.toLocaleString()}</div>
          <div className="text-2xs text-zinc-500">📋 Captured</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Entry Row ───────────────────────────────────────────────

function EntryRow({
  entryKey,
  entry,
  onValidate,
  onEdit,
}: {
  entryKey: string;
  entry: TranslationEntry;
  onValidate: () => void;
  onEdit: (newText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.translatedText);

  const handleSave = () => {
    if (editText !== entry.translatedText) {
      onEdit(editText);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-800/50 group text-xs">
      <TagBadge tag={entry.tag} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-zinc-400 truncate">{entry.sourceText}</div>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSave}>
              <Check className="h-3 w-3 text-emerald-400" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(false)}>
              <X className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        ) : (
          <div className="text-white">
            {entry.translatedText || <span className="text-zinc-600 italic">— not translated —</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.tag === 'A' && (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-2xs" onClick={onValidate}>
            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Validate
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditText(entry.translatedText); setEditing(true); }}>
          <Edit3 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Project Detail ──────────────────────────────────────────

function ProjectDetail({
  project,
  onBack,
  onRefresh,
}: {
  project: TranslationProject;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [filterTag, setFilterTag] = useState<QualityTag | 'all'>('all');
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    return Object.entries(project.entries).filter(([, entry]) => {
      if (filterTag !== 'all' && entry.tag !== filterTag) return false;
      if (search) {
        const q = search.toLowerCase();
        return entry.sourceText.toLowerCase().includes(q) ||
               entry.translatedText.toLowerCase().includes(q);
      }
      return true;
    });
  }, [project.entries, filterTag, search]);

  const handleValidate = (key: string) => {
    const entry = project.entries[key];
    if (entry) {
      const { markAsValidated } = require('@/lib/quality-scoring');
      const updated = markAsValidated(entry);
      qualityScoringService.updateEntries(project.id, { [key]: updated });
      onRefresh();
    }
  };

  const handleEdit = (key: string, newText: string) => {
    const entry = project.entries[key];
    if (entry) {
      const { markAsHuman } = require('@/lib/quality-scoring');
      const updated = markAsHuman(entry, newText);
      qualityScoringService.updateEntries(project.id, { [key]: updated });
      onRefresh();
    }
  };

  const handleBatchValidate = () => {
    const count = qualityScoringService.batchValidate(project.id);
    if (count > 0) onRefresh();
  };

  const handleExport = () => {
    const data = qualityScoringService.exportProject(project.id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}.gstranslation.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack} className="h-7">
            <ChevronRight className="h-4 w-4 rotate-180" /> Indietro
          </Button>
          <h2 className="text-lg font-bold">{project.gameName}</h2>
          <Badge variant="outline" className="text-xs">
            {project.sourceLanguage.toUpperCase()} → {project.targetLanguage.toUpperCase()}
          </Badge>
          <ScoreBadge stats={project.stats} />
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBatchValidate}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Valida Tutti AI
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Esporta
          </Button>
        </div>
      </div>

      <StatsCards stats={project.stats} />
      <QualityBar stats={project.stats} />

      {/* Legend */}
      <div className="flex items-center gap-3 text-2xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Human</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Validated</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> AI</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          <Input
            aria-label="Cerca" placeholder="Cerca stringhe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'H', 'V', 'A', 'C'] as const).map(tag => (
            <Button
              key={tag}
              size="sm"
              variant={filterTag === tag ? 'default' : 'ghost'}
              className="h-7 text-2xs px-2"
              onClick={() => setFilterTag(tag)}
            >
              {tag === 'all' ? 'Tutti' : getTagInfo(tag as QualityTag).icon + ' ' + getTagInfo(tag as QualityTag).label}
            </Button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-2 max-h-[500px] overflow-y-auto space-y-0.5">
          {filteredEntries.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm">{t('qualityScoringDashboardComp.nessunaStringaTrovata')}</div>
          ) : (
            filteredEntries.map(([key, entry]) => (
              <EntryRow
                key={key}
                entryKey={key}
                entry={entry}
                onValidate={() => handleValidate(key)}
                onEdit={(newText) => handleEdit(key, newText)}
              />
            ))
          )}
        </CardContent>
      </Card>
      <div className="text-xs text-zinc-500">
        {filteredEntries.length.toLocaleString()} / {Object.keys(project.entries).length.toLocaleString()} stringhe
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export function QualityScoringDashboard() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<TranslationProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<TranslationProject | null>(null);
  const [importing, setImporting] = useState(false);

  const loadProjects = () => {
    setProjects(qualityScoringService.listProjects());
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const refreshProject = () => {
    if (selectedProject) {
      const updated = qualityScoringService.getProject(selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
        loadProjects();
      }
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.gstranslation.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const project = qualityScoringService.importProject(text);
        if (project) {
          loadProjects();
        }
      } catch (err: unknown) {
        clientLogger.error('Import failed:', err);
      }
      setImporting(false);
    };
    input.click();
  };

  const handleDelete = (projectId: string) => {
    qualityScoringService.deleteProject(projectId);
    loadProjects();
    if (selectedProject?.id === projectId) setSelectedProject(null);
  };

  const globalStats = qualityScoringService.getGlobalStats();

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onRefresh={refreshProject}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-400" />
            <div>
              <div className="text-lg font-bold">{globalStats.projects}</div>
              <div className="text-2xs text-zinc-400">{t('qualityScoringDashboardComp.progetti')}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <div>
              <div className="text-lg font-bold">{globalStats.totalEntries.toLocaleString()}</div>
              <div className="text-2xs text-zinc-400">{t('qualityScoringDashboardComp.stringheTotali')}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-lg font-bold">{globalStats.avgScore}/3</div>
              <div className="text-2xs text-zinc-400">{t('qualityScoringDashboardComp.scoreMedio')}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <Shield className={`h-5 w-5 ${getQualityColor(globalStats.avgLabel)}`} />
            <div>
              <div className="text-lg font-bold">{globalStats.avgLabel}</div>
              <div className="text-2xs text-zinc-400">{t('qualityScoringDashboardComp.qualitàMedia')}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('qualityScoringDashboardComp.progettiDiTraduzione')}</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleImport} disabled={importing}>
          <Upload className="h-3 w-3 mr-1" /> {importing ? 'Importando...' : 'Importa Progetto'}
        </Button>
      </div>

      {/* Project List */}
      {projects.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8 text-center">
            <Shield className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm mb-1">{t('qualityScoringDashboardComp.nessunProgettoDiTraduzione')}</p>
            <p className="text-zinc-600 text-xs">
              I progetti vengono creati automaticamente quando traduci un gioco con GameStringer.
              Puoi anche importare un file .gstranslation.json.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {projects.map(project => (
            <Card
              key={project.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{project.gameName}</h4>
                    <Badge variant="outline" className="text-2xs">
                      {project.sourceLanguage.toUpperCase()} → {project.targetLanguage.toUpperCase()}
                    </Badge>
                    <ScoreBadge stats={project.stats} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-2xs text-zinc-500">
                      {project.stats.translated.toLocaleString()} / {project.stats.total.toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <QualityBar stats={project.stats} />
                <div className="flex items-center gap-3 mt-1.5 text-2xs text-zinc-500">
                  <span>✍️ H:{project.stats.human}</span>
                  <span>✅ V:{project.stats.validated}</span>
                  <span>🤖 A:{project.stats.ai}</span>
                  <span>📋 C:{project.stats.captured}</span>
                  <span className="ml-auto">{project.stats.completionPercent}% completo</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
