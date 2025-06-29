import { NextRequest, NextResponse } from 'next/server';

// Cache per memorizzare i dettagli dei giochi ed evitare chiamate API ripetute
const detailsCache = new Map<string, any>();

/**
 * Pulisce e formatta la stringa delle lingue supportate dall'API di Steam.
 * Gestisce sia il formato "Lingua1, Lingua2" sia quello con HTML "Lingua1<strong>*</strong>, Lingua2...<br>..."
 */
function parseSupportedLanguages(languagesString: string): string[] {
    if (!languagesString) {
        return [];
    }

    // La stringa può contenere HTML, asterischi per l'audio, e altro. Va pulita.
    // Esempio: "Inglese<strong>*</strong>, Francese<strong>*</strong>, Italiano, ...<br><strong>*</strong>lingue con supporto audio completo"

    // 1. Rimuovi tutto ciò che segue il tag <br>, che di solito sono note aggiuntive.
    const relevantString = languagesString.split('<br>')[0];

    // 2. Pulisci la stringa da tutti i tag HTML e dagli asterischi.
    const cleanedString = relevantString.replace(/<[^>]*>/g, '').replace(/\*/g, '');

    // 3. Dividi la stringa in singole lingue, usando la virgola come separatore.
    const languages = cleanedString.split(',')
        .map(lang => lang.trim())      // Rimuovi spazi bianchi da ogni lingua
        .filter(lang => lang.length > 0); // Rimuovi eventuali stringhe vuote risultanti

    // 4. Rimuovi eventuali duplicati e restituisci l'array pulito.
    return [...new Set(languages)];
}

export async function GET(request: NextRequest, { params }: { params: { appid: string } }) {
    const { appid } = params;

    if (!appid) {
        return NextResponse.json({ error: 'AppID mancante' }, { status: 400 });
    }

    if (detailsCache.has(appid)) {
        console.log(`[API/STEAM/GAME-DETAILS] Dettagli per ${appid} trovati nella cache.`);
        return NextResponse.json(detailsCache.get(appid));
    }

    try {
        console.log(`[API/STEAM/GAME-DETAILS] Recupero dettagli per ${appid} da Steam...`);
                const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
        
        if (!response.ok) {
            // L'API di Steam risponde con 403 (Forbidden) o 429 (Too Many Requests) quando si viene limitati.
            // Invece di lanciare un errore 500, restituiamo un 429 per segnalare al client di rallentare.
            if (response.status === 403 || response.status === 429) {
                console.warn(`[API/STEAM/GAME-DETAILS] Rate limit raggiunto per ${appid} (Status: ${response.status}). Il client riproverà.`);
                return NextResponse.json({ error: 'Rate limited by Steam' }, { status: 429 });
            }
            // Per tutti gli altri errori, lancia un errore generico che risulterà in un 500.
            throw new Error(`Errore HTTP dalla API di Steam: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const gameData = data[appid];

        if (gameData && gameData.success && gameData.data && typeof gameData.data === 'object') {
            const languagesString = gameData.data.supported_languages;
                        const supported_languages = languagesString ? parseSupportedLanguages(languagesString) : [];
            
            // Nota: l'API appdetails non fornisce in modo affidabile il motore di gioco.
            // Lo impostiamo a null per coerenza con la struttura dati attesa dal frontend.
            const game_engine = null; 

            const details = { supported_languages, game_engine };

            // Metti in cache solo se abbiamo trovato delle lingue
            if (supported_languages.length > 0) {
                detailsCache.set(appid, details);
                setTimeout(() => detailsCache.delete(appid), 3600 * 1000); // Cache per 1 ora
            }

            return NextResponse.json(details);
        } else {
            // Steam risponde con successo: false per appid non validi (es. DLC, software)
            return NextResponse.json({ error: 'Nessun dettaglio valido trovato per questo AppID.' }, { status: 404 });
        }

    } catch (error: any) {
        console.error(`[API/STEAM/GAME-DETAILS] Errore grave durante il recupero dei dettagli per ${appid}:`, error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
