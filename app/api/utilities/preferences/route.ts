import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { service, enabled, apiKey } = await req.json();
  
  if (!service) {
    return NextResponse.json({ error: 'Servizio non specificato' }, { status: 400 });
  }

  try {
    // Salva o aggiorna le preferenze dell'utente per il servizio
    const preference = await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId: session.user.id,
          key: `utility_${service}`,
        },
      },
      update: {
        value: JSON.stringify({ enabled, apiKey }),
      },
      create: {
        userId: session.user.id,
        key: `utility_${service}`,
        value: JSON.stringify({ enabled, apiKey }),
      },
    });

    return NextResponse.json({ 
      message: 'Preferenze salvate con successo',
      preference 
    });
  } catch (error) {
    console.error('Errore nel salvare le preferenze:', error);
    return NextResponse.json({ 
      error: 'Errore nel salvare le preferenze' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const service = searchParams.get('service');

  try {
    if (service) {
      // Ottieni preferenze per un servizio specifico
      const preference = await prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId: session.user.id,
            key: `utility_${service}`,
          },
        },
      });

      if (!preference) {
        return NextResponse.json({ enabled: false });
      }

      return NextResponse.json(JSON.parse(preference.value));
    } else {
      // Ottieni tutte le preferenze utility
      const preferences = await prisma.userPreference.findMany({
        where: {
          userId: session.user.id,
          key: {
            startsWith: 'utility_',
          },
        },
      });

      const result: Record<string, any> = {};
      preferences.forEach((pref: any) => {
        const service = pref.key.replace('utility_', '');
        result[service] = JSON.parse(pref.value);
      });

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Errore nel recuperare le preferenze:', error);
    return NextResponse.json({ 
      error: 'Errore nel recuperare le preferenze' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const service = searchParams.get('service');
  
  if (!service) {
    return NextResponse.json({ error: 'Servizio non specificato' }, { status: 400 });
  }

  try {
    await prisma.userPreference.delete({
      where: {
        userId_key: {
          userId: session.user.id,
          key: `utility_${service}`,
        },
      },
    });

    return NextResponse.json({ 
      message: 'Preferenze eliminate con successo' 
    });
  } catch (error) {
    console.error('Errore nell\'eliminare le preferenze:', error);
    return NextResponse.json({ 
      error: 'Errore nell\'eliminare le preferenze' 
    }, { status: 500 });
  }
}