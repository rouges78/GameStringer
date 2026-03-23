/**
 * i18n Translations Loader
 * 
 * Le traduzioni sono ora in file JSON separati per lingua in ./locales/
 * Questo elimina i falsi errori IDE causati dal file monolitico da 31K righe.
 * 
 * Lingue supportate: it, en, es, fr, de, ja, zh, ko, pt, ru, pl
 */

import it from './locales/it.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';

export const translations = {
  it,
  en,
  es,
  fr,
  de,
  ja,
  zh,
  ko,
  pt,
  ru,
  pl,
} as const;

export type Language = keyof typeof translations;
export type TranslationKeys = typeof translations['it'];
