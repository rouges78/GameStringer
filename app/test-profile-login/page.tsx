'use client';

import { ProfileLoginTest } from '@/components/debug/profile-login-test';

export default function TestProfileLoginPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🔥 TEST RISOLUZIONE PROBLEMA LOGIN</h1>
          <p className="text-muted-foreground">
            Test definitivo per verificare che il problema del riavvio/chiusura durante il login sia RISOLTO.
          </p>
        </div>

        <ProfileLoginTest />
      </div>
    </div>
  );
}