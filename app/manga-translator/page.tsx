'use client';

import React from 'react';
import { MangaTranslator } from '@/components/tools/manga-translator';

export default function MangaTranslatorPage() {
  return (
    <div className="p-4 overflow-y-auto h-full">
      <MangaTranslator />
    </div>
  );
}
