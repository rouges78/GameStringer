import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  // 1. Verifica che l'utente sia autenticato
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  // 2. Ottieni il provider da scollegare dal corpo della richiesta
  const { providerId } = await req.json();
  if (!providerId) {
    return NextResponse.json({ error: 'ID del provider non specificato' }, { status: 400 });
  }

  try {
    // 3. Rimuovi il record dell'account dal database
    // Questo elimina il collegamento tra l'utente e il provider specifico
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: providerId,
      },
    });

    // 4. Restituisci una risposta di successo
    return NextResponse.json({ message: 'Account scollegato con successo' });

  } catch (error) {
    console.error('Errore durante la disconnessione dell\'account:', error);
    // Prisma lancia un errore P2025 se il record da eliminare non viene trovato
    if (error instanceof Error && (error as any).code === 'P2025') { 
        return NextResponse.json({ error: 'Account non trovato o già scollegato.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Si è verificato un errore interno del server.' }, { status: 500 });
  }
}
