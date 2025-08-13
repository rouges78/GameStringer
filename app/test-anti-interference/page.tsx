'use client';

import React from 'react';
import AntiInterferenceTest from '@/components/notifications/anti-interference-test';
import ToastContainer from '@/components/notifications/toast-container';

export default function TestAntiInterferencePage() {
  return (
    <div className="min-h-screen bg-background">
      <AntiInterferenceTest />
      
      {/* Toast container con sistema anti-interferenza abilitato */}
      <ToastContainer
        maxToasts={5}
        position="top-right"
        autoHideDuration={5000}
        enableAntiInterference={true}
        enableDynamicPositioning={true}
      />
    </div>
  );
}