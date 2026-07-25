'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  ArrowLeft,
  Send,
  Package,
  Gamepad2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCategories,
  createThread,
  type ForumCategory,
  type ForumThread,
  type PackData,
} from '@/lib/social/forum';
import { toast } from 'sonner';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

// ─── LANGUAGES ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

// ─── NEW THREAD FORM ─────────────────────────────────────────────────────────

interface NewThreadProps {
  initialCategory?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onBack?: () => void;
  onSuccess?: (thread: ForumThread) => void;
}

export function NewThread({ initialCategory, userId, userName, userAvatar, onBack, onSuccess }: NewThreadProps) {
  const { t } = useTranslation();
  
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [categorySlug, setCategorySlug] = useState(initialCategory || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isTranslationPack, setIsTranslationPack] = useState(initialCategory === 'traduzioni');
  
  // Pack data
  const [gameName, setGameName] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('en');
  useDefaultTargetLang(setTargetLang);
  const [stringCount, setStringCount] = useState('');
  const [version, setVersion] = useState('1.0');
  const [engine, setEngine] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  
  // ─── LOAD CATEGORIES ───────────────────────────────────────────────────────
  
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);
  
  // Auto-enable pack mode when selecting traduzioni category
  useEffect(() => {
    if (categorySlug === 'traduzioni') {
      setIsTranslationPack(true);
    }
  }, [categorySlug]);
  
  // ─── SUBMIT ────────────────────────────────────────────────────────────────
  
  const handleSubmit = async () => {
    // Senza profilo locale il ponte auth non può autenticare su Supabase e la RLS
    // rifiuterebbe l'insert: meglio dirlo PRIMA che l'utente compili tutto.
    if (!userId) {
      toast.error(t('forum.loginRequired'), { description: t('forum.loginRequiredHint') });
      return;
    }
    if (!categorySlug) {
      toast.error(t('common.selezionaUnaCategoria'));
      return;
    }
    if (!title.trim()) {
      toast.error(t('common.inserisciUnTitolo'));
      return;
    }
    if (!content.trim()) {
      toast.error(t('common.inserisciUnContenuto'));
      return;
    }
    
    if (isTranslationPack) {
      if (!gameName.trim()) {
        toast.error(t('common.inserisciIlNomeDelGioco'));
        return;
      }
      if (!downloadUrl.trim()) {
        toast.error(t('common.inserisciIlLinkPerIlDownload'));
        return;
      }
    }
    
    setLoading(true);
    try {
      const packData: PackData | undefined = isTranslationPack ? {
        game_name: gameName,
        source_lang: sourceLang,
        target_lang: targetLang,
        string_count: parseInt(stringCount) || 0,
        version,
        engine: engine || undefined,
        download_url: downloadUrl,
      } : undefined;
      
      const thread = await createThread(
        {
          category_slug: categorySlug,
          title,
          content,
          is_translation_pack: isTranslationPack,
          pack_data: packData,
        },
        { id: userId, name: userName, avatar: userAvatar }
      );
      
      if (thread) {
        toast.success(t('common.threadCreatoConSuccesso'));
        onSuccess?.(thread);
      } else {
        // Input già validati sopra: se createThread torna null la causa è il
        // backend community (ponte auth giù o insert respinta), non l'utente.
        toast.error(t('forum.backendUnavailable'));
      }
    } catch (error) {
      console.error('[NewThread] Error:', error);
      toast.error(t('common.erroreNellaCreazioneDelThread'));
    } finally {
      setLoading(false);
    }
  };
  
  // ─── RENDER ────────────────────────────────────────────────────────────────
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header con gradient */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-purple-600/20 rounded-2xl blur-xl" />
        <div className="relative flex items-center gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 hover:bg-slate-800">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-violet-200 to-indigo-200 bg-clip-text text-transparent">
              {t('common.nuovoThread')}
            </h1>
            <p className="text-sm text-slate-400 mt-1">Condividi con la community</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Send className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      {/* Senza profilo locale la pubblicazione non può funzionare (il ponte auth
          non ha una sessione da portare su Supabase): dirlo subito, non dopo
          che l'utente ha scritto tutto. */}
      {!userId && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">{t('forum.loginRequired')}</p>
          <p className="text-xs text-amber-200/80 mt-1">{t('forum.loginRequiredHint')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Card */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-5 backdrop-blur-sm">
            <Label className="text-sm font-medium text-slate-300 mb-3 block">{t('common.categoria')} *</Label>
            <Select value={categorySlug} onValueChange={setCategorySlug}>
              <SelectTrigger className="h-12 bg-slate-800/80 border-slate-700/50 hover:border-violet-500/50 transition-colors">
                <SelectValue placeholder={t('common.selezionaUnaCategoria')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug} className="hover:bg-slate-800">
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="font-medium">{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Title Card */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-5 backdrop-blur-sm">
            <Label className="text-sm font-medium text-slate-300 mb-3 block">{t('common.titolo')} *</Label>
            <Input
              placeholder={t('common.unTitoloDescrittivoPerIlTuoThread')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 bg-slate-800/80 border-slate-700/50 focus:border-violet-500/50 text-lg"
            />
          </div>
          
          {/* Content Card */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-5 backdrop-blur-sm">
            <Label className="text-sm font-medium text-slate-300 mb-3 block">{t('common.contenuto')} *</Label>
            <Textarea
              placeholder={isTranslationPack 
                ? t('common.descrizionePackPlaceholder')
                : t('common.contenutoThreadPlaceholder')
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[250px] bg-slate-800/80 border-slate-700/50 focus:border-violet-500/50 resize-none"
            />
          </div>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Translation Pack Toggle */}
          <div className="rounded-xl overflow-hidden">
            <div className={`p-5 transition-all ${isTranslationPack ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40' : 'bg-slate-900/60 border border-slate-800/60'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isTranslationPack ? 'bg-amber-500/30' : 'bg-slate-800'}`}>
                  <Package className={`h-5 w-5 ${isTranslationPack ? 'text-amber-400' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t('common.questoÈUnPackDiTraduzione')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('common.attivaPerCondividereUnPackScaricabile')}</p>
                </div>
                <Switch
                  checked={isTranslationPack}
                  onCheckedChange={setIsTranslationPack}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            </div>
          </div>
          
          {/* Pack Details */}
          {isTranslationPack && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-5 space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                {t('common.dettagliPack')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-400">{t('common.nomeGioco')} *</Label>
                  <Input
                    placeholder="es. The Witcher 3"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30 focus:border-amber-400"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-slate-400">Engine</Label>
                  <Input
                    placeholder="es. Unity, Unreal"
                    value={engine}
                    onChange={(e) => setEngine(e.target.value)}
                    className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30 focus:border-amber-400"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">{t('common.linguaOriginale')}</Label>
                    <Select value={sourceLang} onValueChange={setSourceLang}>
                      <SelectTrigger className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">{t('common.linguaTraduzione')}</Label>
                    <Select value={targetLang} onValueChange={setTargetLang}>
                      <SelectTrigger className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">{t('common.numeroStringhe')}</Label>
                    <Input
                      type="number"
                      placeholder="15000"
                      value={stringCount}
                      onChange={(e) => setStringCount(e.target.value)}
                      className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">{t('common.versione')}</Label>
                    <Input
                      placeholder="1.0"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-slate-400">{t('common.linkDownload')} *</Label>
                  <Input
                    placeholder="https://..."
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    className="mt-1.5 h-10 bg-slate-900/80 border-amber-500/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Card */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-5 space-y-4">
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !userId || !categorySlug || !title.trim() || !content.trim()}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/30 font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {t('common.pubblicazione')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t('common.pubblicaThread')}
                </>
              )}
            </Button>
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="w-full h-10 text-slate-400 hover:text-white">
                {t('common.annulla')}
              </Button>
            )}
            <p className="text-2xs text-slate-500 text-center">
              * {t('common.campiObbligatori')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

