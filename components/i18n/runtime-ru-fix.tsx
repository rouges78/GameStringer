'use client';

/**
 * 🇷🇺 Runtime RU Fix
 *
 * Дополняет штатную систему i18n: переводит на русский строки,
 * которые захардкожены в компонентах на английском/итальянском и не проходят
 * через t() (см. translation-audit-report.json). Словарь: lib/i18n/hardcoded-ru.json.
 *
 * Активен только когда выбран русский язык интерфейса.
 * Монтируется один раз в app/layout.tsx: <RuntimeRuFix />
 */

import { useEffect } from 'react';
import dictionary from '@/lib/i18n/hardcoded-ru.json';

const DICT: Record<string, string> = dictionary as Record<string, string>;
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;

function isRussian(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const settings = window.localStorage.getItem('gameStringerSettings');
    if (settings) {
      const lang = JSON.parse(settings)?.system?.language;
      if (lang) return lang === 'ru';
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('gs_language')) {
        const v = (window.localStorage.getItem(key) || '').replace(/"/g, '').trim();
        if (v) return v === 'ru';
      }
    }
  } catch {
    // ignore
  }
  return false;
}

// Ключи словаря, отсортированные по убыванию длины — чтобы длинные фразы
// заменялись раньше коротких (иначе "Game" съест кусок "Game Details").
let SORTED_KEYS: string[] | null = null;
function getSortedKeys(): string[] {
  if (SORTED_KEYS) return SORTED_KEYS;
  SORTED_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);
  return SORTED_KEYS;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateSubstrings(raw: string): string {
  let out = raw;
  for (const key of getSortedKeys()) {
    if (!out.includes(key)) continue;
    const ru = DICT[key];
    if (!ru || ru === key) continue;
    // Границы слова, чтобы "Game" не ломал "GameMaker". Для ключей с не-буквенными
    // символами в начале/конце используем простую замену.
    const startsAlnum = /^[A-Za-zА-Яа-я0-9]/.test(key);
    const endsAlnum = /[A-Za-zА-Яа-я0-9]$/.test(key);
    const pattern = (startsAlnum ? '(?<![A-Za-zА-Яа-я0-9])' : '') +
      escapeRe(key) +
      (endsAlnum ? '(?![A-Za-zА-Яа-я0-9])' : '');
    try {
      out = out.replace(new RegExp(pattern, 'g'), ru);
    } catch {
      out = out.split(key).join(ru);
    }
  }
  return out;
}

function translateTextNode(node: Text): void {
  const raw = node.nodeValue || '';
  if (!raw.trim()) return;
  // 1) Точное совпадение целого узла (быстрый путь)
  const trimmed = raw.trim();
  const exact = DICT[trimmed];
  if (exact && exact !== trimmed) {
    node.nodeValue = raw.replace(trimmed, exact);
    return;
  }
  // 2) Замена подстрок (для "String it! → Русский" и т.п.)
  const replaced = translateSubstrings(raw);
  if (replaced !== raw) {
    node.nodeValue = replaced;
  }
}

function translateElementAttrs(el: Element): void {
  for (const attr of ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    const exact = DICT[val.trim()];
    if (exact && exact !== val) {
      el.setAttribute(attr, exact);
      continue;
    }
    const replaced = translateSubstrings(val);
    if (replaced !== val) el.setAttribute(attr, replaced);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    translateElementAttrs(el);
    el.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateElementAttrs);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    translateTextNode(n as Text);
  }
}

export function RuntimeRuFix() {
  useEffect(() => {
    let active = isRussian();
    if (active) walk(document.body);

    const observer = new MutationObserver(mutations => {
      if (!active) return;
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(m.target as Text);
        }
        m.addedNodes.forEach(node => walk(node));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // отслеживаем смену языка без перезагрузки
    const interval = window.setInterval(() => {
      const ru = isRussian();
      if (ru && !active) {
        active = true;
        walk(document.body);
      } else if (!ru && active) {
        active = false; // обратный перевод появится после перерисовки/перезапуска
      }
    }, 2000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

export default RuntimeRuFix;
