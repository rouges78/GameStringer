import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { provider } = await request.json();
    
    // Check if it's a utility service
    if (['howlongtobeat', 'steamgriddb', 'achievements', 'playtime'].includes(provider)) {
      const preference = await prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId: session.user.id,
            key: `utility_${provider}`,
          },
        },
      });
      
      if (!preference) {
        return NextResponse.json({
          connected: false,
          error: 'Servizio non attivato'
        });
      }
      
      const prefData = JSON.parse(preference.value);
      
      // Test utility services
      switch (provider) {
        case 'howlongtobeat':
          // HowLongToBeat doesn't require authentication
          return NextResponse.json({
            connected: true,
            details: {
              status: 'OK',
              note: 'Servizio attivo - nessuna autenticazione richiesta'
            }
          });
          
        case 'steamgriddb':
          if (!prefData.apiKey) {
            return NextResponse.json({
              connected: false,
              error: 'API key mancante'
            });
          }
          
          // Test SteamGridDB API
          try {
            const sgdbResponse = await fetch('https://www.steamgriddb.com/api/v2/grids/game/5', {
              headers: {
                'Authorization': `Bearer ${prefData.apiKey}`
              }
            });
            
            if (sgdbResponse.ok) {
              return NextResponse.json({
                connected: true,
                details: {
                  status: 'OK',
                  note: 'API key valida'
                }
              });
            } else if (sgdbResponse.status === 401) {
              return NextResponse.json({
                connected: false,
                error: 'API key non valida'
              });
            }
            
            return NextResponse.json({
              connected: false,
              error: 'Errore nel test dell\'API'
            });
          } catch (error) {
            return NextResponse.json({
              connected: false,
              error: 'Errore di connessione all\'API'
            });
          }
          
        case 'achievements':
        case 'playtime':
          return NextResponse.json({
            connected: false,
            error: 'Servizio non ancora implementato'
          });
          
        default:
          return NextResponse.json({
            connected: false,
            error: 'Servizio non riconosciuto'
          });
      }
    }
    
    // Get the account for this provider
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: provider
      }
    });

    if (!account) {
      return NextResponse.json({
        connected: false,
        error: 'Account non collegato'
      });
    }

    // Test connection based on provider
    let testResult = { connected: true, details: {} as any };

    switch (provider) {
      case 'steam-credentials':
        // Test Steam connection
        if (account.providerAccountId && /^\d{17}$/.test(account.providerAccountId)) {
          try {
            const steamApiUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${account.providerAccountId}`;
            const response = await fetch(steamApiUrl);
            const data = await response.json();
            
            if (data.response?.players?.length > 0) {
              testResult.details = {
                steamId: account.providerAccountId,
                profile: data.response.players[0],
                status: 'OK'
              };
            } else {
              testResult.details = {
                steamId: account.providerAccountId,
                status: 'Profile not found',
                error: 'Steam profile non trovato'
              };
            }
          } catch (error) {
            testResult.details = {
              steamId: account.providerAccountId,
              status: 'API Error',
              error: 'Errore nella chiamata API Steam'
            };
          }
        } else {
          testResult.connected = false;
          testResult.details = {
            error: 'SteamID non valido',
            currentId: account.providerAccountId
          };
        }
        break;

      case 'itchio-credentials':
        // Test itch.io connection
        if (account.access_token) {
          try {
            const apiUrl = `https://itch.io/api/1/${account.access_token}/me`;
            const response = await fetch(apiUrl);
            
            if (response.ok) {
              const data = await response.json();
              testResult.details = {
                status: 'OK',
                user: data.user
              };
            } else {
              testResult.connected = false;
              testResult.details = {
                status: 'Invalid Token',
                error: 'Token itch.io non valido o scaduto'
              };
            }
          } catch (error) {
            testResult.connected = false;
            testResult.details = {
              status: 'API Error',
              error: 'Errore nella chiamata API itch.io'
            };
          }
        } else {
          testResult.connected = false;
          testResult.details = {
            error: 'Access token mancante'
          };
        }
        break;

      case 'epicgames':
        // Epic Games uses OAuth, token might be expired
        testResult.details = {
          status: 'OAuth',
          note: 'Epic Games usa OAuth. Il token potrebbe essere scaduto.',
          accountId: account.providerAccountId
        };
        break;

      case 'ubisoft-credentials':
        // Ubisoft token testing would require active session
        testResult.details = {
          status: 'Credentials Stored',
          note: 'Ubisoft richiede autenticazione attiva. Credenziali salvate.',
          accountId: account.providerAccountId
        };
        break;

      case 'gog-credentials':
      case 'origin-credentials':
      case 'battlenet-credentials':
        // These are credential-only stores
        testResult.details = {
          status: 'Credentials Only',
          note: `${provider} non ha API pubbliche. Solo credenziali salvate.`,
          accountId: account.providerAccountId
        };
        break;

      default:
        testResult.details = {
          status: 'Unknown Provider',
          error: 'Provider non riconosciuto'
        };
    }

    return NextResponse.json(testResult);

  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json({ 
      error: 'Errore durante il test della connessione',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}