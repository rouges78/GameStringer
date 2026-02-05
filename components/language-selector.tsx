'use client';

import { useEffect } from 'react';
import { useI18n, SUPPORTED_LOCALES, detectBrowserLocale, type Locale } from '@/lib/i18n-new';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LanguageSelectorProps {
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
}

export function LanguageSelector({
  showFlag = true,
  showNativeName = true,
  className,
}: LanguageSelectorProps) {
  const { locale, setLocale, isLoading } = useI18n();

  useEffect(() => {
    const savedLocale = localStorage.getItem('gamestringer-i18n');
    if (!savedLocale) {
      const browserLocale = detectBrowserLocale();
      if (browserLocale !== locale) {
        setLocale(browserLocale);
      }
    }
  }, []);

  const handleChange = async (value: string) => {
    await setLocale(value as Locale);
  };

  const currentLocale = SUPPORTED_LOCALES.find(l => l.code === locale);

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className={className}>
        <SelectValue>
          {currentLocale && (
            <span className="flex items-center gap-2">
              {showFlag && <span>{currentLocale.flag}</span>}
              <span>{showNativeName ? currentLocale.nativeName : currentLocale.name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((loc) => (
          <SelectItem key={loc.code} value={loc.code}>
            <span className="flex items-center gap-2">
              {showFlag && <span>{loc.flag}</span>}
              <span>{showNativeName ? loc.nativeName : loc.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LanguageSelectorCompact({ className }: { className?: string }) {
  const { locale, setLocale, isLoading } = useI18n();

  const handleChange = async (value: string) => {
    await setLocale(value as Locale);
  };

  const currentLocale = SUPPORTED_LOCALES.find(l => l.code === locale);

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className={`w-16 ${className}`}>
        <SelectValue>
          {currentLocale?.flag}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((loc) => (
          <SelectItem key={loc.code} value={loc.code}>
            <span className="flex items-center gap-2">
              <span>{loc.flag}</span>
              <span className="text-sm">{loc.code.toUpperCase()}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
