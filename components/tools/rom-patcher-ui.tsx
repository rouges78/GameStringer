'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Download,
  FileUp,
  FileDown,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  Zap,
  Info,
  RefreshCw,
  Share2,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  applyPatch,
  createPatch,
  identifyPatch,
  type PatchResult,
  type CreatePatchResult,
  type PatchInfo
} from '@/lib/rom-patcher';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(data: Uint8Array, filename: string) {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  const blob = new Blob([copy], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RomPatcherUI() {
  const router = useRouter();

  // === APPLY TAB STATE ===
  const [applyRomFile, setApplyRomFile] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [applyPatchFile, setApplyPatchFile] = useState<{ name: string; data: Uint8Array; info: PatchInfo } | null>(null);
  const [applyResult, setApplyResult] = useState<PatchResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // === CREATE TAB STATE ===
  const [createOriginal, setCreateOriginal] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [createModified, setCreateModified] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [createFormat, setCreateFormat] = useState<'auto' | 'ips' | 'bps'>('auto');
  const [createResult, setCreateResult] = useState<CreatePatchResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const applyRomRef = useRef<HTMLInputElement>(null);
  const applyPatchRef = useRef<HTMLInputElement>(null);
  const createOrigRef = useRef<HTMLInputElement>(null);
  const createModRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // === APPLY HANDLERS ===
  const handleApplyRom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setApplyRomFile({ name: file.name, data });
    setApplyResult(null);
  };

  const handleApplyPatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    const info = identifyPatch(data);
    setApplyPatchFile({ name: file.name, data, info });
    setApplyResult(null);
  };

  const handleApply = async () => {
    if (!applyRomFile || !applyPatchFile) return;
    setIsApplying(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      const result = applyPatch(applyRomFile.data, applyPatchFile.data);
      setApplyResult(result);
      if (result.success) {
        toast.success(`Patch applicata! ${result.recordsApplied} record, output ${formatBytes(result.outputSize)}`);
      } else {
        toast.error(result.error || 'Errore applicazione patch');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore applicazione patch');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownloadPatched = () => {
    if (!applyResult?.output || !applyRomFile) return;
    const ext = applyRomFile.name.includes('.') ? applyRomFile.name.split('.').pop() : 'bin';
    const baseName = applyRomFile.name.replace(/\.[^.]+$/, '');
    downloadBlob(applyResult.output, `${baseName}_patched.${ext}`);
  };

  // === VERIFY ROUNDTRIP ===
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleVerifyRoundtrip = async () => {
    if (!createResult?.patch || !createOriginal || !createModified) return;
    const { applyPatch: applyPatchFn } = await import('@/lib/rom-patcher');
    const applied = applyPatchFn(createOriginal.data, createResult.patch);
    if (!applied.success || !applied.output) {
      setVerifyStatus('fail');
      toast.error('Verifica fallita: la patch non si applica correttamente');
      return;
    }
    if (applied.output.length !== createModified.data.length) {
      setVerifyStatus('fail');
      toast.error(`Dimensione diversa: ${applied.output.length} vs ${createModified.data.length}`);
      return;
    }
    for (let i = 0; i < applied.output.length; i++) {
      if (applied.output[i] !== createModified.data[i]) {
        setVerifyStatus('fail');
        toast.error(`Byte diverso all'offset 0x${i.toString(16)}`);
        return;
      }
    }
    setVerifyStatus('ok');
    toast.success('Verifica OK: la patch riproduce perfettamente la ROM tradotta!');
  };

  const handlePublishToHub = () => {
    const params = new URLSearchParams({ action: 'publish' });
    if (createOriginal) params.set('gameName', createOriginal.name.replace(/\.[^.]+$/, ''));
    router.push(`/community-hub?${params.toString()}`);
  };

  // === CREATE HANDLERS ===
  const handleCreateOriginal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setCreateOriginal({ name: file.name, data });
    setCreateResult(null);
  };

  const handleCreateModified = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setCreateModified({ name: file.name, data });
    setCreateResult(null);
  };

  const handleCreate = async () => {
    if (!createOriginal || !createModified) return;
    setIsCreating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      const fmt = createFormat === 'auto' ? undefined : createFormat;
      const result = createPatch(createOriginal.data, createModified.data, fmt);
      setCreateResult(result);
      if (result.success) {
        toast.success(`Patch ${result.format.toUpperCase()} creata! ${result.records} record, ${formatBytes(result.patchSize)}`);
      } else {
        toast.error(result.error || 'Errore creazione patch');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore creazione patch');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadPatch = () => {
    if (!createResult?.patch || !createOriginal) return;
    const baseName = createOriginal.name.replace(/\.[^.]+$/, '');
    const ext = createResult.format;
    downloadBlob(createResult.patch, `${baseName}_translation.${ext}`);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="apply">
        <TabsList className="h-8">
          <TabsTrigger value="apply" className="text-xs h-7">
            <Zap className="h-3 w-3 mr-1" />Applica Patch
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs h-7">
            <FileUp className="h-3 w-3 mr-1" />Crea Patch (Export)
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* APPLICA PATCH */}
        {/* ============================================================ */}
        <TabsContent value="apply" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                Applica Patch IPS/BPS a una ROM
              </CardTitle>
              <CardDescription className="text-xs">
                Seleziona la ROM originale e il file patch. Il formato viene rilevato automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* ROM input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROM Originale</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-purple-400/50 transition-colors"
                  onClick={() => applyRomRef.current?.click()}
                >
                  <input ref={applyRomRef} type="file" className="hidden" onChange={handleApplyRom} />
                  {applyRomFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <HardDrive className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{applyRomFile.name}</span>
                      <Badge variant="outline" className="text-2xs">{formatBytes(applyRomFile.data.length)}</Badge>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Clicca per selezionare la ROM (.smc, .sfc, .nes, .gba, .nds, .bin, ...)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Patch input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">File Patch</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-purple-400/50 transition-colors"
                  onClick={() => applyPatchRef.current?.click()}
                >
                  <input ref={applyPatchRef} type="file" accept=".ips,.bps" className="hidden" onChange={handleApplyPatch} />
                  {applyPatchFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileDown className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">{applyPatchFile.name}</span>
                      <Badge className={`text-2xs uppercase ${applyPatchFile.info.valid ? 'bg-green-500' : 'bg-red-500'}`}>
                        {applyPatchFile.info.format}
                      </Badge>
                      <Badge variant="outline" className="text-2xs">{formatBytes(applyPatchFile.data.length)}</Badge>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Clicca per selezionare la patch (.ips, .bps)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Patch info */}
              {applyPatchFile && applyPatchFile.info.valid && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-xs">
                  <Info className="h-3 w-3 text-blue-400" />
                  <span>Formato: <strong>{applyPatchFile.info.format.toUpperCase()}</strong></span>
                  {applyPatchFile.info.targetSize && (
                    <span>Target: <strong>{formatBytes(applyPatchFile.info.targetSize)}</strong></span>
                  )}
                  {applyPatchFile.info.sourceCrc && (
                    <span>CRC32 src: <code className="text-2xs">{applyPatchFile.info.sourceCrc}</code></span>
                  )}
                </div>
              )}

              {/* Apply button */}
              <Button
                className="w-full bg-purple-500 hover:bg-purple-600"
                disabled={!applyRomFile || !applyPatchFile || isApplying}
                onClick={handleApply}
              >
                {isApplying ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Applicazione in corso...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" />Applica Patch</>
                )}
              </Button>

              {/* Result */}
              {applyResult && (
                <div className={`p-3 rounded-lg border ${applyResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {applyResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {applyResult.success ? 'Patch applicata con successo!' : 'Errore'}
                    </span>
                  </div>
                  {applyResult.success ? (
                    <div className="space-y-2">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Formato: <strong>{applyResult.format.toUpperCase()}</strong></span>
                        <span>Record: <strong>{applyResult.recordsApplied}</strong></span>
                        <span>Output: <strong>{formatBytes(applyResult.outputSize)}</strong></span>
                      </div>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleDownloadPatched}>
                        <Download className="h-3 w-3 mr-1" />Scarica ROM Patchata
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-red-400">{applyResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* CREA PATCH (EXPORT) */}
        {/* ============================================================ */}
        <TabsContent value="create" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileUp className="h-4 w-4 text-orange-400" />
                Crea Patch IPS/BPS da ROM
              </CardTitle>
              <CardDescription className="text-xs">
                Confronta la ROM originale con quella tradotta per generare un file patch distribuibile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Original ROM */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROM Originale (non modificata)</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-orange-400/50 transition-colors"
                  onClick={() => createOrigRef.current?.click()}
                >
                  <input ref={createOrigRef} type="file" className="hidden" onChange={handleCreateOriginal} />
                  {createOriginal ? (
                    <div className="flex items-center justify-center gap-2">
                      <HardDrive className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">{createOriginal.name}</span>
                      <Badge variant="outline" className="text-2xs">{formatBytes(createOriginal.data.length)}</Badge>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">ROM originale giapponese/inglese</p>
                    </>
                  )}
                </div>
              </div>

              {/* Modified ROM */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROM Tradotta (modificata)</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-orange-400/50 transition-colors"
                  onClick={() => createModRef.current?.click()}
                >
                  <input ref={createModRef} type="file" className="hidden" onChange={handleCreateModified} />
                  {createModified ? (
                    <div className="flex items-center justify-center gap-2">
                      <HardDrive className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{createModified.name}</span>
                      <Badge variant="outline" className="text-2xs">{formatBytes(createModified.data.length)}</Badge>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">ROM con la traduzione applicata</p>
                    </>
                  )}
                </div>
              </div>

              {/* Size comparison */}
              {createOriginal && createModified && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-xs">
                  <Info className="h-3 w-3 text-blue-400" />
                  <span>Originale: <strong>{formatBytes(createOriginal.data.length)}</strong></span>
                  <span>Tradotta: <strong>{formatBytes(createModified.data.length)}</strong></span>
                  {createOriginal.data.length !== createModified.data.length && (
                    <Badge variant="outline" className="text-2xs">
                      {createModified.data.length > createOriginal.data.length ? '+' : ''}
                      {formatBytes(createModified.data.length - createOriginal.data.length)}
                    </Badge>
                  )}
                </div>
              )}

              {/* Format select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Formato Patch</Label>
                <Select value={createFormat} onValueChange={(v) => setCreateFormat(v as string)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (IPS se &le;16MB, altrimenti BPS)</SelectItem>
                    <SelectItem value="ips">IPS (classico, compatibile con tutti i patcher)</SelectItem>
                    <SelectItem value="bps">BPS (moderno, con verifica CRC32)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Create button */}
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={!createOriginal || !createModified || isCreating}
                onClick={handleCreate}
              >
                {isCreating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creazione in corso...</>
                ) : (
                  <><FileUp className="h-4 w-4 mr-2" />Crea Patch</>
                )}
              </Button>

              {/* Result */}
              {createResult && (
                <div className={`p-3 rounded-lg border ${createResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {createResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {createResult.success ? `Patch ${createResult.format.toUpperCase()} creata!` : 'Errore'}
                    </span>
                  </div>
                  {createResult.success ? (
                    <div className="space-y-2">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Formato: <strong>{createResult.format.toUpperCase()}</strong></span>
                        <span>Record: <strong>{createResult.records}</strong></span>
                        <span>Dimensione: <strong>{formatBytes(createResult.patchSize)}</strong></span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleDownloadPatch}>
                          <Download className="h-3 w-3 mr-1" />Scarica .{createResult.format}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleVerifyRoundtrip} disabled={verifyStatus === 'ok'}>
                          <ShieldCheck className={`h-3 w-3 mr-1 ${verifyStatus === 'ok' ? 'text-green-500' : verifyStatus === 'fail' ? 'text-red-500' : ''}`} />
                          {verifyStatus === 'ok' ? 'Verificata' : verifyStatus === 'fail' ? 'Fallita' : 'Verifica'}
                        </Button>
                        <Button size="sm" className="bg-purple-500 hover:bg-purple-600" onClick={handlePublishToHub}>
                          <Share2 className="h-3 w-3 mr-1" />Pubblica nel Hub
                        </Button>
                      </div>
                      <div className="mt-2 p-2 rounded bg-muted/50">
                        <p className="text-2xs text-muted-foreground">
                          La patch contiene solo le differenze tra le due ROM — sicura da distribuire, nessun dato protetto da copyright.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-400">{createResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info box */}
          <Card className="border-amber-500/20">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>IPS</strong> — formato classico, supportato da tutti gli emulatori e patcher. Max 16MB. Non verifica integrita.</p>
                  <p><strong>BPS</strong> — formato moderno di byuu. Nessun limite dimensione. Include checksum CRC32 per ROM sorgente, target e patch.</p>
                  <p>Le patch contengono <strong>solo le differenze</strong> tra le due ROM — non includono contenuto protetto da copyright.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RomPatcherUI;
