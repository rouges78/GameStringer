'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TauriIntegrationTest } from '@/components/debug/tauri-integration-test';
import { BidirectionalCommunicationTest } from '@/components/debug/bidirectional-communication-test';
import { ErrorHandlingTest } from '@/components/debug/error-handling-test';
import { SerializationTest } from '@/components/debug/serialization-test';
import { EndToEndFlowTest } from '@/components/debug/end-to-end-flow-test';
import { 
  Database, 
  ArrowLeftRight, 
  AlertTriangle, 
  Play, 
  CheckCircle,
  Settings
} from 'lucide-react';

export default function TauriIntegrationTestPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const testSuites = [
    {
      id: 'api-calls',
      name: 'Chiamate API',
      description: 'Test di tutte le chiamate Tauri API',
      icon: <Database className="w-4 h-4" />,
      component: <TauriIntegrationTest />
    },
    {
      id: 'bidirectional',
      name: 'Comunicazione Bidirezionale',
      description: 'Test comunicazione frontend-backend',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      component: <BidirectionalCommunicationTest />
    },
    {
      id: 'error-handling',
      name: 'Gestione Errori',
      description: 'Test gestione errori e timeout',
      icon: <AlertTriangle className="w-4 h-4" />,
      component: <ErrorHandlingTest />
    },
    {
      id: 'serialization',
      name: 'Serializzazione',
      description: 'Test serializzazione/deserializzazione dati',
      icon: <Settings className="w-4 h-4" />,
      component: <SerializationTest />
    },
    {
      id: 'end-to-end',
      name: 'Flusso End-to-End',
      description: 'Test flusso completo creazione/autenticazione',
      icon: <Play className="w-4 h-4" />,
      component: <EndToEndFlowTest />
    }
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Test Integrazione Tauri-React</h1>
        <p className="text-gray-600 mt-2">
          Suite completa di test per verificare l'integrazione tra frontend React e backend Tauri del sistema profili.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          {testSuites.map(suite => (
            <TabsTrigger key={suite.id} value={suite.id} className="flex items-center gap-2">
              {suite.icon}
              <span className="hidden sm:inline">{suite.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Panoramica Test Integrazione
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Questa suite di test verifica tutti gli aspetti dell'integrazione Tauri-React per il sistema profili:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testSuites.map(suite => (
                      <Card key={suite.id} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setActiveTab(suite.id)}>
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              {suite.icon}
                            </div>
                            <div>
                              <h3 className="font-medium">{suite.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{suite.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Obiettivi dei Test:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Verificare che tutte le chiamate API Tauri funzionino correttamente</li>
                      <li>• Testare la comunicazione bidirezionale tra frontend e backend</li>
                      <li>• Validare la gestione degli errori e dei timeout</li>
                      <li>• Controllare l'integrità della serializzazione/deserializzazione dati</li>
                      <li>• Testare il flusso completo di creazione e autenticazione profili</li>
                    </ul>
                  </div>

                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Come Utilizzare:</h4>
                    <ol className="text-sm text-green-700 space-y-1">
                      <li>1. Seleziona una categoria di test dalle tab sopra</li>
                      <li>2. Esegui i test cliccando sui pulsanti "Esegui test"</li>
                      <li>3. Monitora i risultati e gli eventuali errori</li>
                      <li>4. Utilizza i risultati per identificare problemi di integrazione</li>
                    </ol>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Task 4.1: Test chiamate API</Badge>
                    <Badge variant="outline">Task 4.2: Comunicazione bidirezionale</Badge>
                    <Badge variant="outline">Task 4.3: Gestione errori</Badge>
                    <Badge variant="outline">Task 4.4: Serializzazione dati</Badge>
                    <Badge variant="outline">Task 4.5: Flusso end-to-end</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {testSuites.map(suite => (
          <TabsContent key={suite.id} value={suite.id} className="mt-6">
            {suite.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}