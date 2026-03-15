'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog';
import {
  FileText, FolderOpen, Search, Loader2, CheckCircle2,
  Database, Globe, ChevronDown, ChevronRight, Download, Upload,
  Settings2, StopCircle, Wand2, Package, Cpu, Zap, RotateCcw, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

interface CsvEntry { id: string; english: string; translated: string; category: string; done: boolean; }
interface CsvTable { name: string; offset: number; source: string; header: string[]; entries: CsvEntry[]; doneCount: number; }
interface ScanRes { gamePath: string; gameName: string; unityVer: string; tables: CsvTable[]; total: number; done: number; }
type Status = 'idle' | 'scanning' | 'translating' | 'done' | 'error';

interface InjectResult {
  success: boolean;
  ink_replaced: number;
  ink_files: number;
  level_replaced: number;
  level_files: number;
  errors: string[];
  output: string;
}

const catColor: Record<string, string> = {
  ui: 'bg-blue-900/50 text-blue-300', dialogue: 'bg-purple-900/50 text-purple-300',
  phrase: 'bg-amber-900/50 text-amber-300', name: 'bg-emerald-900/50 text-emerald-300',
  other: 'bg-slate-700 text-slate-300', empty: 'bg-slate-800 text-slate-500',
};

function cat(s: string): string {
  if (!s) return 'empty';
  const l = s.toLowerCase();
  const ui = ['start','quit','options','settings','play','continue','new game','load','save','exit','credits','volume'];
  if (ui.some(k => l === k || l.includes(k))) return 'ui';
  if (s.length > 40 && s.includes(' ') && /[.!?]/.test(s)) return 'dialogue';
  if (s.includes(' ') && s.length > 10) return 'phrase';
  if (s.length < 40 && s[0]?.toUpperCase() === s[0]) return 'name';
  return 'other';
}

export default function UnityCsvTranslatorPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [gamePath, setGamePath] = useState('');
  const [gameName, setGameName] = useState('');
  const [scan, setScan] = useState<ScanRes | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prog, setProg] = useState({ cur: 0, tot: 0, tbl: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [targetLang, setTargetLang] = useState('it');
  const [model, setModel] = useState('huihui_ai/hy-mt1.5-abliterated:7b');
  const [models, setModels] = useState<string[]>([]);
  const [showCfg, setShowCfg] = useState(false);
  const abort = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [injecting, setInjecting] = useState(false);
  const [injectResult, setInjectResult] = useState<InjectResult | null>(null);
  const [inkCsvPath, setInkCsvPath] = useState('');
  const [csvExportDir, setCsvExportDir] = useState('');
  // Ink state
  const [inkStrings, setInkStrings] = useState<{ text: string; source_file: string; translated: string; done: boolean }[]>([]);
  const [inkScanned, setInkScanned] = useState(false);
  const [inkFilesCount, setInkFilesCount] = useState(0);
  const [showInk, setShowInk] = useState(false);

  const log = useCallback((m: string) => {
    setLogs(p => [...p.slice(-300), `[${new Date().toLocaleTimeString()}] ${m}`]);
  }, []);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

  // Auto-load game path from sessionStorage or URL params
  const autoStartDone = useRef(false);
  const pendingScan = useRef(false);
  useEffect(() => {
    if (autoStartDone.current) return;
    let path = '';
    let name = '';

    // 1. unityCsvGamePath (set by auto-translate redirect)
    const csvPath = sessionStorage.getItem('unityCsvGamePath');
    if (csvPath) {
      path = csvPath;
      sessionStorage.removeItem('unityCsvGamePath');
    }

    // 2. wizardAutoGame (set by library/wizard)
    if (!path) {
      const wizardJson = sessionStorage.getItem('wizardAutoGame');
      if (wizardJson) {
        try {
          const w = JSON.parse(wizardJson);
          if (w.install_path) {
            path = w.install_path;
            name = w.title || '';
          }
        } catch {}
      }
    }

    // 3. URL search params (?gamePath=...)
    if (!path) {
      const params = new URLSearchParams(window.location.search);
      path = params.get('gamePath') || params.get('installPath') || '';
      name = params.get('gameName') || params.get('name') || '';
    }

    if (path) {
      autoStartDone.current = true;
      pendingScan.current = true;
      setGamePath(path);
      setGameName(name || path.replace(/\\/g, '/').split('/').pop() || 'Unknown');
      log(`📁 Auto-caricato: ${path}`);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    fetch('http://localhost:11434/api/tags').then(r => r.json()).then((d: { models?: { name: string }[] }) => {
      const m = (d.models || []).map((x: { name: string }) => x.name);
      setModels(m);
      if (m.length && !m.includes(model)) setModel(m[0]);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const browse = useCallback(async () => {
    const sel = await dialogOpen({ directory: true, title: 'Seleziona cartella gioco Unity' });
    if (sel && typeof sel === 'string') {
      setGamePath(sel);
      setGameName(sel.replace(/\\/g, '/').split('/').pop() || 'Unknown');
      log(`Cartella: ${sel}`);
    }
  }, [log]);

  const doScan = useCallback(async () => {
    if (!gamePath) return;
    setStatus('scanning'); setScan(null);
    log(`🔍 Scansione: ${gamePath}`);
    try {
      const r = await invoke('scan_unity_csv_tables', { gamePath }) as { tables?: { name: string; offset: number; source: string; header?: string[]; entries?: { id: string; english: string }[] }[]; unity_version?: string; error?: string };
      if (r.error) { log(`❌ ${r.error}`); setStatus('error'); return; }
      const tables: CsvTable[] = (r.tables || []).map((t: { name: string; offset: number; source: string; header?: string[]; entries?: { id: string; english: string }[] }) => ({
        name: t.name, offset: t.offset, source: t.source, header: t.header || [],
        entries: (t.entries || []).map((e: { id: string; english: string }) => ({ id: e.id, english: e.english, translated: '', category: cat(e.english), done: false })),
        doneCount: 0,
      }));
      const total = tables.reduce((s, t) => s + t.entries.filter(e => e.english).length, 0);
      setScan({ gamePath, gameName, unityVer: r.unity_version || '?', tables, total, done: 0 });
      log(`✅ ${tables.length} tabelle, ${total} stringhe CSV`);

      // Also scan for Ink strings
      try {
        const dataDir = gamePath.replace(/\\/g, '/').includes('_Data') ? gamePath : `${gamePath}/${gameName}_Data`;
        log('🔍 Scansione Ink blobs...');
        const ink = await invoke('scan_unity_ink_strings', { gameDir: dataDir }) as { strings: { text: string; source_file: string }[]; total: number; files_with_ink: number };
        if (ink.total > 0) {
          setInkStrings(ink.strings.map(s => ({ ...s, translated: '', done: false })));
          setInkFilesCount(ink.files_with_ink);
          setInkScanned(true);
          log(`✅ ${ink.total} stringhe Ink in ${ink.files_with_ink} file`);
        } else {
          setInkScanned(true);
          log('ℹ️ Nessun blob Ink trovato');
        }
      } catch (e) { log(`⚠️ Scan Ink: ${e}`); setInkScanned(true); }

      setStatus('idle');
    } catch (e) { log(`❌ ${e}`); setStatus('error'); }
  }, [gamePath, gameName, log]);

  // Auto-scan after doScan is ready (triggered by sessionStorage auto-load)
  useEffect(() => {
    if (pendingScan.current && gamePath && status === 'idle') {
      pendingScan.current = false;
      doScan();
    }
  }, [gamePath, doScan, status]);

  const doTranslate = useCallback(async () => {
    if (!scan) return;
    setStatus('translating'); abort.current = false;
    const tot = scan.tables.reduce((s, t) => s + t.entries.filter(e => e.english && !e.done).length, 0);
    let done = 0;
    log(`🔄 Traduzione ${tot} stringhe con ${model}...`);
    const langMap: Record<string, string> = { it:'Italian', de:'German', es:'Spanish', fr:'French', pt:'Portuguese', zh:'Chinese', ja:'Japanese', ko:'Korean', ru:'Russian' };
    const ln = langMap[targetLang] || targetLang;

    for (const t of scan.tables) {
      if (abort.current) break;
      for (const e of t.entries) {
        if (abort.current) break;
        if (!e.english || e.done || e.english === '...') continue;
        setProg({ cur: done, tot, tbl: t.name });
        try {
          const resp = await fetch('http://localhost:11434/api/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: `Translate this RPG game text from English to ${ln}. Keep proper nouns. Maintain tone.\n\nEnglish: ${e.english}\n\n${ln}:`, stream: false, options: { temperature: 0.3, num_predict: 1024 } }),
          });
          if (resp.ok) {
            let r = ((await resp.json()).response || '').trim();
            r = r.replace(/^(Italian:|Traduzione:|Translation:|German:|French:|Spanish:)\s*/i, '');
            if (r.startsWith('"') && r.endsWith('"')) r = r.slice(1, -1);
            e.translated = r; e.done = true; t.doneCount++; done++;
          }
        } catch (err) { log(`⚠️ ${e.id}: ${err}`); }
      }
      log(`✅ ${t.name}: ${t.doneCount}/${t.entries.length}`);
      setScan(p => p ? { ...p, done } : null);
    }
    setScan(p => p ? { ...p, done } : null);
    
    // Phase 2: Translate Ink strings
    const inkTodo = inkStrings.filter(s => !s.done && s.text.length >= 3);
    if (inkTodo.length > 0 && !abort.current) {
      log(`🔄 Traduzione ${inkTodo.length} stringhe Ink...`);
      let inkDone = 0;
      for (const s of inkTodo) {
        if (abort.current) break;
        setProg({ cur: inkDone, tot: inkTodo.length, tbl: 'Ink' });
        try {
          const resp = await fetch('http://localhost:11434/api/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: `Translate this game dialogue from English to ${ln}. Keep proper nouns and tone.\n\nEnglish: ${s.text}\n\n${ln}:`, stream: false, options: { temperature: 0.3, num_predict: 1024 } }),
          });
          if (resp.ok) {
            let r = ((await resp.json()).response || '').trim();
            r = r.replace(/^(Italian:|Traduzione:|Translation:|German:|French:|Spanish:)\s*/i, '');
            if (r.startsWith('"') && r.endsWith('"')) r = r.slice(1, -1);
            s.translated = r; s.done = true; inkDone++;
          }
        } catch (err) { log(`⚠️ Ink: ${err}`); }
        if (inkDone % 100 === 0 && inkDone > 0) {
          log(`  Ink: ${inkDone}/${inkTodo.length}`);
          setInkStrings([...inkStrings]);
        }
      }
      setInkStrings([...inkStrings]);
      log(`✅ Ink: ${inkDone}/${inkTodo.length}`);
    }

    setStatus(abort.current ? 'idle' : 'done');
    const totalAll = done + inkStrings.filter(s => s.done).length;
    log(abort.current ? '⏹ Interrotto' : `🎉 Completato: ${totalAll} totali (${done} CSV + ${inkStrings.filter(s => s.done).length} Ink)`);
  }, [scan, model, targetLang, log, inkStrings]);

  const doExport = useCallback(async () => {
    if (!scan) return;
    const path = await dialogSave({ title: 'Esporta', filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: `${gameName}_translations.json` });
    if (!path) return;
    const csvData = scan.tables.flatMap(t => t.entries.filter(e => e.done).map(e => ({ type: 'csv', table: t.name, id: e.id, english: e.english, translated: e.translated, category: e.category })));
    const inkData = inkStrings.filter(s => s.done).map(s => ({ type: 'ink', english: s.text, translated: s.translated, source_file: s.source_file }));
    const all = [...csvData, ...inkData];
    await invoke('write_text_file', { path, content: JSON.stringify(all, null, 2) });
    log(`📁 Esportate ${csvData.length} CSV + ${inkData.length} Ink → ${path}`);
  }, [scan, gameName, log, inkStrings]);

  const doImport = useCallback(async () => {
    if (!scan) return;
    const path = await dialogOpen({ title: 'Importa', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path || typeof path !== 'string') return;
    const content: string = await invoke('read_text_file', { path });
    const items = JSON.parse(content);
    let csvCount = 0, inkCount = 0;
    for (const i of items) {
      if (i.type === 'ink' || (!i.type && !i.table)) {
        const s = inkStrings.find(x => x.text === i.english);
        if (s && i.translated) { s.translated = i.translated; s.done = true; inkCount++; }
      } else {
        const t = scan.tables.find(x => x.name === i.table);
        if (!t) continue;
        const e = t.entries.find(x => x.id === i.id);
        if (!e) continue;
        e.translated = i.translated; e.done = true; t.doneCount++; csvCount++;
      }
    }
    setScan(p => p ? { ...p, done: csvCount } : null);
    if (inkCount > 0) setInkStrings([...inkStrings]);
    log(`📥 Importate ${csvCount} CSV + ${inkCount} Ink`);
  }, [scan, log, inkStrings]);

  const pct = prog.tot > 0 ? Math.round((prog.cur / prog.tot) * 100) : 0;

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-700 via-amber-600 to-yellow-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg border border-white/10"><Globe className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('nav.unityCsvTranslator')}</h1>
              <p className="text-white/70 text-[10px]">{t('unityCsvPage.subtitle')}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {[{ v: scan?.tables.length || 0, l: 'Tabelle', I: Database }, { v: (scan?.total || 0) + inkStrings.length, l: 'Stringhe', I: FileText }, { v: (scan?.done || 0) + inkStrings.filter(s => s.done).length, l: 'Tradotte', I: CheckCircle2 }].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10">
                <s.I className="h-3.5 w-3.5 text-white" /><span className="text-sm font-bold text-white">{s.v}</span><span className="text-[10px] text-white/70">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-[10px] text-white/50 mr-2 self-center">{t('unityCsvPage.others')}</span>
          {[{ h: '/unity-patcher', i: Wand2, l: 'Unity Patcher' }, { h: '/unity-bundle', i: Package, l: 'Unity Bundle' }, { h: '/unreal-translator', i: Cpu, l: 'Unreal' }].map(x => (
            <Link key={x.h} href={x.h}><Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white"><x.i className="h-3 w-3" />{x.l}</Button></Link>
          ))}
        </div>
      </div>

      {/* Step 1: Select */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-white text-sm font-bold">1</div>
          <h2 className="text-base font-bold text-white">{t('unityCsvPage.selectUnityGame')}</h2>
        </div>
        <div className="flex gap-2 items-center">
          <Button onClick={browse} variant="outline" className="gap-2"><FolderOpen className="h-4 w-4" />{t('unityCsvPage.browse')}</Button>
          <div className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-300 truncate">{gamePath || 'Nessuna cartella selezionata'}</div>
          <Button onClick={doScan} disabled={!gamePath || status === 'scanning'} className="gap-2 bg-orange-600 hover:bg-orange-500">
            {status === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Scansiona
          </Button>
        </div>
        {scan && <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span><b className="text-slate-300">{t('unityCsvPage.gameLabel')}</b> {gameName}</span>
          <span><b className="text-slate-300">{t('unityCsvPage.unityLabel')}</b> {scan.unityVer}</span>
          <span><b className="text-slate-300">{t('unityCsvPage.tablesLabel')}</b> {scan.tables.length}</span>
          <span><b className="text-slate-300">{t('unityCsvPage.stringsLabel')}</b> {scan.total}</span>
        </div>}
      </div>

      {/* Step 2: Tables */}
      {scan && scan.tables.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold">2</div>
            <h2 className="text-base font-bold text-white">Tabelle CSV ({scan.tables.length})</h2>
            <div className="flex-1" />
            <Button onClick={doImport} variant="outline" size="sm" className="gap-1 h-7 text-xs"><Upload className="h-3 w-3" />{t("common.import")}</Button>
            <Button onClick={doExport} variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={!scan.done}><Download className="h-3 w-3" />{t("common.export")}</Button>
          </div>
          <div className="space-y-1.5">
            {scan.tables.map((t, ti) => {
              const k = `${t.name}-${ti}`;
              const isExp = expanded === k;
              const wt = t.entries.filter(e => e.english).length;
              return (
                <div key={k} className="rounded-lg border border-slate-700/60 bg-slate-800/40">
                  <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 text-left" onClick={() => setExpanded(isExp ? null : k)}>
                    {isExp ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    <Database className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-sm font-semibold text-white flex-1">{t.name}</span>
                    <span className="text-[10px] text-slate-500">{t.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{wt} str</span>
                    {t.doneCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">{t.doneCount} ✓</span>}
                  </button>
                  {isExp && (
                    <div className="px-3 pb-3 max-h-[350px] overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead><tr className="text-slate-500 border-b border-slate-700/50">
                          <th className="text-left py-1 w-24">ID</th><th className="text-left py-1 w-14">Cat</th>
                          <th className="text-left py-1">English</th><th className="text-left py-1">Traduzione</th>
                        </tr></thead>
                        <tbody>{t.entries.slice(0, 100).map((e, ei) => (
                          <tr key={ei} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                            <td className="py-1 text-slate-500 font-mono">{e.id}</td>
                            <td className="py-1"><span className={`text-[10px] px-1 py-0.5 rounded ${catColor[e.category] || catColor.other}`}>{e.category}</span></td>
                            <td className="py-1 text-slate-300 max-w-[280px] truncate">{e.english || '—'}</td>
                            <td className="py-1 text-emerald-300 max-w-[280px] truncate">{e.translated || <span className="text-slate-600">—</span>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {t.entries.length > 100 && <p className="text-[10px] text-slate-500 mt-2 text-center">100/{t.entries.length}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2b: Ink Strings */}
      {inkScanned && inkStrings.length > 0 && (
        <div className="rounded-xl border border-purple-800/40 bg-purple-900/10 p-4">
          <button className="w-full flex items-center gap-2" onClick={() => setShowInk(!showInk)}>
            {showInk ? <ChevronDown className="h-3.5 w-3.5 text-purple-400" /> : <ChevronRight className="h-3.5 w-3.5 text-purple-400" />}
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">✦</div>
            <h2 className="text-base font-bold text-white">Ink Dialogues ({inkStrings.length.toLocaleString()})</h2>
            <span className="text-[10px] text-purple-400">{inkFilesCount} file</span>
            <div className="flex-1" />
            {inkStrings.filter(s => s.done).length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">{inkStrings.filter(s => s.done).length.toLocaleString()} ✓</span>}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">{inkStrings.length.toLocaleString()} str</span>
          </button>
          {showInk && (
            <div className="mt-3 max-h-[400px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="text-left py-1 w-28">{t('unityCsvPage.file')}</th>
                  <th className="text-left py-1">{t('languages.en')}</th>
                  <th className="text-left py-1">{t('offlineTranslator.translation')}</th>
                </tr></thead>
                <tbody>{inkStrings.slice(0, 200).map((s, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                    <td className="py-1 text-purple-400/60 font-mono text-[9px]">{s.source_file.replace('sharedassets', 'sa')}</td>
                    <td className="py-1 text-slate-300 max-w-[300px] truncate">{s.text}</td>
                    <td className="py-1 text-emerald-300 max-w-[300px] truncate">{s.translated || <span className="text-slate-600">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
              {inkStrings.length > 200 && <p className="text-[10px] text-slate-500 mt-2 text-center">Mostrate 200/{inkStrings.length.toLocaleString()}</p>}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Translate */}
      {scan && scan.tables.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-yellow-600 flex items-center justify-center text-white text-sm font-bold">3</div>
            <h2 className="text-base font-bold text-white">{t('unityCsvPage.translateWithAi')}</h2>
            <div className="flex-1" />
            <Button onClick={() => setShowCfg(!showCfg)} variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-400"><Settings2 className="h-3 w-3" />{t('unityCsvPage.config')}</Button>
          </div>
          {showCfg && (
            <div className="mb-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex gap-4 items-center flex-wrap">
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-400">{t('aiTranslation.model')}</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-400">{t('unityCsvPage.langLabel')}</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
                  {['it','de','es','fr','pt','zh','ja','ko','ru'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
              <span className="text-[10px] text-slate-500">Ollama: {models.length ? `${models.length} modelli` : '⚠️ non connesso'}</span>
            </div>
          )}
          {status === 'translating' && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                <span className="text-xs text-slate-300">{prog.tbl}: {prog.cur}/{prog.tot} ({pct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {status !== 'translating' ? (
              <Button onClick={doTranslate} disabled={!models.length || status === 'scanning'} className="gap-2 bg-amber-600 hover:bg-amber-500">
                <Globe className="h-4 w-4" />Traduci Tutto ({((scan?.total || 0) - (scan?.done || 0)) + inkStrings.filter(s => !s.done && s.text.length >= 3).length})
              </Button>
            ) : (
              <Button onClick={() => { abort.current = true; }} variant="destructive" className="gap-2">
                <StopCircle className="h-4 w-4" />{t('subtitleOverlay.stop')}</Button>
            )}
            {status === 'done' && <span className="flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" />{t('unityCsvPage.translationComplete')}</span>}
          </div>
        </div>
      )}

      {/* Step 4: Inject — Fully Automatic */}
      {scan && (scan.done > 0 || inkStrings.some(s => s.done)) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">4</div>
            <h2 className="text-base font-bold text-white">{t('unityCsvPage.injectInGame')}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/30">{t('unityCsvPage.resizeInjection')}</span>
          </div>
          <div className="mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span><b className="text-white">{scan.done}</b> CSV pronte</span>
              {inkStrings.filter(s => s.done).length > 0 && <span><b className="text-purple-300">{inkStrings.filter(s => s.done).length.toLocaleString()}</b> Ink pronte</span>}
              <span><b className="text-emerald-300">{scan.done + inkStrings.filter(s => s.done).length}</b> totali</span>
              <span className="text-slate-500">{t('unityCsvPage.backupInfo')}</span>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button
              onClick={async () => {
                setInjecting(true); setInjectResult(null);
                const translated = scan.tables.flatMap(t =>
                  t.entries.filter(e => e.done && e.translated).map(e => ({
                    id: e.id, english: e.english, translated: e.translated, table: t.name,
                  }))
                );
                const inkDone = inkStrings.filter(s => s.done && s.translated).map(s => ({ english: s.text, translated: s.translated }));
                log(`🚀 Injection automatica: ${translated.length} CSV + ${inkDone.length} Ink...`);
                try {
                  const dataDir = scan.gamePath.replace(/\\/g, '/').includes('_Data')
                    ? scan.gamePath
                    : `${scan.gamePath}/${gameName}_Data`;
                  const r = await invoke('inject_unity_assets', {
                    gameDir: dataDir,
                    translations: translated,
                    csvDir: csvExportDir || null,
                    inkCsv: inkCsvPath || null,
                    inkTranslations: inkDone.length > 0 ? inkDone : null,
                    mode: 'all',
                  }) as InjectResult;
                  setInjectResult(r);
                  const total = (r.ink_replaced || 0) + (r.level_replaced || 0);
                  log(r.success ? `✅ Completato: ${total} iniettate (Ink: ${r.ink_replaced}, Level: ${r.level_replaced})` : `❌ ${r.errors?.join(', ')}`);
                } catch (e) { log(`❌ ${e}`); setInjectResult({ success: false, ink_replaced: 0, ink_files: 0, level_replaced: 0, level_files: 0, errors: [String(e)], output: '' }); }
                setInjecting(false);
              }}
              disabled={injecting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500"
            >
              {injecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {injecting ? 'Injection in corso...' : `Inietta ${scan.done} Traduzioni`}
            </Button>
            <Button
              onClick={async () => {
                log('🔄 Ripristino backup...');
                try {
                  const dataDir = scan.gamePath.replace(/\\/g, '/').includes('_Data')
                    ? scan.gamePath
                    : `${scan.gamePath}/${gameName}_Data`;
                  const r = await invoke('restore_unity_assets', { gameDir: dataDir }) as string;
                  log(`✅ ${r}`);
                } catch (e) { log(`❌ ${e}`); }
              }}
              variant="outline" size="sm" className="gap-1 h-8 text-xs"
            >
              <RotateCcw className="h-3 w-3" />{t('settings.restoreBackup')}</Button>
            {!inkCsvPath && (
              <Button onClick={async () => { const p = await dialogOpen({ title: 'CSV traduzioni Ink (opzionale)', filters: [{ name: 'CSV', extensions: ['csv'] }] }); if (p && typeof p === 'string') { setInkCsvPath(p); log(`📁 Ink CSV: ${p}`); } }} variant="ghost" size="sm" className="gap-1 h-8 text-xs text-slate-500 hover:text-slate-300">
                <Upload className="h-3 w-3" />+ Ink CSV
              </Button>
            )}
            {inkCsvPath && <span className="text-[10px] text-emerald-400">+ Ink: {inkCsvPath.split(/[\\/]/).pop()}</span>}
          </div>
          {injectResult && (
            <div className={`mt-3 p-3 rounded-lg border ${injectResult.success ? 'border-emerald-700/50 bg-emerald-900/20' : 'border-red-700/50 bg-red-900/20'}`}>
              {injectResult.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{t('unityCsvPage.injectionComplete')}</div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    {injectResult.ink_replaced > 0 && <span><b className="text-emerald-300">{injectResult.ink_replaced}</b> Ink ({injectResult.ink_files} file)</span>}
                    {injectResult.level_replaced > 0 && <span><b className="text-emerald-300">{injectResult.level_replaced}</b> Level ({injectResult.level_files} file)</span>}
                    <span><b className="text-white">{(injectResult.ink_replaced || 0) + (injectResult.level_replaced || 0)}</b> totali</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-300"><AlertTriangle className="h-4 w-4" />{injectResult.errors?.[0] || 'Errore sconosciuto'}</div>
              )}
            </div>
          )}
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
