'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { invoke } from '@/lib/tauri-api';
import { 
  FolderOpen, 
  Search, 
  Cpu, 
  Wand2, 
  FileText, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Download,
  Gamepad2
} from 'lucide-react';

interface InjectionTool {
  name: string;
  url: string;
  description: string;
  auto_install: boolean;
}

interface TranslatableFile {
  path: string;
  file_type: string;
  description: string;
}

interface EngineDetectionResult {
  engine: string;
  engine_name: string;
  version: string | null;
  can_inject: boolean;
  injection_method: string;
  tools_required: InjectionTool[];
  translatable_files: TranslatableFile[];
  notes: string[];
}

interface InjectionResult {
  success: boolean;
  message: string;
  steps_completed: string[];
  files_modified: string[];
  backup_path: string | null;
}

const ENGINE_COLORS: Record<string, string> = {
  'Unity': 'bg-gradient-to-r from-gray-600 to-gray-800',
  'UnrealEngine': 'bg-gradient-to-r from-blue-600 to-indigo-800',
  'Godot': 'bg-gradient-to-r from-blue-500 to-cyan-600',
  'RPGMakerMV': 'bg-gradient-to-r from-orange-500 to-red-600',
  'RPGMakerMZ': 'bg-gradient-to-r from-orange-500 to-red-600',
  'RPGMakerVXAce': 'bg-gradient-to-r from-orange-600 to-amber-600',
  'RPGMakerXP': 'bg-gradient-to-r from-yellow-500 to-orange-500',
  'GameMaker': 'bg-gradient-to-r from-green-500 to-emerald-600',
  'RenPy': 'bg-gradient-to-r from-pink-500 to-rose-600',
  'Kirikiri': 'bg-gradient-to-r from-purple-500 to-violet-600',
  'NScripter': 'bg-gradient-to-r from-slate-500 to-slate-700',
  'Wolf': 'bg-gradient-to-r from-amber-600 to-yellow-600',
  'Unknown': 'bg-gradient-to-r from-gray-500 to-gray-600',
};

const ENGINE_ICONS: Record<string, string> = {
  'Unity': '🎮',
  'UnrealEngine': '🎯',
  'Godot': '🤖',
  'RPGMakerMV': '⚔️',
  'RPGMakerMZ': '⚔️',
  'RPGMakerVXAce': '🗡️',
  'RPGMakerXP': '🗡️',
  'GameMaker': '🕹️',
  'RenPy': '💕',
  'Kirikiri': '📖',
  'NScripter': '📜',
  'Wolf': '🐺',
  'Unknown': '❓',
};

export function UniversalInjector() {
  const [gamePath, setGamePath] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<EngineDetectionResult | null>(null);
  const [injectionResult, setInjectionResult] = useState<InjectionResult | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    try {
      const selected = await invoke<string | null>('select_folder', {
        title: 'Select game folder'
      });
      if (selected) {
        setGamePath(selected);
        setDetectionResult(null);
        setInjectionResult(null);
        setError(null);
      }
    } catch (e) {
      console.error('Folder selection error:', e);
    }
  };

  const handleDetect = async () => {
    if (!gamePath) return;
    
    setIsDetecting(true);
    setError(null);
    setDetectionResult(null);
    setInjectionResult(null);

    try {
      const result = await invoke<EngineDetectionResult>('detect_game_engine', {
        gamePath
      });
      setDetectionResult(result);
    } catch (e) {
      setError(`Detection error: ${e}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleInject = async () => {
    if (!detectionResult || !gamePath) return;
    
    setIsInjecting(true);
    setError(null);

    try {
      const result = await invoke<InjectionResult>('inject_translation_hook', {
        gamePath,
        engine: detectionResult.engine,
        createBackup
      });
      setInjectionResult(result);
    } catch (e) {
      setError(`Injection error: ${e}`);
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">Universal Mod Injector</h2>
            <p className="text-white/80 text-[10px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Detect engine and inject translation hooks automatically</p>
          </div>
        </div>
      </div>

      {/* Game Path Selection */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              value={gamePath}
              onChange={(e) => setGamePath(e.target.value)}
              placeholder="Game folder path..."
              className="flex-1 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleBrowse}>
              <FolderOpen className="h-4 w-4 mr-1" />
              Browse
            </Button>
            <Button 
              onClick={handleDetect}
              disabled={!gamePath || isDetecting}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-600"
            >
              {isDetecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Detect
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="py-3 flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Detection Result */}
      {detectionResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Engine Info */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Detected Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-3 rounded-lg ${ENGINE_COLORS[detectionResult.engine] || ENGINE_COLORS['Unknown']}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ENGINE_ICONS[detectionResult.engine] || '❓'}</span>
                  <div>
                    <p className="font-bold text-white">{detectionResult.engine_name}</p>
                    {detectionResult.version && (
                      <p className="text-xs text-white/80">Version: {detectionResult.version}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Can be patched:</span>
                  {detectionResult.can_inject ? (
                    <Badge className="bg-green-500">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">Manual</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="text-xs">{detectionResult.injection_method}</span>
                </div>
              </div>

              {/* Notes */}
              {detectionResult.notes.length > 0 && (
                <div className="space-y-1">
                  {detectionResult.notes.map((note, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {note}</p>
                  ))}
                </div>
              )}

              {/* Inject Button */}
              {detectionResult.can_inject && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="backup"
                      checked={createBackup}
                      onCheckedChange={(c) => setCreateBackup(c as boolean)}
                    />
                    <label htmlFor="backup" className="text-xs text-muted-foreground">
                      Create backup before injection
                    </label>
                  </div>
                  <Button
                    onClick={handleInject}
                    disabled={isInjecting}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600"
                    size="sm"
                  >
                    {isInjecting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Injection...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Inject Translation Hook</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tools & Files */}
          <div className="space-y-4">
            {/* Tools Required */}
            {detectionResult.tools_required.length > 0 && (
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-xs text-muted-foreground">Tool Richiesti</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {detectionResult.tools_required.map((tool, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div>
                          <p className="text-sm font-medium">{tool.name}</p>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {tool.auto_install ? (
                            <Badge className="bg-green-500 text-[10px]">Auto</Badge>
                          ) : (
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Translatable Files */}
            {detectionResult.translatable_files.length > 0 && (
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-xs text-muted-foreground">File Traducibili</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {detectionResult.translatable_files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1 truncate font-mono">{file.path}</span>
                          <Badge variant="outline" className="text-[10px]">{file.file_type}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Injection Result */}
      {injectionResult && (
        <Card className={injectionResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {injectionResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${injectionResult.success ? 'text-green-500' : 'text-red-500'}`}>
                  {injectionResult.message}
                </p>
                
                {injectionResult.steps_completed.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {injectionResult.steps_completed.map((step, i) => (
                      <p key={i} className="text-xs text-muted-foreground">✓ {step}</p>
                    ))}
                  </div>
                )}

                {injectionResult.backup_path && (
                  <p className="text-xs text-muted-foreground mt-2">
                    📁 Backup: {injectionResult.backup_path}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supported Engines */}
      <Card className="bg-muted/30">
        <CardHeader className="py-2">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
            <Gamepad2 className="h-3 w-3" />
            Engine Supportati
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1">
            {Object.entries(ENGINE_ICONS).filter(([k]) => k !== 'Unknown').map(([engine, icon]) => (
              <Badge key={engine} variant="outline" className="text-[10px]">
                {icon} {engine.replace(/([A-Z])/g, ' $1').trim()}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
