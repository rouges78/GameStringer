'use client';

/**
 * 🔌 Custom API Settings
 * Блок настроек для подключения своих API-endpoint'ов (OpenAI-совместимый или Anthropic/Claude формат).
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plug, Plus, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import {
  type CustomApiProvider,
  type CustomApiFormat,
  loadCustomProviders,
  upsertCustomProvider,
  removeCustomProvider,
  makeCustomProviderId,
  testCustomProvider
} from '@/lib/ai/custom-providers';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string; latencyMs?: number };

const EMPTY_FORM = {
  name: '',
  format: 'openai' as CustomApiFormat,
  baseUrl: '',
  apiKey: '',
  model: ''
};

export function CustomApiSettings() {
  const { t } = useTranslation();
  // если ключ не найден в локализации — показываем запасной текст
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return !v || v === key ? fallback : v;
  };

  const [providers, setProviders] = useState<CustomApiProvider[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [tests, setTests] = useState<Record<string, TestState>>({});

  useEffect(() => {
    setProviders(loadCustomProviders());
    const onChange = () => setProviders(loadCustomProviders());
    window.addEventListener('gs-custom-providers-changed', onChange);
    return () => window.removeEventListener('gs-custom-providers-changed', onChange);
  }, []);

  const handleAdd = () => {
    setFormError('');
    if (!form.name.trim() || !form.baseUrl.trim() || !form.model.trim()) {
      setFormError(tr('customApi.errorRequired', 'Заполните название, Base URL и модель'));
      return;
    }
    const provider: CustomApiProvider = {
      id: makeCustomProviderId(form.name),
      name: form.name.trim(),
      format: form.format,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      models: [form.model.trim()]
    };
    setProviders(upsertCustomProvider(provider));
    setForm({ ...EMPTY_FORM });
  };

  const handleRemove = (id: string) => {
    setProviders(removeCustomProvider(id));
  };

  const handleTest = async (provider: CustomApiProvider) => {
    setTests(prev => ({ ...prev, [provider.id]: { status: 'testing' } }));
    const result = await testCustomProvider(provider);
    setTests(prev => ({
      ...prev,
      [provider.id]: {
        status: result.ok ? 'ok' : 'error',
        message: result.message,
        latencyMs: result.latencyMs
      }
    }));
  };

  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ' +
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          {tr('customApi.title', 'Кастомные API-провайдеры')}
        </CardTitle>
        <CardDescription>
          {tr(
            'customApi.description',
            'Подключите свой endpoint в формате OpenAI (/v1/chat/completions) или Anthropic/Claude (/v1/messages): OpenRouter, DeepSeek, Groq, vLLM, локальные серверы и др.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Список добавленных провайдеров */}
        {providers.length > 0 && (
          <div className="space-y-3">
            {providers.map(provider => {
              const test = tests[provider.id] || { status: 'idle' };
              return (
                <div key={provider.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{provider.name}</span>
                      <Badge variant="secondary">
                        {provider.format === 'openai'
                          ? tr('customApi.formatOpenai', 'OpenAI-совместимый')
                          : tr('customApi.formatAnthropic', 'Anthropic / Claude')}
                      </Badge>
                      <Badge variant="outline">{provider.model}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(provider)}
                        disabled={test.status === 'testing'}
                      >
                        {test.status === 'testing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          tr('customApi.test', 'Проверить')
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(provider.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground break-all">{provider.baseUrl}</div>
                  {test.status === 'ok' && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tr('customApi.testOk', 'Соединение успешно')} ({test.latencyMs} ms) — {test.message}
                    </div>
                  )}
                  {test.status === 'error' && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      {tr('customApi.testError', 'Ошибка соединения')}: {test.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Форма добавления */}
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{tr('customApi.name', 'Название')}</Label>
              <Input
                value={form.name}
                placeholder={tr('customApi.namePlaceholder', 'Например: Мой OpenRouter')}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('customApi.format', 'Формат API')}</Label>
              <select
                className={selectClass}
                value={form.format}
                onChange={e => setForm(f => ({ ...f, format: e.target.value as CustomApiFormat }))}
              >
                <option value="openai">{tr('customApi.formatOpenai', 'OpenAI-совместимый')} (/chat/completions)</option>
                <option value="anthropic">{tr('customApi.formatAnthropic', 'Anthropic / Claude')} (/v1/messages)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Base URL</Label>
            <Input
              value={form.baseUrl}
              placeholder={form.format === 'openai' ? 'https://api.example.com/v1' : 'https://api.anthropic.com'}
              onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{tr('customApi.apiKey', 'API-ключ')}</Label>
              <Input
                type="password"
                value={form.apiKey}
                placeholder="sk-..."
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('customApi.model', 'Модель')}</Label>
              <Input
                value={form.model}
                placeholder={form.format === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-5'}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              />
            </div>
          </div>
          {formError && <div className="text-xs text-destructive">{formError}</div>}
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {tr('customApi.add', 'Добавить провайдер')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {tr(
              'customApi.hint',
              'После добавления провайдер появится в списке AI-провайдеров перевода со значком 🔌. Ключи хранятся локально на вашем компьютере.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CustomApiSettings;
