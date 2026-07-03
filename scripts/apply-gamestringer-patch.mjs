#!/usr/bin/env node
/**
 * GameStringer v1.12.0 patch installer
 *
 * Запускать из корня репозитория ПОСЛЕ распаковки архива:
 *   node scripts/apply-gamestringer-patch.mjs
 *
 * Что делает:
 *  1. Встраивает кастомные API-провайдеры в lib/ai/ai-translation-service.ts
 *  2. Монтирует <CustomApiSettings /> в app/settings/page.tsx (эвристика)
 *  3. Монтирует <RuntimeRuFix /> в app/layout.tsx (эвристика)
 *  4. Вливает lib/i18n/additions/*.json в lib/i18n/locales/*.json
 *  5. Поднимает версию 1.11.1 -> 1.12.0 (package.json, tauri.conf.json, lib/version.ts, Cargo.toml)
 *  6. Генерирует отчёт о ключах, отсутствующих в ru.json относительно en.json
 *
 * Скрипт идемпотентен: повторный запуск ничего не ломает.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ok = [];
const warn = [];

function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
}
// Файлы репозитория используют CRLF — приводим якоря к EOL файла
function eolOf(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}
function withEol(text, eol) {
  return text.replace(/\r?\n/g, eol);
}

function patch(rel, marker, edits) {
  const content = read(rel);
  if (content === null) {
    warn.push(`${rel}: файл не найден — пропущено`);
    return;
  }
  if (marker && content.includes(marker)) {
    ok.push(`${rel}: уже пропатчен — пропущено`);
    return;
  }
  const eol = eolOf(content);
  let updated = content;
  let applied = 0;
  for (const edit of edits) {
    const find = withEol(edit.find, eol);
    if (!updated.includes(find)) {
      warn.push(`${rel}: якорь не найден (${edit.name}) — правка пропущена`);
      continue;
    }
    const replacement = withEol(edit.replace, eol);
    updated = updated.split(find).join(replacement);
    applied++;
  }
  if (applied > 0) {
    write(rel, updated);
    ok.push(`${rel}: применено правок — ${applied}/${edits.length}`);
  }
}

/* ------------------------------------------------------------------ */
/* 1. lib/ai/ai-translation-service.ts — кастомные API-провайдеры     */
/* ------------------------------------------------------------------ */

const SERVICE = 'lib/ai/ai-translation-service.ts';

patch(SERVICE, "from './custom-providers'", [
  {
    name: 'import custom-providers',
    find: "import { clientLogger } from '@/lib/client-logger';",
    replace:
      "import { clientLogger } from '@/lib/client-logger';\n" +
      "import {\n" +
      "  loadCustomProviders,\n" +
      "  isCustomProviderId,\n" +
      "  getCustomProvider,\n" +
      "  customChatCompletion\n" +
      "} from './custom-providers';"
  },
  {
    name: 'merge custom providers into getAvailableProviders',
    find: '    return this.providers;',
    replace:
      '    // \u{1F50C} Пользовательские API-endpoint\u2019ы (OpenAI-compatible / Anthropic)\n' +
      '    const customProviders: AIProvider[] = loadCustomProviders().map((p) => ({\n' +
      '      id: p.id,\n' +
      '      name: `\u{1F50C} ${p.name}`,\n' +
      "      type: 'cloud',\n" +
      '      baseUrl: p.baseUrl,\n' +
      '      models: p.models && p.models.length > 0 ? p.models : [p.model],\n' +
      '      isAvailable: true\n' +
      '    }));\n' +
      '    return [...this.providers, ...customProviders];'
  },
  {
    name: 'add translateWithCustomApi method',
    find: '  /**\n   * Traduzione principale - seleziona automaticamente il provider\n   */',
    replace:
      '  /**\n' +
      '   * \u{1F50C} Traduzione con provider API personalizzato (OpenAI-compatible / Anthropic)\n' +
      '   */\n' +
      '  async translateWithCustomApi(request: AITranslationRequest): Promise<AITranslationResult> {\n' +
      '    const startTime = Date.now();\n' +
      '    const provider = getCustomProvider(this.currentProvider);\n' +
      '    if (!provider) {\n' +
      '      throw new Error(`Custom API provider not found: ${this.currentProvider}`);\n' +
      '    }\n' +
      '    const model = provider.models?.includes(this.currentModel) ? this.currentModel : provider.model;\n' +
      '    const systemPrompt = this.buildSystemPrompt(request.context);\n' +
      '    const userPrompt = this.buildUserPrompt(request);\n' +
      '    const result = await customChatCompletion(\n' +
      '      { ...provider, model },\n' +
      '      [\n' +
      "        { role: 'system', content: systemPrompt },\n" +
      "        { role: 'user', content: userPrompt }\n" +
      '      ],\n' +
      '      { temperature: 0.3, maxTokens: provider.maxTokens ?? 1000 }\n' +
      '    );\n' +
      '    const translation = result.text;\n' +
      '    const alternatives: string[] = [];\n' +
      "    if (request.alternatives && translation.includes('|||')) {\n" +
      "      const parts = translation.split('|||').map((p: string) => p.trim());\n" +
      '      alternatives.push(...parts.slice(1));\n' +
      '    }\n' +
      '    return {\n' +
      "      translation: alternatives.length > 0 ? translation.split('|||')[0].trim() : translation,\n" +
      '      alternatives,\n' +
      '      confidence: 0.9,\n' +
      '      tokensUsed: result.tokensUsed,\n' +
      '      provider: provider.id,\n' +
      '      model,\n' +
      '      processingTime: Date.now() - startTime\n' +
      '    };\n' +
      '  }\n' +
      '\n' +
      '  /**\n   * Traduzione principale - seleziona automaticamente il provider\n   */'
  },
  {
    name: 'dispatch custom providers in translate()',
    find:
      '  async translate(request: AITranslationRequest): Promise<AITranslationResult> {\n' +
      '    // Verifica disponibilit\u00e0 provider locali',
    replace:
      '  async translate(request: AITranslationRequest): Promise<AITranslationResult> {\n' +
      '    // \u{1F50C} Кастомные API-провайдеры имеют приоритет\n' +
      '    if (isCustomProviderId(this.currentProvider)) {\n' +
      '      return this.translateWithCustomApi(request);\n' +
      '    }\n' +
      '\n' +
      '    // Verifica disponibilit\u00e0 provider locali'
  }
]);

/* ------------------------------------------------------------------ */
/* 2. app/settings/page.tsx — монтируем блок настроек                 */
/* ------------------------------------------------------------------ */

const SETTINGS = 'app/settings/page.tsx';
const settingsContent = read(SETTINGS);
if (settingsContent === null) {
  warn.push(`${SETTINGS}: файл не найден`);
} else if (settingsContent.includes('CustomApiSettings')) {
  ok.push(`${SETTINGS}: уже пропатчен — пропущено`);
} else {
  const eol = eolOf(settingsContent);
  let updated = settingsContent;
  let mounted = false;

  // import после первой строки import
  const importLine = `import CustomApiSettings from '@/components/settings/custom-api-settings';${eol}`;
  const firstImport = updated.match(/^import .*$/m);
  if (firstImport) {
    updated = updated.replace(firstImport[0], firstImport[0] + eol + importLine.trimEnd());
  }

  // монтируем рядом с блоком Custom Prompt, если он есть на странице
  const mountRegex = /<CustomPromptSettings[^>]*\/>/;
  const m = updated.match(mountRegex);
  if (m) {
    updated = updated.replace(m[0], `${m[0]}${eol}            <CustomApiSettings />`);
    mounted = true;
  }

  write(SETTINGS, updated);
  if (mounted) {
    ok.push(`${SETTINGS}: import + <CustomApiSettings /> добавлены`);
  } else {
    ok.push(`${SETTINGS}: import добавлен`);
    warn.push(
      `${SETTINGS}: не нашёл место для автомонтажа — добавьте <CustomApiSettings /> вручную в раздел AI/API настроек`
    );
  }
}

/* ------------------------------------------------------------------ */
/* 3. app/layout.tsx — монтируем RuntimeRuFix                          */
/* ------------------------------------------------------------------ */

const LAYOUT = 'app/layout.tsx';
const layoutContent = read(LAYOUT);
if (layoutContent === null) {
  warn.push(`${LAYOUT}: файл не найден`);
} else if (layoutContent.includes('RuntimeRuFix')) {
  ok.push(`${LAYOUT}: уже пропатчен — пропущено`);
} else {
  const eol = eolOf(layoutContent);
  let updated = layoutContent;
  const firstImport = updated.match(/^import .*$/m);
  if (firstImport) {
    updated = updated.replace(
      firstImport[0],
      firstImport[0] + eol + `import RuntimeRuFix from '@/components/i18n/runtime-ru-fix';`
    );
  }
  if (updated.includes('{children}')) {
    updated = updated.replace('{children}', `<RuntimeRuFix />${eol}        {children}`);
    write(LAYOUT, updated);
    ok.push(`${LAYOUT}: import + <RuntimeRuFix /> добавлены`);
  } else {
    write(LAYOUT, updated);
    warn.push(`${LAYOUT}: добавьте <RuntimeRuFix /> вручную рядом с {children}`);
  }
}

/* ------------------------------------------------------------------ */
/* 4. Вливаем i18n-дополнения в локали                                */
/* ------------------------------------------------------------------ */

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

for (const lang of ['ru', 'en']) {
  const addRel = `lib/i18n/additions/${lang}.json`;
  const locRel = `lib/i18n/locales/${lang}.json`;
  const addRaw = read(addRel);
  const locRaw = read(locRel);
  if (!addRaw || !locRaw) {
    warn.push(`i18n merge (${lang}): файлы не найдены — пропущено`);
    continue;
  }
  try {
    const locale = JSON.parse(locRaw);
    const additions = JSON.parse(addRaw);
    deepMerge(locale, additions);
    write(locRel, JSON.stringify(locale, null, 2) + '\n');
    ok.push(`${locRel}: ключи customApi.* добавлены`);
  } catch (e) {
    warn.push(`i18n merge (${lang}): ${e.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* 5. Версия 1.11.1 -> 1.12.0                                          */
/* ------------------------------------------------------------------ */

const OLD_V = '1.11.1';
const NEW_V = '1.12.0';
for (const rel of ['package.json', 'src-tauri/tauri.conf.json', 'lib/version.ts', 'src-tauri/Cargo.toml']) {
  const content = read(rel);
  if (content === null) {
    warn.push(`${rel}: файл не найден — версия не обновлена`);
    continue;
  }
  if (!content.includes(OLD_V)) {
    ok.push(`${rel}: версия ${OLD_V} не найдена (возможно, уже обновлена)`);
    continue;
  }
  write(rel, content.split(OLD_V).join(NEW_V));
  ok.push(`${rel}: версия ${OLD_V} -> ${NEW_V}`);
}

/* ------------------------------------------------------------------ */
/* 6. Аудит: ключи en.json, отсутствующие в ru.json                  */
/* ------------------------------------------------------------------ */

function flattenKeys(obj, prefix = '', out = []) {
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      flattenKeys(obj[key], full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

try {
  const en = JSON.parse(read('lib/i18n/locales/en.json') || '{}');
  const ru = JSON.parse(read('lib/i18n/locales/ru.json') || '{}');
  const ruKeys = new Set(flattenKeys(ru));
  const missing = flattenKeys(en).filter(k => !ruKeys.has(k));
  write('i18n-missing-ru-report.json', JSON.stringify(missing, null, 2) + '\n');
  ok.push(`Аудит ru.json: отсутствует ${missing.length} ключей (см. i18n-missing-ru-report.json)`);
} catch (e) {
  warn.push(`Аудит ru.json не выполнен: ${e.message}`);
}

/* ------------------------------------------------------------------ */

console.log('\n=== GameStringer v1.12.0 patch ===\n');
for (const line of ok) console.log('  \u2705 ' + line);
if (warn.length) {
  console.log('');
  for (const line of warn) console.log('  \u26A0\uFE0F  ' + line);
}
console.log('\nГотово. Проверьте изменения: git diff, затем соберите приложение.');
