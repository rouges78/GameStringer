import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';

interface DetectedGame {
  name: string;
  dataPath: string;
  appId: string;
  inkBlobs: number;
  assetsFiles: number;
  size: string;
}

const STEAM_PATHS = [
  'C:\\Program Files (x86)\\Steam\\steamapps\\common',
  'C:\\Program Files\\Steam\\steamapps\\common',
  'D:\\SteamLibrary\\steamapps\\common',
  'E:\\SteamLibrary\\steamapps\\common',
  'F:\\SteamLibrary\\steamapps\\common',
  'G:\\SteamLibrary\\steamapps\\common',
];

export const GET = withErrorHandler(async function() {
  const games: DetectedGame[] = [];

  // Also check libraryfolders.vdf for additional Steam library paths
  const extraPaths = findSteamLibraryFolders();
  const allPaths = [...new Set([...STEAM_PATHS, ...extraPaths])];

  for (const steamPath of allPaths) {
    if (!fs.existsSync(steamPath)) continue;

    let entries: string[];
    try {
      entries = fs.readdirSync(steamPath);
    } catch { /* fs read error — skip directory */ continue; }

    for (const entry of entries) {
      const gamePath = path.join(steamPath, entry);

      let stat;
      try { stat = fs.statSync(gamePath); } catch { /* fs read error — skip directory */ continue; }
      if (!stat.isDirectory()) continue;

      // Look for _Data folder (Unity signature)
      const dataFolders = findDataFolder(gamePath, entry);

      for (const dataPath of dataFolders) {
        const inkCount = countInkBlobs(dataPath);
        if (inkCount.blobs > 0) {
          // Try to find appId from steam_appid.txt
          let appId = '';
          const appIdFile = path.join(gamePath, 'steam_appid.txt');
          if (fs.existsSync(appIdFile)) {
            try { appId = fs.readFileSync(appIdFile, 'utf-8').trim(); } catch {}
          }

          const dirSize = getDirSizeApprox(dataPath);

          games.push({
            name: entry,
            dataPath,
            appId,
            inkBlobs: inkCount.blobs,
            assetsFiles: inkCount.files,
            size: formatSize(dirSize),
          });
        }
      }
    }
  }

  return NextResponse.json({
    games,
    scannedPaths: allPaths.filter(p => fs.existsSync(p)),
    totalFound: games.length
  });
});

function findSteamLibraryFolders(): string[] {
  const paths: string[] = [];
  const vdfLocations = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf',
    'C:\\Program Files\\Steam\\steamapps\\libraryfolders.vdf',
  ];

  for (const vdf of vdfLocations) {
    if (!fs.existsSync(vdf)) continue;
    try {
      const content = fs.readFileSync(vdf, 'utf-8');
      const matches = content.match(/"path"\s+"([^"]+)"/g);
      if (matches) {
        for (const m of matches) {
          const p = m.match(/"path"\s+"([^"]+)"/)?.[1];
          if (p) {
            const commonPath = path.join(p.replace(/\\\\/g, '\\'), 'steamapps', 'common');
            paths.push(commonPath);
          }
        }
      }
    } catch {}
  }
  return paths;
}

function findDataFolder(gamePath: string, gameName: string): string[] {
  const results: string[] = [];

  // Pattern 1: GameName_Data
  const dataDir = path.join(gamePath, `${gameName}_Data`);
  if (fs.existsSync(dataDir)) results.push(dataDir);

  // Pattern 2: Look for any *_Data folder
  try {
    const entries = fs.readdirSync(gamePath);
    for (const e of entries) {
      if (e.endsWith('_Data') && !results.includes(path.join(gamePath, e))) {
        const full = path.join(gamePath, e);
        try {
          if (fs.statSync(full).isDirectory()) results.push(full);
        } catch {}
      }
    }
  } catch {}

  return results;
}

function countInkBlobs(dataPath: string): { blobs: number; files: number } {
  const inkMarker = Buffer.from('inkVersion');
  let totalBlobs = 0;
  let totalFiles = 0;

  let entries: string[];
  try { entries = fs.readdirSync(dataPath); } catch { return { blobs: 0, files: 0 }; }

  const targets = entries.filter(f =>
    (f.startsWith('sharedassets') && f.endsWith('.assets')) ||
    /^level\d+$/.test(f)
  );

  for (const f of targets) {
    const fp = path.join(dataPath, f);
    try {
      const data = fs.readFileSync(fp);
      let idx = 0;
      let found = false;
      while (true) {
        idx = data.indexOf(inkMarker, idx);
        if (idx === -1) break;
        totalBlobs++;
        found = true;
        idx += 10;
      }
      if (found) totalFiles++;
    } catch {}
  }

  return { blobs: totalBlobs, files: totalFiles };
}

function getDirSizeApprox(dirPath: string): number {
  let total = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const f of files.slice(0, 100)) {
      try {
        const s = fs.statSync(path.join(dirPath, f));
        if (s.isFile()) total += s.size;
      } catch {}
    }
  } catch {}
  return total;
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}
