import { CompleteIntegrationTest } from '@/components/debug/complete-integration-test';

export default function CompleteIntegrationTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Completo Integrazione Tauri-React</h1>
        <p className="text-gray-600">
          Test completo di tutte le funzionalità di integrazione tra frontend React e backend Tauri.
          Questo test verifica chiamate API, comunicazione bidirezionale, gestione errori, 
          serializzazione dati e flussi end-to-end completi.
        </p>
      </div>
      
      <CompleteIntegrationTest />
    </div>
  );
}