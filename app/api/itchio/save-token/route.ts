import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return new NextResponse(JSON.stringify({ error: 'Utente non autenticato.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { accessToken } = await request.json();

  if (!accessToken) {
    return new NextResponse(JSON.stringify({ error: 'Access token mancante.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Usa l'access token per ottenere i dati dell'utente da itch.io
    const itchResponse = await fetch(`https://itch.io/api/v1/${accessToken}/me`);
    if (!itchResponse.ok) {
      throw new Error(`Errore API itch.io: ${itchResponse.statusText}`);
    }
    const itchData = await itchResponse.json();
    const itchUserId = itchData.user.id;

    if (!itchUserId) {
        throw new Error('ID utente di itch.io non trovato nella risposta API.');
    }

    // 2. Salva le credenziali nel database usando Prisma
    await prisma.account.create({
      data: {
        userId: session.user.id,
        type: 'oauth',
        provider: 'itchio',
        providerAccountId: itchUserId.toString(),
        access_token: accessToken,
        // Aggiungi altri campi se disponibili, es. refresh_token, expires_at
      },
    });

    return new NextResponse(JSON.stringify({ message: 'Account itch.io collegato con successo.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Errore nel salvare il token di itch.io:", error);
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    return new NextResponse(JSON.stringify({ error: 'Impossibile collegare l\'account itch.io.', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
