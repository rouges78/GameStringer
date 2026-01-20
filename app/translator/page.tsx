'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TranslatorRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const params = searchParams.toString();
    const url = params ? `/translator/pro?${params}` : '/translator/pro';
    router.replace(url);
  }, [router, searchParams]);
  
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Reindirizzamento...</p>
      </div>
    </div>
  );
}
