'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ItchIOCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Il token viene restituito nell'hash dell'URL (es. #access_token=...)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (accessToken) {
      // Abbiamo il token, inviamolo al nostro backend per salvarlo
      fetch('/api/itchio/save-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      })
      .then(response => {
        if (!response.ok) {
          // Gestisci l'errore se il backend non riesce a salvare il token
          console.error('Errore nel salvataggio del token di itch.io');
        }
        // Dopo aver tentato di salvare, reindirizza l'utente alle impostazioni
        router.push('/settings');
      })
      .catch(error => {
        console.error('Errore di rete:', error);
        router.push('/settings?error=itchio-link-failed');
      });
    } else {
      // Nessun token trovato, forse un errore durante l'autenticazione
      console.error('Nessun access token trovato nell\'URL di callback.');
      router.push('/settings?error=itchio-no-token');
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <h1 className="text-2xl font-semibold mb-4">Verifica in corso...</h1>
      <p className="text-muted-foreground">Stiamo collegando il tuo account itch.io. Sarai reindirizzato a breve.</p>
      {/* Potresti aggiungere uno spinner qui */}
    </div>
  );
}
