'use client';

/**
 * Endpoint personalizzati per i provider AI.
 *
 * Nasce da una segnalazione del 30/06/2026: «non riesco a salvare le impostazioni API
 * personalizzate di DeepSeek». Non era un bug — l'indirizzo non era configurabile per
 * nessun provider, solo la chiave. Serve a chi sta dietro un proxy aziendale, a chi
 * non raggiunge il dominio ufficiale dal proprio paese, e a chi usa un gateway
 * compatibile OpenAI.
 *
 * Un campo vuoto significa «usa l'indirizzo ufficiale»: nessun comportamento cambia
 * per chi non tocca nulla.
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Server, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { DEFAULT_BASES, normalizeBaseUrl, type ProviderId } from '@/lib/ai/provider-endpoints';
import { clientLogger } from '@/lib/client-logger';

const SETTINGS_KEY = 'gameStringerSettings';
const PROVIDERS = Object.keys(DEFAULT_BASES) as ProviderId[];

const LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  groq: 'Groq',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  cohere: 'Cohere',
  together: 'Together',
  fireworks: 'Fireworks',
  openrouter: 'OpenRouter',
  cerebras: 'Cerebras',
  gemini: 'Gemini',
};

function readEndpoints(): Partial<Record<ProviderId, string>> {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const e = s?.translation?.endpoints;
    return e && typeof e === 'object' ? e : {};
  } catch {
    return {};
  }
}

function writeEndpoints(next: Partial<Record<ProviderId, string>>) {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    s.translation = s.translation || {};
    // le voci vuote spariscono: «vuoto» deve voler dire «default», non «stringa vuota»
    const pulito: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) if (v && v.trim()) pulito[k] = v.trim();
    s.translation.endpoints = pulito;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    clientLogger.error('[endpoints] salvataggio fallito', String(e));
  }
}

export function CustomEndpointsCard() {
  const { t } = useTranslation();
  const [values, setValues] = useState<Partial<Record<ProviderId, string>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValues(readEndpoints());
    setLoaded(true);
  }, []);

  const update = (p: ProviderId, v: string) => {
    const next = { ...values, [p]: v };
    setValues(next);
    writeEndpoints(next);
  };

  const reset = (p: ProviderId) => update(p, '');

  const attivi = PROVIDERS.filter((p) => (values[p] || '').trim()).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-sky-400" />
            <CardTitle className="text-base">{t('customEndpoints.title')}</CardTitle>
          </div>
          {attivi > 0 && (
            <Badge variant="secondary">{t('customEndpoints.activeCount').replace('{n}', String(attivi))}</Badge>
          )}
        </div>
        <CardDescription>{t('customEndpoints.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {loaded &&
          PROVIDERS.map((p) => {
            const raw = values[p] || '';
            const invalido = raw.trim().length > 0 && normalizeBaseUrl(raw) === null;
            return (
              <div key={p} className="space-y-1">
                <Label htmlFor={`endpoint-${p}`} className="text-xs">
                  {LABELS[p]}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`endpoint-${p}`}
                    value={raw}
                    onChange={(e) => update(p, e.target.value)}
                    placeholder={DEFAULT_BASES[p]}
                    className={`font-mono text-xs ${invalido ? 'border-amber-500' : ''}`}
                    aria-invalid={invalido}
                  />
                  {raw.trim() && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => reset(p)}
                      aria-label={t('customEndpoints.reset')}
                      title={t('customEndpoints.reset')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {invalido && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('customEndpoints.invalid')}
                  </p>
                )}
              </div>
            );
          })}

        <p className="text-xs text-muted-foreground pt-1">{t('customEndpoints.hint')}</p>
      </CardContent>
    </Card>
  );
}

export default CustomEndpointsCard;
