'use client';

import { UniversalInjector } from '@/components/tools/universal-injector';

export default function InjectorPage() {
  return (
    <div className="p-4 overflow-y-auto h-full">
      <UniversalInjector />
    </div>
  );
}
