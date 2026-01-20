'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Gamepad2,
  Globe,
  Brain,
  Settings,
  ChevronRight,
  ChevronLeft,
  Check,
  Rocket,
  Library,
  Languages,
  Users,
  Cpu,
  Download,
  Image as ImageIcon,
  Scan,
  Wand2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  content: React.ReactNode;
}

const ONBOARDING_KEY = 'gamestringer_onboarding_completed';
const ONBOARDING_VERSION = '2';

export function OnboardingWizard() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState({
    scanLibraryOnStart: true,
    enableNotifications: true,
    preferredLanguage: 'it',
    enableAI: true,
    theme: 'dark'
  });

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = () => {
    if (typeof window === 'undefined') return;
    
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (completed !== ONBOARDING_VERSION) {
      setIsOpen(true);
    }
  };

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
      localStorage.setItem('gamestringer_preferences', JSON.stringify(preferences));
    }
    setIsOpen(false);
  };

  const skipOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    }
    setIsOpen(false);
  };

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: t('onboarding.welcome.title'),
      description: t('onboarding.welcome.description'),
      icon: Rocket,
      color: 'text-purple-500',
      content: (
        <div className="space-y-6 text-center">
          <div className="w-28 h-28 mx-auto">
            <Image 
              src="/logo.png" 
              alt="GameStringer" 
              width={112} 
              height={112} 
              className="drop-shadow-2xl"
              priority
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('onboarding.welcome.title')}</h2>
            <p className="text-muted-foreground">
              {t('onboarding.welcome.content')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <Brain className="h-8 w-8 mx-auto mb-2 text-violet-500" />
              <p className="text-sm font-medium">{t('onboarding.tools.aiTranslator')}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Users className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-sm font-medium">{t('onboarding.community.title')}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-teal-500" />
              <p className="text-sm font-medium">{t('onboarding.tools.multiLlm')}</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'library',
      title: t('onboarding.library.title'),
      description: t('onboarding.library.description'),
      icon: Library,
      color: 'text-teal-500',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-teal-500/10 rounded-xl flex items-center justify-center">
              <Gamepad2 className="h-8 w-8 text-teal-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('onboarding.library.title')}</h3>
              <p className="text-muted-foreground">{t('onboarding.library.subtitle')}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm">{t('onboarding.library.detectInfo')}</p>
            <div className="grid grid-cols-2 gap-2">
              {['Steam', 'Epic Games', 'GOG Galaxy', 'Origin', 'Ubisoft Connect', 'Battle.net', 'itch.io'].map(store => (
                <div key={store} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{store}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <Label className="font-medium">{t('onboarding.library.scanOnStartup')}</Label>
              <p className="text-xs text-muted-foreground">{t('onboarding.library.scanOnStartupDesc')}</p>
            </div>
            <Switch
              checked={preferences.scanLibraryOnStart}
              onCheckedChange={(checked) => setPreferences(p => ({ ...p, scanLibraryOnStart: checked }))}
            />
          </div>
        </div>
      )
    },
    {
      id: 'tools',
      title: t('onboarding.tools.title'),
      description: t('onboarding.tools.description'),
      icon: Languages,
      color: 'text-violet-500',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-violet-500/10 rounded-xl flex items-center justify-center">
              <Languages className="h-8 w-8 text-violet-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('onboarding.tools.title')}</h3>
              <p className="text-muted-foreground">{t('onboarding.tools.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { icon: Sparkles, name: t('onboarding.tools.aiTranslator'), desc: t('onboarding.tools.aiTranslatorDesc'), color: 'text-purple-500' },
              { icon: Brain, name: t('onboarding.tools.multiLlm'), desc: t('onboarding.tools.multiLlmDesc'), color: 'text-indigo-500' },
              { icon: Scan, name: t('onboarding.tools.ocrTranslator'), desc: t('onboarding.tools.ocrTranslatorDesc'), color: 'text-blue-500' },
              { icon: Wand2, name: t('onboarding.tools.unityPatcher'), desc: t('onboarding.tools.unityPatcherDesc'), color: 'text-green-500' },
              { icon: Cpu, name: t('onboarding.tools.ueTranslator'), desc: t('onboarding.tools.ueTranslatorDesc'), color: 'text-cyan-500' },
              { icon: Gamepad2, name: t('onboarding.tools.telltalePatcher'), desc: t('onboarding.tools.telltalePatcherDesc'), color: 'text-amber-500' },
              { icon: Download, name: t('onboarding.tools.nexusMods'), desc: t('onboarding.tools.nexusModsDesc'), color: 'text-orange-500' },
              { icon: ImageIcon, name: t('onboarding.tools.visualEditor'), desc: t('onboarding.tools.visualEditorDesc'), color: 'text-pink-500' },
            ].map(tool => (
              <div key={tool.name} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                <tool.icon className={cn("h-4 w-4", tool.color)} />
                <div className="flex-1">
                  <p className="text-xs font-medium">{tool.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'ai',
      title: t('onboarding.ai.title'),
      description: t('onboarding.ai.description'),
      icon: Brain,
      color: 'text-purple-500',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('onboarding.ai.title')}</h3>
              <p className="text-muted-foreground">{t('onboarding.ai.subtitle')}</p>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              {t('onboarding.ai.ollamaRecommended')}
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              {t('onboarding.ai.ollamaDesc')} <span className="font-mono text-purple-400">ollama.ai</span> {t('onboarding.ai.ollamaCommand')}
            </p>
            <code className="block p-2 bg-black/30 rounded text-sm font-mono text-green-400">
              ollama run llama3.2
            </code>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t('onboarding.ai.supportedProviders')}</p>
            <div className="grid grid-cols-2 gap-2">
              {['Ollama (Local)', 'LM Studio', 'OpenAI', 'Claude', 'Gemini', 'DeepL'].map(provider => (
                <Badge key={provider} variant="outline" className="justify-center py-2">
                  {provider}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <Label className="font-medium">{t('onboarding.ai.enableAi')}</Label>
              <p className="text-xs text-muted-foreground">{t('onboarding.ai.enableAiDesc')}</p>
            </div>
            <Switch
              checked={preferences.enableAI}
              onCheckedChange={(checked) => setPreferences(p => ({ ...p, enableAI: checked }))}
            />
          </div>
        </div>
      )
    },
    {
      id: 'community',
      title: t('onboarding.community.title'),
      description: t('onboarding.community.description'),
      icon: Users,
      color: 'text-orange-500',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <Globe className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('onboarding.community.title')}</h3>
              <p className="text-muted-foreground">{t('onboarding.community.subtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-orange-500/20">
              <CardContent className="p-4 text-center">
                <Download className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="font-medium">{t('onboarding.community.downloadPack')}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.community.downloadPackDesc')}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="font-medium">{t('onboarding.community.contribute')}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.community.contributeDesc')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2">Nexus Mods Integration</h4>
            <p className="text-sm text-muted-foreground">
              {t('onboarding.community.nexusInfo')}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'ready',
      title: t('onboarding.ready.title'),
      description: t('onboarding.ready.description'),
      icon: Rocket,
      color: 'text-green-500',
      content: (
        <div className="space-y-6 text-center">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
            <Check className="h-12 w-12 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('onboarding.ready.subtitle')}</h2>
            <p className="text-muted-foreground">
              {t('onboarding.ready.content')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 bg-teal-500/10 rounded-lg border border-teal-500/20">
              <Gamepad2 className="h-6 w-6 mx-auto mb-2 text-teal-500" />
              <p className="text-sm font-medium">{t('onboarding.ready.exploreLibrary')}</p>
              <p className="text-xs text-muted-foreground">{t('onboarding.ready.exploreLibraryDesc')}</p>
            </div>
            <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/20">
              <Sparkles className="h-6 w-6 mx-auto mb-2 text-violet-500" />
              <p className="text-sm font-medium">{t('onboarding.ready.startTranslating')}</p>
              <p className="text-xs text-muted-foreground">{t('onboarding.ready.startTranslatingDesc')}</p>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-xs text-muted-foreground">
              {t('onboarding.ready.guideNote')}
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{t('onboarding.dialogTitle')}</DialogTitle>
        </VisuallyHidden>
        {/* Progress */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <currentStepData.icon className={cn("h-5 w-5", currentStepData.color)} />
            <span className="text-sm font-medium">{currentStepData.title}</span>
          </div>
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1">
            {t('onboarding.step').replace('{current}', String(currentStep + 1)).replace('{total}', String(steps.length))}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStepData.content}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-6 pt-0">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('onboarding.back')}
          </Button>

          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <Button onClick={nextStep}>
            {currentStep === steps.length - 1 ? (
              <>
                {t('onboarding.start')}
                <Rocket className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                {t('onboarding.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingWizard;



