import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Definiamo un tipo per i giochi che riceviamo da Steam per maggiore sicurezza
interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
}

export async function GET() {
  // 1. Recupera la sessione dell'utente per ottenere i suoi dati
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  // 2. Controlla se la chiave API di Steam è configurata nelle variabili d'ambiente
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    console.error('La chiave API di Steam non è configurata nel file .env.local');
    return NextResponse.json({ error: 'Configurazione del server incompleta.' }, { status: 500 });
  }

  // 3. Trova l'account Steam dell'utente tra quelli collegati
  const steamAccount = session.user.accounts?.find(acc => acc.provider === 'steam-credentials');
  if (!steamAccount) {
    return NextResponse.json({ games: [] }); // L'utente non ha collegato Steam, restituiamo un array vuoto
  }

  const steamId = steamAccount.providerAccountId;

  // 4. Chiama l'API di Steam per ottenere la lista dei giochi posseduti
  const steamApiUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true`;

  try {
    const response = await fetch(steamApiUrl);
    if (!response.ok) {
      throw new Error(`Errore dalla Steam API: ${response.statusText}`);
    }

    const data = await response.json();
    const games: SteamGame[] = data.response.games || [];

    // 5. Formatta e restituisci i dati dei giochi
    const formattedGames = games.map(game => ({
      id: `steam-${game.appid}`,
      name: game.name,
      imageUrl: `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`,
      provider: 'steam',
    }));

    return NextResponse.json({ games: formattedGames });

  } catch (error: any) {
    console.error('Errore durante la chiamata alla Steam API:', error.message);
    return NextResponse.json({ error: 'Impossibile recuperare i giochi da Steam.' }, { status: 500 });
  }
}
