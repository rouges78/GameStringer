import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { parse } from 'vdf';

// Define a type for the parsed libraryfolders.vdf content
interface LibraryFolders {
    [key: string]: {
        path: string;
    };
}

/**
 * Finds all installed Steam games by reading local Steam files.
 * @returns A Promise that resolves to a Set of installed Steam AppIDs.
 */
export async function getInstalledSteamAppIds(): Promise<Set<number>> {
    const installedAppIds = new Set<number>();

    try {
        // 1. Find Steam installation path by executing a PowerShell command
        const steamPath = await new Promise<string>((resolve, reject) => {
            const command = `powershell.exe -command "Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' | Select-Object -ExpandProperty SteamPath"`;
            exec(command, (error, stdout, stderr) => {
                if (error || stderr) {
                    return reject(new Error(`Failed to get Steam path from registry: ${error?.message || stderr}`));
                }
                const steamPathValue = stdout.trim();
                if (!steamPathValue) {
                    return reject(new Error('Steam path not found in registry.'));
                }
                resolve(steamPathValue.replace(/\//g, '\\'));
            });
        });

        const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');

        // 2. Read and parse libraryfolders.vdf
        const libraryPaths: string[] = [steamPath];
        try {
            const vdfContent = await fs.readFile(libraryFoldersPath, 'utf-8');
            const libraryFoldersData = parse(vdfContent) as { libraryfolders: LibraryFolders };

            if (libraryFoldersData.libraryfolders) {
                Object.values(libraryFoldersData.libraryfolders).forEach(folder => {
                    if (folder.path) {
                        libraryPaths.push(folder.path.replace(/\\\\/g, '\\'));
                    }
                });
            }
        } catch (error) {
            console.warn(`[SteamUtils] Could not read or parse libraryfolders.vdf. Only the main library will be scanned.`, error);
        }

        // 3. Scan each library folder for appmanifest files
        for (const libraryPath of [...new Set(libraryPaths)]) { // Use Set to remove duplicate paths
            const steamAppsFolder = path.join(libraryPath, 'steamapps');
            try {
                const files = await fs.readdir(steamAppsFolder);
                files.forEach(file => {
                    const match = file.match(/^appmanifest_(\d+)\.acf$/);
                    if (match && match[1]) {
                        installedAppIds.add(parseInt(match[1], 10));
                    }
                });
            } catch (error) {
                // This is expected if a library folder is on a disconnected drive, for example.
                console.warn(`[SteamUtils] Could not read directory: ${steamAppsFolder}. It might be on a disconnected drive.`);
            }
        }

    } catch (error) {
        console.error('[SteamUtils] Failed to get installed Steam games:', error);
    }

    console.log(`[API/STEAM/GAMES] Found ${installedAppIds.size} installed games on local drives.`);
    return installedAppIds;
}
