'use client';

import { ContextCrawler } from '@/components/tools/context-crawler';
import { useTranslation } from '@/lib/i18n';

export default function CrawlerPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <ContextCrawler />
    </div>
  );
}



