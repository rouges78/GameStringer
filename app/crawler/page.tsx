'use client';

import { ContextCrawler } from '@/components/tools/context-crawler';

export default function CrawlerPage() {
  return (
    <div className="p-4 overflow-y-auto h-full">
      <ContextCrawler />
    </div>
  );
}
