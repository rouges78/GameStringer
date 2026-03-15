'use client';

import React from 'react';
import { MangaTranslator } from '@/components/tools/manga-translator';
import { useTranslation } from '@/lib/i18n';

export default function MangaTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <MangaTranslator />
    </div>
  );
}
