'use client';

import React from 'react';
import { MangaTranslator } from '@/components/tools/manga-translator';
import { MainLayout } from '@/components/layout/main-layout';

export default function MangaTranslatorPage() {
  return (
    <MainLayout>
      <MangaTranslator />
    </MainLayout>
  );
}
