import { NextRequest, NextResponse } from 'next/server';
import * as VDF from '@node-steam/vdf';

// Definiamo un tipo per la struttura che ci aspettiamo dal file VDF.
// Questo aiuta con la sicurezza dei tipi e l'autocompletamento.
type SharedConfig = {
  library_sharing?: {
    AllowedAccounts?: {
      [steamId: string]: any; // Le chiavi sono gli SteamID, i valori non ci interessano
    };
  };
};

export async function POST(req: NextRequest) {
  try {
    // 1. Otteniamo il contenuto del file dal corpo della richiesta
    const body = await req.text();
    if (!body) {
      return NextResponse.json({ error: 'Il contenuto del file è vuoto.' }, { status: 400 });
    }

    // 2. Analizziamo il contenuto VDF
    let parsedData: SharedConfig;
    try {
      // La libreria potrebbe lanciare un errore se il formato non è valido
      parsedData = VDF.parse(body);
    } catch (error) { 
      console.error('Errore durante il parsing del file VDF:', error);
      return NextResponse.json({ error: 'Impossibile analizzare il file VDF. Il formato potrebbe essere non corretto.' }, { status: 400 });
    }

    // 3. Estraiamo gli account autorizzati
    const allowedAccounts = parsedData?.library_sharing?.AllowedAccounts;

    if (!allowedAccounts) {
      // È possibile che il file sia valido ma non contenga informazioni sulla condivisione
      return NextResponse.json({ sharedAccounts: [] });
    }

    // Le chiavi dell'oggetto AllowedAccounts sono gli SteamID
    const steamIds = Object.keys(allowedAccounts);

    // 4. Restituiamo la lista di SteamID
    return NextResponse.json({ sharedAccounts: steamIds });

  } catch (error) {
    console.error('Si è verificato un errore imprevisto:', error);
    return NextResponse.json({ error: 'Si è verificato un errore interno del server.' }, { status: 500 });
  }
}
