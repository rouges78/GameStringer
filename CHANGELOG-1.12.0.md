# v1.12.0

## 🇷🇺 Локализация
- Полный русский перевод интерфейса: устранены 250 захардкоженных англ./итал. строк из ~70 компонентов (по данным translation-audit-report.json) через словарь `lib/i18n/hardcoded-ru.json` и runtime-модуль `components/i18n/runtime-ru-fix.tsx` (тексты, placeholder, title, aria-label, toast-уведомления).
- Новый отчёт `i18n-missing-ru-report.json`: ключи en.json, отсутствующие в ru.json.
- Новые ключи локализации `customApi.*` (ru, en).

## 🔌 Кастомные API-провайдеры
- Поддержка пользовательских endpoint'ов в формате OpenAI (`/v1/chat/completions`, Bearer) и Anthropic/Claude (`/v1/messages`, x-api-key + anthropic-version) — OpenRouter, DeepSeek, Groq, Together, vLLM, llama.cpp, Anthropic и др.
- Новый блок настроек: добавление/удаление провайдеров, проверка соединения, локальное хранение ключей.
- Кастомные провайдеры интегрированы в ai-translation-service и отображаются в списке AI-провайдеров со значком 🔌.

## Прочее
- Версия приложения: 1.11.1 → 1.12.0.
