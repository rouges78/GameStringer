'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog';
import {
  FileText, FolderOpen, Search, Loader2, CheckCircle2,
  Globe, ChevronDown, ChevronRight, Download, Upload,
  Settings2, StopCircle, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { buildSingleTranslationPrompt, detectGenreFromText, getAllGenres, type GameGenre } from '@/lib/genre-prompts';

interface RPGMakerEntry {
  key: string;
  english: string;
  translated: string;
  done: boolean;
  path: string; // JSON path: e.g. "events[0].pages[0].list[5].parameters[0]"
}

interface RPGMakerFile {
  name: string;
  filePath: string;
  format: 'json' | 'rvdata2';
  entries: RPGMakerEntry[];
  doneCount: number;
  category: 'map' | 'common' | 'system' | 'actors' | 'items' | 'skills' | 'enemies' | 'other';
}

type Status = 'idle' | 'scanning' | 'translating' | 'done' | 'error';

const catColor: Record<string, string> = {
  map: 'bg-green-900/50 text-green-300',
  common: 'bg-blue-900/50 text-blue-300',
  system: 'bg-amber-900/50 text-amber-300',
  actors: 'bg-purple-900/50 text-purple-300',
  items: 'bg-cyan-900/50 text-cyan-300',
  skills: 'bg-red-900/50 text-red-300',
  enemies: 'bg-orange-900/50 text-orange-300',
  other: 'bg-slate-700 text-slate-300',
};

/** Detect RPG Maker file category from filename */
function detectCategory(name: string): RPGMakerFile['category'] {
  const n = name.toLowerCase();
  if (n.startsWith('map')) return 'map';
  if (n.includes('commonevents')) return 'common';
  if (n.includes('system')) return 'system';
  if (n.includes('actor')) return 'actors';
  if (n.includes('item') || n.includes('weapon') || n.includes('armor')) return 'items';
  if (n.includes('skill')) return 'skills';
  if (n.includes('enem') || n.includes('troop')) return 'enemies';
  return 'other';
}

/** Extract translatable strings from RPG Maker JSON data */
function extractRPGMakerStrings(data: any, filename: string, path = ''): RPGMakerEntry[] {
  const entries: RPGMakerEntry[] = [];
  
  if (!data) return entries;
  
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      entries.push(...extractRPGMakerStrings(data[i], filename, `${path}[${i}]`));
    }
  } else if (typeof data === 'object') {
    // Known translatable string fields in RPG Maker
    const textFields = ['name', 'description', 'message1', 'message2', 'message3', 'message4', 'nickname', 'profile', 'note'];
    
    for (const field of textFields) {
      if (typeof data[field] === 'string' && data[field].trim().length > 0) {
        // Skip if it looks like a code/formula
        const val = data[field].trim();
        if (val.length < 2 || /^[<\[{].*[>\]}]$/.test(val) || /^\d+$/.test(val)) continue;
        entries.push({
          key: `${path}.${field}`,
          english: val,
          translated: '',
          done: false,
          path: `${path}.${field}`,
        });
      }
    }
    
    // Event commands: code 401 = Show Text, code 102 = Show Choices, code 320 = Change Name
    if (data.code === 401 || data.code === 405) {
      const params = data.parameters;
      if (Array.isArray(params) && typeof params[0] === 'string' && params[0].trim()) {
        entries.push({
          key: `${path}.parameters[0]`,
          english: params[0],
          translated: '',
          done: false,
          path: `${path}.parameters[0]`,
        });
      }
    }
    
    // Show Choices
    if (data.code === 102 && Array.isArray(data.parameters?.[0])) {
      for (let ci = 0; ci < data.parameters[0].length; ci++) {
        const choice = data.parameters[0][ci];
        if (typeof choice === 'string' && choice.trim()) {
          entries.push({
            key: `${path}.parameters[0][${ci}]`,
            english: choice,
            translated: '',
            done: false,
            path: `${path}.parameters[0][${ci}]`,
          });
        }
      }
    }
    
    // Recurse into known container fields
    const containerFields = ['events', 'pages', 'list', 'parameters'];
    for (const field of containerFields) {
      if (data[field] && typeof data[field] === 'object') {
        entries.push(...extractRPGMakerStrings(data[field], filename, `${path}.${field}`));
      }
    }
  }
  
  return entries;
}

export default function RPGMakerTranslatorPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [rpgVersion, setRpgVersion] = useState('');
  const [files, setFiles] = useState<RPGMakerFile[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prog, setProg] = useState({ cur: 0, tot: 0, file: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [targetLang, setTargetLang] = useState('it');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [showCfg, setShowCfg] = useState(false);
  const [genre, setGenre] = useState<GameGenre>('jrpg');
  const abort = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const log = useCallback((m: string) => {
    setLogs(p => [...p.slice(-300), `[${new Date().toLocaleTimeString()}] ${m}`]);
  }, []);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

  useEffect(() => {
    fetch('http://localhost:11434/api/tags').then(r => r.json()).then((d: { models?: { name: string }[] }) => {
      const m = (d.models || []).map((x: { name: string }) => x.name);
      setModels(m);
      if (m.length && !model) setModel(m[0]);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const browse = useCallback(async () => {
    const sel = await dialogOpen({ directory: true, title: 'Seleziona cartella progetto RPG Maker (www/data o data)' });
    if (sel && typeof sel === 'string') {
      setProjectPath(sel);
      setProjectName(sel.replace(/\\/g, '/').split('/').pop() || 'RPG Maker');
      log(`📁 Cartella: ${sel}`);
    }
  }, [log]);

  const doScan = useCallback(async () => {
    if (!projectPath) return;
    setStatus('scanning');
    setFiles([]);
    log('🔍 Scansione file RPG Maker...');
    try {
      // Look for data/ or www/data/ directory
      const result = await invoke('scan_directory_files', {
        directory: projectPath,
        extensions: ['json'],
        recursive: true,
      }) as { files: { path: string; name: string; content: string }[] };

      const rpgFiles: RPGMakerFile[] = [];
      let version = 'MV/MZ';

      for (const f of result.files || []) {
        // Skip non-RPG Maker files
        const n = f.name.toLowerCase();
        if (!n.endsWith('.json')) continue;
        if (n === 'package.json' || n === 'tsconfig.json') continue;
        
        try {
          const data = JSON.parse(f.content);
          
          // Detect version from System.json
          if (n === 'system.json' && data.versionId) {
            version = data.hasEncryptedAudio !== undefined ? 'MZ' : 'MV';
          }
          
          const entries = extractRPGMakerStrings(data, f.name);
          if (entries.length > 0) {
            rpgFiles.push({
              name: f.name,
              filePath: f.path,
              format: 'json',
              entries,
              doneCount: 0,
              category: detectCategory(f.name),
            });
          }
        } catch {
          // Skip non-parseable files
        }
      }

      // Sort: system first, then maps, then others
      rpgFiles.sort((a, b) => {
        const order: Record<string, number> = { system: 0, actors: 1, items: 2, skills: 3, enemies: 4, common: 5, map: 6, other: 7 };
        return (order[a.category] || 7) - (order[b.category] || 7);
      });

      setRpgVersion(version);
      setFiles(rpgFiles);
      const total = rpgFiles.reduce((s, f) => s + f.entries.length, 0);
      log(`✅ RPG Maker ${version}: ${rpgFiles.length} file, ${total} stringhe`);

      // Auto-detect genre (default JRPG for RPG Maker)
      const sampleTexts = rpgFiles.flatMap(f => f.entries.map(e => e.english)).slice(0, 300);
      const detected = detectGenreFromText(sampleTexts, projectName);
      setGenre(detected !== 'generic' ? detected : 'jrpg');
      const info = getAllGenres().find(g => g.value === (detected !== 'generic' ? detected : 'jrpg'));
      log(`🎭 Genere: ${info?.icon || ''} ${info?.label || 'JRPG'}`);

      setStatus('idle');
    } catch (e) {
      log(`❌ ${e}`);
      setStatus('error');
    }
  }, [projectPath, projectName, log]);

  const doTranslate = useCallback(async () => {
    if (files.length === 0 || !model) return;
    setStatus('translating');
    abort.current = false;
    const tot = files.reduce((s, f) => s + f.entries.filter(e => !e.done && e.english).length, 0);
    let done = 0;
    const genreInfo = getAllGenres().find(g => g.value === genre);
    log(`🔄 Traduzione ${tot} stringhe — ${genreInfo?.icon || '🎮'} ${genreInfo?.label || 'JRPG'}`);

    for (const file of files) {
      if (abort.current) break;
      for (const entry of file.entries) {
        if (abort.current) break;
        if (entry.done || !entry.english) continue;
        setProg({ cur: done, tot, file: file.name });
        try {
          const resp = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt: buildSingleTranslationPrompt(entry.english, 'en', targetLang, genre),
              stream: false,
              options: { temperature: 0.35, num_predict: 1024 },
            }),
          });
          if (resp.ok) {
            let r = ((await resp.json()).response || '').trim();
            r = r.replace(/^(Italian:|Traduzione:|Translation:|German:|French:|Spanish:)\s*/i, '');
            if (r.startsWith('"') && r.endsWith('"')) r = r.slice(1, -1);
            entry.translated = r;
            entry.done = true;
            file.doneCount++;
            done++;
          }
        } catch (err) {
          log(`⚠️ ${entry.key}: ${err}`);
        }
      }
      log(`✅ ${file.name}: ${file.doneCount}/${file.entries.length}`);
      setFiles([...files]);
    }
    setFiles([...files]);
    setStatus(abort.current ? 'idle' : 'done');
    log(abort.current ? '⏹ Interrotto' : `🎉 Completato: ${done} stringhe`);
  }, [files, model, targetLang, genre, log]);

  const doExport = useCallback(async () => {
    const path = await dialogSave({ title: 'Esporta traduzioni', filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: `${projectName}_translations.json` });
    if (!path) return;
    const data = files.flatMap(f => f.entries.filter(e => e.done).map(e => ({
      file: f.name, category: f.category, key: e.key, english: e.english, translated: e.translated,
    })));
    await invoke('write_text_file', { path, content: JSON.stringify(data, null, 2) });
    log(`📁 Esportate ${data.length} traduzioni → ${path}`);
  }, [files, projectName, log]);

  const totalStrings = files.reduce((s, f) => s + f.entries.length, 0);
  const totalDone = files.reduce((s, f) => s + f.doneCount, 0);
  const pct = prog.tot > 0 ? Math.round((prog.cur / prog.tot) * 100) : 0;

  // Category summary
  const catSummary = files.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + f.entries.length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg border border-white/10">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">RPG Maker Translator</h1>
              <p className="text-white/70 text-[10px]">Traduci giochi RPG Maker MV / MZ (.json)</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {rpgVersion && <div className="px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[10px] text-white/70">{rpgVersion}</div>}
            {[{ v: files.length, l: 'File' }, { v: totalStrings, l: 'Stringhe' }, { v: totalDone, l: 'Tradotte' }].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10">
                <span className="text-sm font-bold text-white">{s.v}</span>
                <span className="text-[10px] text-white/70">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-[10px] text-white/50 mr-2 self-center">Altri engine</span>
          {[{ h: '/unity-csv-translator', l: 'Unity' }, { h: '/unreal-translator', l: 'Unreal' }, { h: '/godot-translator', l: 'Godot' }].map(x => (
            <Link key={x.h} href={x.h}><Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">{x.l}</Button></Link>
          ))}
        </div>
      </div>

      {/* Step 1: Select */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">1</div>
          <h2 className="text-base font-bold text-white">Seleziona progetto RPG Maker</h2>
        </div>
        <div className="flex gap-2 items-center">
          <Button onClick={browse} variant="outline" className="gap-2"><FolderOpen className="h-4 w-4" />Sfoglia</Button>
          <div className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-300 truncate">{projectPath || 'Seleziona la cartella data/ del gioco'}</div>
          <Button onClick={doScan} disabled={!projectPath || status === 'scanning'} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
            {status === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Scansiona
          </Button>
        </div>
      </div>

      {/* Category Summary */}
      {files.length > 0 && Object.keys(catSummary).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(catSummary).map(([cat, count]) => (
            <span key={cat} className={`text-[10px] px-2 py-1 rounded ${catColor[cat] || catColor.other}`}>
              {cat}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Step 2: Files */}
      {files.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">2</div>
            <h2 className="text-base font-bold text-white">File del gioco ({files.length})</h2>
            <div className="flex-1" />
            <Button onClick={doExport} variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={totalDone === 0}><Download className="h-3 w-3" />Esporta</Button>
          </div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {files.map((f, fi) => {
              const isExp = expanded === f.name;
              return (
                <div key={fi} className="rounded-lg border border-slate-700/60 bg-slate-800/40">
                  <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 text-left" onClick={() => setExpanded(isExp ? null : f.name)}>
                    {isExp ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    <FileText className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-sm font-semibold text-white flex-1">{f.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${catColor[f.category] || catColor.other}`}>{f.category}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{f.entries.length} str</span>
                    {f.doneCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">{f.doneCount} ✓</span>}
                  </button>
                  {isExp && (
                    <div className="px-3 pb-3 max-h-[300px] overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead><tr className="text-slate-500 border-b border-slate-700/50">
                          <th className="text-left py-1 w-40">Key</th>
                          <th className="text-left py-1">English</th>
                          <th className="text-left py-1">Traduzione</th>
                        </tr></thead>
                        <tbody>{f.entries.slice(0, 80).map((e, ei) => (
                          <tr key={ei} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                            <td className="py-1 text-slate-500 font-mono text-[9px] truncate max-w-[150px]">{e.key}</td>
                            <td className="py-1 text-slate-300 max-w-[250px] truncate">{e.english}</td>
                            <td className="py-1 text-emerald-300 max-w-[250px] truncate">{e.translated || <span className="text-slate-600">—</span>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {f.entries.length > 80 && <p className="text-[10px] text-slate-500 mt-2 text-center">80/{f.entries.length}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Translate */}
      {files.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-white text-sm font-bold">3</div>
            <h2 className="text-base font-bold text-white">Traduci con AI</h2>
            <div className="flex-1" />
            <Button onClick={() => setShowCfg(!showCfg)} variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-400"><Settings2 className="h-3 w-3" />Config</Button>
          </div>
          {showCfg && (
            <div className="mb-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex gap-4 items-center flex-wrap">
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-400">Modello</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-400">Lingua</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
                  {['it','de','es','fr','pt','zh','ja','ko','ru'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-400">Genere</label>
                <select value={genre} onChange={e => setGenre(e.target.value as GameGenre)} className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
                  {getAllGenres().map(g => <option key={g.value} value={g.value}>{g.icon} {g.label}</option>)}
                </select>
              </div>
              <span className="text-[10px] text-slate-500">Ollama: {models.length ? `${models.length} modelli` : '⚠️ non connesso'}</span>
            </div>
          )}
          {status === 'translating' && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                <span className="text-xs text-slate-300">{prog.file}: {prog.cur}/{prog.tot} ({pct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {status !== 'translating' ? (
              <Button onClick={doTranslate} disabled={!models.length} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
                <Globe className="h-4 w-4" />Traduci ({totalStrings - totalDone})
              </Button>
            ) : (
              <Button onClick={() => { abort.current = true; }} variant="destructive" className="gap-2">
                <StopCircle className="h-4 w-4" />Stop
              </Button>
            )}
            {status === 'done' && <span className="flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" />Completato!</span>}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <button onClick={() => setShowLogs(!showLogs)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-800/40 text-left">
          {showLogs ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          <span className="text-xs font-medium text-slate-400">Log ({logs.length})</span>
        </button>
        {showLogs && (
          <div ref={logRef} className="px-4 pb-3 max-h-[200px] overflow-y-auto font-mono text-[10px] text-slate-500 space-y-0.5">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
