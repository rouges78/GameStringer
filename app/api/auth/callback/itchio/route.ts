import { NextResponse } from 'next/server';

// Questa pagina viene caricata nel browser dell'utente dopo il redirect da itch.io.
// Il suo unico scopo è catturare l'access_token dall'URL (che si trova nel "fragment" o "hash")
// e inviarlo a un'altra API route del nostro backend per salvarlo in modo sicuro.

export async function GET() {
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connessione a itch.io...</title>
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const state = params.get('state');

            if (accessToken) {
              // Invia il token al nostro backend per salvarlo
              // Nota: qui usiamo un endpoint fittizio /api/itchio/save-token che dobbiamo ancora creare
              fetch('/api/itchio/save-token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accessToken, state }),
              })
              .then(response => {
                if (response.ok) {
                  // Se il salvataggio va a buon fine, reindirizza l'utente a una pagina di successo
                  // o al suo profilo.
                  window.location.href = '/profile?status=itchio_connected';
                } else {
                  // Gestisci l'errore
                  document.body.innerHTML = '<h1>Errore durante il salvataggio del token.</h1><p>Riprova più tardi.</p>';
                }
              })
              .catch(error => {
                console.error('Errore:', error);
                document.body.innerHTML = '<h1>Errore di connessione.</h1><p>Impossibile contattare il server.</p>';
              });
            } else {
              // Errore: nessun token trovato
              document.body.innerHTML = '<h1>Autorizzazione fallita.</h1><p>Nessun token di accesso ricevuto da itch.io.</p>';
            }
          });
        </script>
      </head>
      <body>
        <h1>Stiamo finalizzando la connessione con il tuo account itch.io...</h1>
        <p>Verrai reindirizzato a breve.</p>
      </body>
    </html>
    `,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
}
