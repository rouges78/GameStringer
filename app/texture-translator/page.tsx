'use client';

import React from 'react';
import { TextureTranslator } from '@/components/tools/texture-translator';
import { useTranslation } from '@/lib/i18n';

export default function TextureTranslatorPage() {
  const { t: _t } = useTranslation();
  return <TextureTranslator />;
}
