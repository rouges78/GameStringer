/**
 * 🔌 Custom API Providers
 *
 * Пользовательские API-endpoint'ы для перевода:
 *  - OpenAI-совместимый формат: POST {baseUrl}/chat/completions, заголовок `Authorization: Bearer <key>`
 *    (подходит для OpenAI, OpenRouter, DeepSeek, Groq, Together, LM Studio, vLLM, llama.cpp server и т.д.)
 *  - Anthropic / Claude формат: POST {baseUrl}/v1/messages, заголовки `x-api-key` + `anthropic-version`
 *    (подходит для Anthropic API и любых Claude-Code-совместимых endpoint'ов, например DeepSeek /anthropic)
 *
 * Провайдеры хранятся в localStorage (ключ gs_custom_api_providers) и подхватываются
 * сервисом ai-translation-service автоматически (id начинается с "custom-").
 */

export type CustomApiFormat = 'openai' | 'anthropic';

export interface CustomApiProvider {
  id: string; // всегда начинается с "custom-"
  name: string;
  format: CustomApiFormat;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
  temperature?: number;
  maxTokens?: number;
  anthropicVersion?: string; // по умолчанию 2023-06-01
  extraHeaders?: Record<string, string>;
}

export interface CustomChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CustomChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CustomChatResult {
  text: string;
  tokensUsed: number;
  raw?: unknown;
}

const STORAGE_KEY = 'gs_custom_api_providers';

export function isCustomProviderId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('custom-');
}

export function loadCustomProviders(): CustomApiProvider[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(p => p && p.id && p.baseUrl) : [];
  } catch {
    return [];
  }
}

export function saveCustomProviders(providers: CustomApiProvider[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
    // уведомляем открытые компоненты об изменении списка
    window.dispatchEvent(new CustomEvent('gs-custom-providers-changed'));
  } catch {
    // ignore quota errors
  }
}

export function getCustomProvider(id: string): CustomApiProvider | null {
  return loadCustomProviders().find(p => p.id === id) || null;
}

export function upsertCustomProvider(provider: CustomApiProvider): CustomApiProvider[] {
  const list = loadCustomProviders();
  const idx = list.findIndex(p => p.id === provider.id);
  if (idx >= 0) list[idx] = provider; else list.push(provider);
  saveCustomProviders(list);
  return list;
}

export function removeCustomProvider(id: string): CustomApiProvider[] {
  const list = loadCustomProviders().filter(p => p.id !== id);
  saveCustomProviders(list);
  return list;
}

export function makeCustomProviderId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'api';
  return `custom-${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Нормализация URL для OpenAI-совместимого формата */
export function buildOpenAiChatUrl(baseUrl: string): string {
  let url = (baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(url)) return url;
  return `${url}/chat/completions`;
}

/** Нормализация URL для Anthropic/Claude формата */
export function buildAnthropicMessagesUrl(baseUrl: string): string {
  let url = (baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/messages$/.test(url)) return url;
  if (/\/v1$/.test(url)) return `${url}/messages`;
  return `${url}/v1/messages`;
}

/**
 * Универсальный chat-запрос к кастомному провайдеру.
 */
export async function customChatCompletion(
  provider: CustomApiProvider,
  messages: CustomChatMessage[],
  options: CustomChatOptions = {}
): Promise<CustomChatResult> {
  const temperature = options.temperature ?? provider.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? provider.maxTokens ?? 1024;

  if (provider.format === 'anthropic') {
    // ---- Anthropic Messages API (формат Claude / Claude Code) ----
    const url = buildAnthropicMessagesUrl(provider.baseUrl);
    const systemPrompt = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const response = await fetch(url, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': provider.anthropicVersion || '2023-06-01',
        // необходимо для запросов из WebView/браузера напрямую к api.anthropic.com
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(provider.extraHeaders || {})
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: chatMessages.length > 0 ? chatMessages : [{ role: 'user', content: ' ' }]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Custom Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text || '').join('')
      : '';
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    return { text: text.trim(), tokensUsed, raw: data };
  }

  // ---- OpenAI-совместимый Chat Completions API ----
  const url = buildOpenAiChatUrl(provider.baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      ...(provider.extraHeaders || {})
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Custom OpenAI-compatible API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const tokensUsed = data.usage?.total_tokens || 0;
  return { text, tokensUsed, raw: data };
}

/**
 * Быстрая проверка соединения с кастомным провайдером.
 */
export async function testCustomProvider(
  provider: CustomApiProvider
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const result = await customChatCompletion(
      provider,
      [{ role: 'user', content: 'Reply with exactly: OK' }],
      { maxTokens: 16, temperature: 0 }
    );
    return {
      ok: true,
      message: result.text ? `Ответ модели: "${result.text.slice(0, 80)}"` : 'Соединение установлено',
      latencyMs: Date.now() - start
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - start
    };
  }
}
