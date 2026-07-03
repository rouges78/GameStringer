# GameStringer v1.12.0 — патч: русская локализация + кастомные API

Этот архив содержит изменения для вашего форка `caruno-git/GameStringer` (на базе коммита `37bd361`, v1.11.1).

## Что внутри

### 1. 🇷🇺 Полноценный русский перевод
Аудит репозитория (`translation-audit-report.json`) показал **250 захардкоженных строк на английском/итальянском в ~70 компонентах**, которые не проходят через систему переводов `t()` — именно поэтому «огромное количество мест не переведено».

- `lib/i18n/hardcoded-ru.json` — словарь русских переводов для всех этих строк (заголовки, кнопки, плейсхолдеры, всплывающие уведомления).
- `components/i18n/runtime-ru-fix.tsx` — модуль, который при выбранном русском языке автоматически переводит эти строки в интерфейсе (тексты, `placeholder`, `title`, `aria-label`), включая toast-уведомления. Не трогает исходники 70 компонентов — безопасно и не ломает другие языки.
- Скрипт дополнительно генерирует `i18n-missing-ru-report.json` — список ключей, которые есть в `en.json`, но отсутствуют в `ru.json` (если такие есть — пришлите список, переведу).
- Хотите пополнить словарь — просто добавьте пары «Оригинал»: «Перевод» в `lib/i18n/hardcoded-ru.json`.

### 2. 🔌 Кастомные API-провайдеры
- `lib/ai/custom-providers.ts` — поддержка своих endpoint'ов двух форматов:
  - **OpenAI-совместимый**: `POST {baseUrl}/chat/completions`, заголовок `Authorization: Bearer <ключ>` (OpenAI, OpenRouter, DeepSeek, Groq, Together, vLLM, LM Studio, llama.cpp и т.д.);
  - **Anthropic / Claude (формат Claude Code)**: `POST {baseUrl}/v1/messages`, заголовки `x-api-key` + `anthropic-version: 2023-06-01` (Anthropic API, DeepSeek `/anthropic` и другие Claude-совместимые endpoint'ы).
- `components/settings/custom-api-settings.tsx` — блок в настройках: название, формат, Base URL, API-ключ, модель, кнопка «Проверить» (тестовый запрос). Ключи хранятся локально (localStorage).
- Скрипт встраивает провайдеры в `lib/ai/ai-translation-service.ts`: они появляются в списке AI-провайдеров со значком 🔌 и используются для перевода с приоритетом.

### 3. Версия
1.11.1 → **1.12.0** (package.json, src-tauri/tauri.conf.json, lib/version.ts, Cargo.toml) + `CHANGELOG-1.12.0.md`.

## Как применить

1. Распакуйте архив **в корень репозитория** (файлы лягут по своим папкам, ничего не перезапишется — все файлы новые).
2. Из корня репозитория выполните:
   ```bash
   node scripts/apply-gamestringer-patch.mjs
   ```
   Скрипт напечатает отчёт: что применено, что пропущено. Повторный запуск безопасен.
3. Проверьте изменения: `git diff`.
4. Соберите и проверьте:
   ```bash
   npm install
   npm run tauri dev   # или npm run tauri build
   ```
5. Закоммитьте: `git add -A && git commit -m "v1.12.0: full RU localization + custom API providers"`.

## Если автомонтаж не сработал (см. предупреждения скрипта)

- **Настройки**: в `app/settings/page.tsx` добавьте:
  ```tsx
  import CustomApiSettings from '@/components/settings/custom-api-settings';
  // ...в разделе настроек AI/API:
  <CustomApiSettings />
  ```
- **Русификатор**: в `app/layout.tsx` добавьте:
  ```tsx
  import RuntimeRuFix from '@/components/i18n/runtime-ru-fix';
  // ...рядом с {children}:
  <RuntimeRuFix />
  ```

## Как пользоваться кастомным API

1. Настройки → блок «Кастомные API-провайдеры».
2. Пример OpenAI-формата (OpenRouter): Base URL `https://openrouter.ai/api/v1`, ключ `sk-or-...`, модель `openai/gpt-4o-mini`.
3. Пример Claude-формата: Base URL `https://api.anthropic.com`, ключ `sk-ant-...`, модель `claude-sonnet-4-5`. Для DeepSeek в формате Claude: Base URL `https://api.deepseek.com/anthropic`, модель `deepseek-chat`.
4. Нажмите «Проверить» — при успехе провайдер готов, выбирайте его в списке AI-провайдеров перевода (значок 🔌).

## Ограничения
- Runtime-русификатор переводит по словарю: если в интерфейсе останутся непереведённые места — добавьте их в `lib/i18n/hardcoded-ru.json` или пришлите мне список.
- При переключении с русского на другой язык уже переведённые надписи вернутся к оригиналу после перерисовки страницы (или перезапуска).
