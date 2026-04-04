'use client';

import { useVersion } from '@/lib/version';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Info, 
  Github, 
  Heart, 
  Coffee, 
  Mail, 
  Globe, 
  Code2,
  Sparkles,
  Shield,
  Zap,
  Users,
  BookOpen,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function InfoPage() {
  const { t } = useTranslation();
  const version = useVersion();

  const features = [
    { icon: Sparkles, title: t('infoPage.aiTranslation'), desc: t('infoPage.aiTranslationDesc') },
    { icon: Zap, title: t('infoPage.multiEngine'), desc: t('infoPage.multiEngineDesc') },
    { icon: Shield, title: t('infoPage.bepinex'), desc: t('infoPage.bepinexDesc') },
    { icon: Users, title: t('infoPage.community'), desc: t('infoPage.communityDesc') },
  ];

  const links = [
    { icon: Github, label: 'GitHub', href: 'https://github.com/rouges78/GameStringer', color: 'text-gray-400' },
    { icon: Coffee, label: 'Ko-fi', href: 'https://ko-fi.com/gamestringer', color: 'text-yellow-500' },
    { icon: Heart, label: 'Sponsor', href: 'https://github.com/sponsors/rouges78', color: 'text-pink-500' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Info className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('infoPage.title')}</h1>
              <p className="text-white/70 text-xs">{t('infoPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-black/40 text-white border-white/30 text-xs font-medium">v{version?.version || '1.0.4'}</Badge>
            <Badge className="bg-black/40 text-emerald-300 border-emerald-400/50 text-xs font-medium">{t('infoPage.openSource')}</Badge>
            <Badge className="bg-black/40 text-white border-white/30 text-xs font-medium">MIT</Badge>
          </div>
        </div>
      </div>

      {/* About */}
      <Card className="p-3">
        <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {t('infoPage.information')}
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>{t('infoPage.title')}</strong> - {t('infoPage.description')}
          {t('infoPage.developedBy')} <strong>rouges78</strong>.
        </p>
      </Card>

      {/* Features */}
      <Card className="p-3">
        <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          {t('infoPage.features')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
              <f.icon className="h-4 w-4 text-orange-400" />
              <div>
                <p className="font-medium text-xs">{f.title}</p>
                <p className="text-2xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Version + Links */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            {t('infoPage.version')}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">{t('infoPage.ver')}</span> <span className="font-mono">{version?.version || '1.0.4'}</span></div>
            <div><span className="text-muted-foreground">{t('infoPage.build')}</span> <span className="font-mono">{version?.buildInfo?.build || '---'}</span></div>
            <div><span className="text-muted-foreground">{t('infoPage.data')}</span> <span className="font-mono">{version?.buildInfo?.date || '---'}</span></div>
            <div><span className="text-muted-foreground">{t('infoPage.framework')}</span> <span className="font-mono">{t('infoPage.tauri2')}</span></div>
          </div>
        </Card>

        <Card className="p-3">
          <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t('infoPage.links')}
          </p>
          <div className="flex flex-wrap gap-2">
            {links.map((link, i) => (
              <Button key={i} variant="outline" size="xs" className="text-xs gap-1.5" asChild>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  <link.icon className={`h-3.5 w-3.5 ${link.color}`} />
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Changelog Timeline */}
      {version?.allVersions && version.allVersions.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-orange-400 mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            What&apos;s New
          </p>
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-500/50 via-amber-500/30 to-transparent" />
            {version.allVersions.map((v: { version: string; date: string; type: string; changes: string[] }, i: number) => (
              <div key={v.version} className="relative pl-6 pb-3">
                {/* Timeline dot */}
                <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                  v.type === 'major' ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/30' :
                  v.type === 'minor' ? 'bg-amber-500 border-amber-400' :
                  'bg-slate-500 border-slate-400'
                }`} />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold font-mono">{v.version}</span>
                  <Badge variant="outline" className={`text-2xs h-3.5 px-1 ${
                    v.type === 'major' ? 'text-orange-400 border-orange-500/30' :
                    v.type === 'minor' ? 'text-amber-400 border-amber-500/30' :
                    'text-slate-400 border-slate-500/30'
                  }`}>{v.type}</Badge>
                  <span className="text-micro text-muted-foreground/50">{new Date(v.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <ul className="space-y-0.5">
                  {v.changes.map((c: string, ci: number) => (
                    <li key={ci} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-orange-400/60 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Special Thanks */}
      <Card className="p-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5" />
          {t('infoPage.specialThanks')}
        </p>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">CLODO</p>
            <p className="text-xs text-muted-foreground">
              {t('infoPage.clodoThanks')}
            </p>
          </div>
        </div>
      </Card>

      {/* Credits */}
      <Card className="p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/20">
        <div className="flex items-center justify-between">
          <p className="text-sm">{t('infoPage.thanks')} 🎮</p>
          <div className="flex gap-2">
            <Button variant="outline" size="xs" className="text-xs" asChild>
              <a href="https://ko-fi.com/gamestringer" target="_blank"><Coffee className="h-3.5 w-3.5 mr-1 text-yellow-500" />{t('infoPage.kofi')}</a>
            </Button>
            <Button variant="outline" size="xs" className="text-xs" asChild>
              <a href="https://github.com/rouges78/GameStringer" target="_blank"><Github className="h-3.5 w-3.5 mr-1" />{t('infoPage.github')}</a>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
