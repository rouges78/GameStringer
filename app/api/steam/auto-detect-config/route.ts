import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Common Steam installation paths, prioritizing the most common ones.
const STEAM_PATHS = {
  win32: [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ],
  darwin: [
    path.join(os.homedir(), 'Library/Application Support/Steam'),
  ],
  linux: [
    path.join(os.homedir(), '.steam/steam'),
    path.join(os.homedir(), '.local/share/Steam'),
  ],
};

/**
 * Finds the Steam installation path by checking common locations and the Windows Registry.
 * @returns A promise that resolves to the Steam path or null if not found.
 */
async function findSteamPath(): Promise<string | null> {
  const platform = process.platform as keyof typeof STEAM_PATHS;
  const paths = [...(STEAM_PATHS[platform] || [])];

  if (platform === 'win32') {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v SteamPath');
      const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        // Add the registry path to the beginning of the list to check it first.
        paths.unshift(match[1].trim());
      }
    } catch (error) {
      // If registry query fails, it's not critical. Proceed with default paths.
      console.warn('Could not query Steam path from registry:', error);
    }
  }

  for (const steamPath of paths) {
    try {
      // Check for a key file to validate the directory.
      const configPath = path.join(steamPath, 'config', 'loginusers.vdf');
      await fs.access(configPath);
      return steamPath;
    } catch {
      // This path is not a valid Steam installation, try the next one.
    }
  }

  return null;
}

/**
 * Parses the loginusers.vdf file to extract all logged-in Steam user IDs (SteamID64).
 * @param content The content of the VDF file.
 * @returns An array of SteamID64 strings.
 */
function parseLoginUsersVdf(content: string): string[] {
  const accounts = new Set<string>();
  // Regex to find all user account blocks and extract their SteamID64.
  const accountEntriesRegex = /"(\d{17})"\s*\{/g;
  let match;
  while ((match = accountEntriesRegex.exec(content)) !== null) {
    accounts.add(match[1]);
  }
  return Array.from(accounts);
}

/**
 * API endpoint to auto-detect Steam configuration, including installation path and user accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const steamPath = await findSteamPath();
    if (!steamPath) {
      return NextResponse.json({ error: 'Installazione di Steam non trovata.' }, { status: 404 });
    }

    const loginUsersVdfPath = path.join(steamPath, 'config', 'loginusers.vdf');
    let fileContent: string;

    try {
      fileContent = await fs.readFile(loginUsersVdfPath, 'utf-8');
    } catch (error) {
      return NextResponse.json({ error: 'File di configurazione degli utenti (loginusers.vdf) non trovato.' }, { status: 404 });
    }

    const accounts = parseLoginUsersVdf(fileContent);

    return NextResponse.json({
      success: true,
      steamPath,
      accounts,
    });

  } catch (error) {
    console.error('Errore durante il rilevamento automatico di Steam:', error);
    return NextResponse.json({ error: 'Si è verificato un errore imprevisto durante il rilevamento automatico.' }, { status: 500 });
  }
}