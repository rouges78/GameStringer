import { NextRequest, NextResponse } from 'next/server';
import { findSteamGamePath } from '@/lib/steam-utils';
import fs from 'fs/promises';
import path from 'path';

// La logica per Epic Games rimane qui perché non è condivisa
async function findEpicGamePath(appName: string): Promise<string | null> {
    const manifestsPath = path.join('C:', 'ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    try {
        const files = await fs.readdir(manifestsPath);
        for (const file of files) {
            if (file.endsWith('.item')) {
                const filePath = path.join(manifestsPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const manifest = JSON.parse(content);
                if (manifest.DisplayName === appName || manifest.AppName === appName) {
                    return manifest.InstallLocation;
                }
            }
        }
        return null;
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`Errore durante la ricerca dei manifest di Epic Games:`, error);
        }
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const gameId = searchParams.get('gameId');
    const appName = searchParams.get('appName');

    if (!provider || !gameId) {
        return NextResponse.json({ error: 'Parametri `provider` e `gameId` sono richiesti' }, { status: 400 });
    }

    let gamePath: string | null = null;

    try {
        switch (provider) {
            case 'steam':
                gamePath = await findSteamGamePath(gameId);
                break;
            case 'epic':
                if (!appName) {
                    return NextResponse.json({ error: '`appName` è richiesto per i giochi Epic' }, { status: 400 });
                }
                gamePath = await findEpicGamePath(appName);
                break;
            default:
                return NextResponse.json({ error: 'Provider non supportato' }, { status: 400 });
        }

        if (gamePath) {
            return NextResponse.json({ path: gamePath });
        } else {
            return NextResponse.json({ error: 'Percorso del gioco non trovato' }, { status: 404 });
        }
    } catch (error) {
        console.error('Errore API in game-path:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
