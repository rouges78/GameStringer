"use client";

import { useState, useCallback, useRef } from "react";
import {
  Gamepad2,
  Upload,
  Download,
  FileText,
  Table,
  Type,
  Search,
  Wand2,
  Info,
  AlertTriangle,
  CheckCircle,
  Copy,
  Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  detectRomPlatform,
  getRomInfo,
  parseTableFile,
  generateTableFile,
  generateAsciiTable,
  generateItalianTable,
  extractTextWithTable,
  findTextRegions,
  textToBytes,
  RomInfo,
  TableFile,
  TextBlock,
  PLATFORM_NAMES,
  PLATFORM_TOOLS
} from "@/lib/retro-rom-tools";
import { useTranslation } from "@/lib/i18n";

export default function RetroPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);
  
  const [romData, setRomData] = useState<Uint8Array | null>(null);
  const [romInfo, setRomInfo] = useState<RomInfo | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [tableFile, setTableFile] = useState<TableFile | null>(null);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [textRegions, setTextRegions] = useState<Array<{ start: number; end: number; preview: string }>>([]);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>("");
  const [searchOffset, setSearchOffset] = useState<string>("");
  const [searchLength, setSearchLength] = useState<string>("1000");

  const handleRomUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      setRomData(data);
      
      const info = getRomInfo(data);
      setRomInfo(info);
      
      // Auto-find text regions
      const regions = findTextRegions(data, 5);
      setTextRegions(regions.slice(0, 100)); // Limit to first 100
    };
    
    reader.readAsArrayBuffer(file);
  }, []);

  const handleTableUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const table = parseTableFile(content);
      table.name = file.name.replace('.tbl', '');
      setTableFile(table);
    };
    reader.readAsText(file);
  }, []);

  const handleGenerateTable = (type: 'ascii' | 'italian') => {
    const table = type === 'italian' ? generateItalianTable() : generateAsciiTable();
    setTableFile(table);
  };

  const handleExtractText = () => {
    if (!romData || !tableFile) return;
    
    const start = parseInt(searchOffset, 16) || 0;
    const length = parseInt(searchLength) || 1000;
    const end = Math.min(start + length, romData.length);
    
    const blocks = extractTextWithTable(romData, tableFile, start, end);
    setTextBlocks(blocks);
  };

  const handleExportTable = () => {
    if (!tableFile) return;
    
    const content = generateTableFile(tableFile);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableFile.name}.tbl`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const formatHex = (num: number) => num.toString(16).toUpperCase().padStart(6, '0');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Header - Compatto */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t('retroRom.title')}</h1>
              <p className="text-white/80 text-xs">{t('retroRom.subtitle')}</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-sm font-bold">8</span>
              <span className="text-[10px] text-white/70">{t('retroRom.consoles')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Table className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[10px] text-white/70">{t('retroRom.tblSupport')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Type className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[10px] text-white/70">{t('retroRom.fontInjection')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {!romData && (
        <Card>
          <CardContent className="p-6">
            <div
              className="border-2 border-dashed border-teal-500/30 rounded-lg p-8 text-center hover:border-teal-400/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".nes,.sfc,.smc,.gb,.gbc,.gba,.bin,.md,.gen,.iso,.exe"
                onChange={handleRomUpload}
                className="hidden"
              />
              <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">{t('retroRom.loadRom')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('retroRom.dragOrClick')}
              </p>
              <div className="flex justify-center gap-3 flex-wrap">
                {/* NES */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="NES">
                  <svg viewBox="0 0 32 24" className="w-10 h-7">
                    <rect x="1" y="4" width="30" height="16" rx="2" fill="#8B0000" stroke="#333" strokeWidth="1"/>
                    <rect x="4" y="8" width="8" height="8" rx="1" fill="#222"/>
                    <circle cx="22" cy="12" r="3" fill="#222"/>
                    <circle cx="27" cy="10" r="2" fill="#222"/>
                  </svg>
                </div>
                {/* SNES */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="SNES">
                  <svg viewBox="0 0 32 20" className="w-10 h-6">
                    <rect x="1" y="2" width="30" height="16" rx="3" fill="#9090A0" stroke="#666" strokeWidth="1"/>
                    <rect x="4" y="6" width="6" height="6" rx="1" fill="#333"/>
                    <circle cx="22" cy="9" r="2" fill="#22AA22"/>
                    <circle cx="26" cy="7" r="2" fill="#DDDD22"/>
                    <circle cx="24" cy="11" r="2" fill="#2222DD"/>
                    <circle cx="28" cy="9" r="2" fill="#DD2222"/>
                  </svg>
                </div>
                {/* Game Boy */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="GB/GBC">
                  <svg viewBox="0 0 20 32" className="w-5 h-8">
                    <rect x="1" y="1" width="18" height="30" rx="2" fill="#C0C0C0" stroke="#666" strokeWidth="1"/>
                    <rect x="3" y="3" width="14" height="10" rx="1" fill="#8BAC0F"/>
                    <rect x="6" y="18" width="4" height="4" rx="2" fill="#333"/>
                    <rect x="11" y="19" width="3" height="2" rx="1" fill="#333"/>
                    <rect x="4" y="24" width="5" height="1.5" rx="0.5" fill="#333"/>
                    <rect x="11" y="24" width="5" height="1.5" rx="0.5" fill="#333"/>
                  </svg>
                </div>
                {/* GBA */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="GBA">
                  <svg viewBox="0 0 36 20" className="w-10 h-5">
                    <rect x="1" y="2" width="34" height="16" rx="3" fill="#5555AA" stroke="#333" strokeWidth="1"/>
                    <rect x="10" y="5" width="16" height="10" rx="1" fill="#8BAC0F"/>
                    <rect x="3" y="8" width="4" height="4" rx="2" fill="#222"/>
                    <circle cx="31" cy="10" r="2" fill="#222"/>
                  </svg>
                </div>
                {/* Genesis/Mega Drive */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="Genesis">
                  <svg viewBox="0 0 36 20" className="w-10 h-5">
                    <rect x="1" y="2" width="34" height="16" rx="2" fill="#111" stroke="#333" strokeWidth="1"/>
                    <rect x="4" y="6" width="6" height="6" rx="1" fill="#333"/>
                    <circle cx="24" cy="9" r="3" fill="#333"/>
                    <circle cx="30" cy="9" r="2" fill="#333"/>
                    <rect x="12" y="4" width="8" height="3" rx="1" fill="#333"/>
                  </svg>
                </div>
                {/* PlayStation Console */}
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" title="PSX">
                  <svg viewBox="0 0 40 16" className="w-12 h-5">
                    <rect x="1" y="1" width="38" height="14" rx="1" fill="#BEBEBE" stroke="#888" strokeWidth="0.5"/>
                    <circle cx="20" cy="8" r="5" fill="#333" stroke="#222" strokeWidth="0.5"/>
                    <circle cx="20" cy="8" r="3" fill="#444"/>
                    <rect x="3" y="4" width="2" height="1" rx="0.3" fill="#666"/>
                    <rect x="3" y="6" width="2" height="1" rx="0.3" fill="#666"/>
                    <rect x="35" y="5" width="2" height="2" rx="0.5" fill="#666"/>
                    <rect x="32" y="5" width="2" height="2" rx="0.5" fill="#666"/>
                  </svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {romData && romInfo && (
        <>
          {/* ROM Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-500/10 rounded-lg">
                    <Gamepad2 className="w-6 h-6 text-teal-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{fileName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                        {PLATFORM_NAMES[romInfo.platform]}
                      </Badge>
                      <Badge variant="outline">{romInfo.region}</Badge>
                      {romInfo.format && <Badge variant="secondary">{romInfo.format}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{t('retroRom.title_')}: <span className="font-medium text-foreground">{romInfo.title || 'N/A'}</span></p>
                  <p>{t('retroRom.size')}: {(romInfo.size / 1024).toFixed(1)} KB</p>
                  {romInfo.mapper && <p>{t('retroRom.mapper')}: {romInfo.mapper}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Table Management */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    {t('retroRom.tableFile')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <input
                    ref={tableInputRef}
                    type="file"
                    accept=".tbl"
                    onChange={handleTableUpload}
                    className="hidden"
                  />
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => tableInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {t('retroRom.loadTbl')}
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleGenerateTable('ascii')}
                    >
                      ASCII
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleGenerateTable('italian')}
                    >
                      🇮🇹 Italiano
                    </Button>
                  </div>
                  
                  {tableFile && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{tableFile.name}</span>
                        <Badge variant="outline">{tableFile.entries.length} entries</Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full"
                        onClick={handleExportTable}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {t('retroRom.export')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tools */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="w-4 h-4" />
                    {t('retroRom.externalTools')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2 text-xs">
                    {PLATFORM_TOOLS[romInfo.platform]?.map(tool => (
                      <div key={tool} className="flex items-center gap-2 text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-teal-500" />
                        {tool}
                      </div>
                    ))}
                    {(!PLATFORM_TOOLS[romInfo.platform] || PLATFORM_TOOLS[romInfo.platform].length === 0) && (
                      <p className="text-muted-foreground">{t('retroRom.noSpecificTool')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center: Text Extraction */}
            <div className="col-span-2 space-y-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    {t('retroRom.extractText')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">{t('retroRom.offsetHex')}</label>
                      <Input
                        placeholder="0x0000"
                        value={searchOffset}
                        onChange={(e) => setSearchOffset(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-muted-foreground mb-1 block">{t('retroRom.length')}</label>
                      <Input
                        type="number"
                        value={searchLength}
                        onChange={(e) => setSearchLength(e.target.value)}
                      />
                    </div>
                    <div className="pt-5">
                      <Button onClick={handleExtractText} disabled={!tableFile}>
                        <Search className="w-4 h-4 mr-2" />
                        {t('retroRom.extract')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="extracted">
                <TabsList>
                  <TabsTrigger value="extracted">{t('retroRom.extractedText')} ({textBlocks.length})</TabsTrigger>
                  <TabsTrigger value="regions">{t('retroRom.autoRegions')} ({textRegions.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="extracted">
                  <Card>
                    <ScrollArea className="h-[400px]">
                      <div className="p-4 space-y-2">
                        {textBlocks.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            {tableFile ? t('retroRom.noTextFound') : t('retroRom.loadTblFirst')}
                          </p>
                        ) : (
                          textBlocks.map((block, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedBlock === idx 
                                  ? 'border-teal-500 bg-teal-500/10' 
                                  : 'hover:border-muted-foreground/50'
                              }`}
                              onClick={() => {
                                setSelectedBlock(idx);
                                setEditedText(block.translatedText || block.originalText);
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  0x{formatHex(block.offset)}
                                </Badge>
                                {block.translatedText && (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                )}
                              </div>
                              <p className="text-sm">{block.originalText}</p>
                              {block.translatedText && (
                                <p className="text-sm text-teal-400 mt-1">{block.translatedText}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </TabsContent>
                
                <TabsContent value="regions">
                  <Card>
                    <ScrollArea className="h-[400px]">
                      <div className="p-4 space-y-2">
                        {textRegions.map((region, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border hover:border-muted-foreground/50 cursor-pointer"
                            onClick={() => {
                              setSearchOffset(region.start.toString(16));
                              setSearchLength((region.end - region.start).toString());
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                0x{formatHex(region.start)} - 0x{formatHex(region.end)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {region.end - region.start} bytes
                              </span>
                            </div>
                            <p className="text-sm font-mono text-muted-foreground truncate">
                              {region.preview}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Info Box */}
          <Card className="bg-teal-500/5 border-teal-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-teal-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-teal-400 mb-1">{t('retroRom.howToUse')}</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>{t('retroRom.step1')}</li>
                    <li>{t('retroRom.step2')}</li>
                    <li>{t('retroRom.step3')}</li>
                    <li>{t('retroRom.step4')}</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
