import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    console.log('[FIX-STEAMID-V2] Inizio procedura di pulizia.');
    const body = await req.json();
    const { correctSteamId } = body;

    if (!correctSteamId || !/^\d{17}$/.test(correctSteamId)) {
      console.log(`[FIX-STEAMID-V2] Validazione fallita per SteamID: ${correctSteamId}`);
      return NextResponse.json({ error: 'Formato SteamID non valido.' }, { status: 400 });
    }
    console.log(`[FIX-STEAMID-V2] SteamID corretto fornito: ${correctSteamId}`);

    const userId = session.user.id;
    console.log(`[FIX-STEAMID-V2] ID Utente: ${userId}`);

    // Passo 1: Verifica se lo SteamID corretto è già associato a un ALTRO utente.
    const goodAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'steam-credentials',
          providerAccountId: correctSteamId,
        },
      },
    });

    if (goodAccount && goodAccount.userId !== userId) {
        console.error(`[FIX-STEAMID-V2] SICUREZZA: L'utente ${userId} sta cercando di usare lo SteamID ${correctSteamId} che è già associato all'utente ${goodAccount.userId}.`);
        return NextResponse.json({ error: 'Questo SteamID è già in uso da un altro account.' }, { status: 409 }); // 409 Conflict
    }

    // Passo 2: Trova e elimina tutti gli account Steam errati per questo utente.
    console.log(`[FIX-STEAMID-V2] Cerco account errati per l'utente ${userId}...`);
    const deleteResult = await prisma.account.deleteMany({
      where: {
        userId: userId,
        provider: 'steam-credentials',
        providerAccountId: {
          not: correctSteamId,
        },
      },
    });

    if (deleteResult.count > 0) {
      console.log(`[FIX-STEAMID-V2] Eliminati ${deleteResult.count} account Steam errati per l'utente ${userId}.`);
    } else {
      console.log(`[FIX-STEAMID-V2] Nessun account errato da eliminare trovato per l'utente ${userId}.`);
    }
    
    // Passo 3: Se non esisteva un account corretto, crealo.
    if (!goodAccount) {
        console.log(`[FIX-STEAMID-V2] Nessun account corretto trovato. Procedo con la creazione.`);
        await prisma.account.create({
            data: {
                userId: userId,
                type: 'credentials',
                provider: 'steam-credentials',
                providerAccountId: correctSteamId,
            }
        });
        console.log(`[FIX-STEAMID-V2] Creato nuovo account Steam corretto per l'utente ${userId}.`);
    }

    console.log(`[FIX-STEAMID-V2] Procedura completata con successo per l'utente ${userId}.`);
    return NextResponse.json({ message: 'Il tuo account Steam è stato corretto con successo!' });

  } catch (error) {
    console.error('[FIX-STEAMID-V2] ERRORE CATTURATO DURANTE LA PULIZIA:', error);
    return NextResponse.json({ error: 'Si è verificato un errore interno del server durante la correzione.' }, { status: 500 });
  }
}
