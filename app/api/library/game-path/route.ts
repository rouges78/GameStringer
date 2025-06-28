import { NextRequest, NextResponse } from 'next/server';
import Steam from 'steam-locate';
import fs from 'fs/promises';
import path from 'path';

const steam = new (Steam as any)();

// Funzione per trovare il percorso di un gioco Steam
async function findSteamGamePath(appId: string): Promise<string | null> {
    try {
        const game = await steam.getApp({ appid: parseInt(appId, 10), force: true });
        return game?.path || null;
    } catch (error) {
        console.error(`Errore durante la ricerca del gioco Steam con AppID ${appId}:`, error);
        return null;
    }
}

// Funzione per trovare il percorso di un gioco Epic Games
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
        // Se la cartella non esiste, è normale, quindi non lo logghiamo come errore critico
        if (error.code !== 'ENOENT') {
            console.error(`Errore durante la ricerca dei manifest di Epic Games:`, error);
        }
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { appId, provider, appName } = await req.json();

        if (!provider || !appId) {
            return NextResponse.json({ error: 'Parametri `provider` e `appId` sono richiesti' }, { status: 400 });
        }

        let gamePath: string | null = null;

        switch (provider) {
            case 'steam':
                gamePath = await findSteamGamePath(appId);
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
