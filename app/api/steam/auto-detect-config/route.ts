import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Common Steam installation paths
const STEAM_PATHS = {
  win32: [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Program Files (x86)\\Steam',
    'D:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam',
    'F:\\Steam',
    'G:\\Steam',
  ],
  darwin: [
    path.join(os.homedir(), 'Library/Application Support/Steam'),
    '/Applications/Steam.app/Contents/MacOS/Steam',
  ],
  linux: [
    path.join(os.homedir(), '.steam/steam'),
    path.join(os.homedir(), '.local/share/Steam'),
    '/usr/share/steam',
    '/usr/local/share/steam',
  ],
};

async function findSteamPath(): Promise<string | null> {
  const platform = process.platform as keyof typeof STEAM_PATHS;
  const paths = STEAM_PATHS[platform] || [];
  
  // Also check registry on Windows
  if (platform === 'win32') {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v SteamPath');
      const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        paths.unshift(match[1].trim());
      }
    } catch (error) {
      // Registry query failed, continue with default paths
    }
  }
  
  // Check each path
  for (const steamPath of paths) {
    try {
      const configPath = path.join(steamPath, 'config', 'sharedconfig.vdf');
      await fs.access(configPath);
      return steamPath;
    } catch {
      // Path doesn't exist, try next
    }
  }
  
  return null;
}

function parseVdfForSharedAccounts(content: string): string[] {
  const sharedAccounts: string[] = [];
  
  // Look for AuthorizedDevice sections
  const authorizedDeviceRegex = /"AuthorizedDevice"\s*{\s*"([^"]+)"/g;
  let match;
  
  while ((match = authorizedDeviceRegex.exec(content)) !== null) {
    const steamId = match[1];
    if (steamId && /^\d{17}$/.test(steamId)) {
      sharedAccounts.push(steamId);
    }
  }
  
  // Also look for authorized_devices
  const authorizedDevicesRegex = /"authorized_devices"\s*{\s*"([^"]+)"/g;
  while ((match = authorizedDevicesRegex.exec(content)) !== null) {
    const steamId = match[1];
    if (steamId && /^\d{17}$/.test(steamId)) {
      sharedAccounts.push(steamId);
    }
  }
  
  // Remove duplicates
  return [...new Set(sharedAccounts)];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    
    // Find Steam installation
    const steamPath = await findSteamPath();
    if (!steamPath) {
      return NextResponse.json({ 
        error: 'Steam non trovato. Assicurati che Steam sia installato sul tuo PC.' 
      }, { status: 404 });
    }
    
    // Read sharedconfig.vdf
    const configPath = path.join(steamPath, 'config', 'sharedconfig.vdf');
    let fileContent: string;
    
    try {
      fileContent = await fs.readFile(configPath, 'utf-8');
    } catch (error) {
      return NextResponse.json({ 
        error: 'File di configurazione non trovato. Assicurati che Steam sia stato avviato almeno una volta.' 
      }, { status: 404 });
    }
    
    // Parse the file
    const sharedAccounts = parseVdfForSharedAccounts(fileContent);
    
    return NextResponse.json({
      success: true,
      steamPath,
      configPath,
      sharedAccounts,
      message: sharedAccounts.length > 0 
        ? `Trovati ${sharedAccounts.length} account autorizzati`
        : 'Nessun account autorizzato trovato'
    });
    
  } catch (error) {
    console.error('Auto-detect error:', error);
    return NextResponse.json({ 
      error: 'Errore durante il rilevamento automatico',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}