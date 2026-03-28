import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';

export const POST = withErrorHandler(async function(req: NextRequest) {
  const { gameDir } = await req.json();

  if (!gameDir || !fs.existsSync(gameDir)) {
    return NextResponse.json({ error: 'Cartella non trovata' }, { status: 400 });
  }

  // Detect game name from folder
  const dirName = path.basename(gameDir);
  const gameName = dirName.replace(/_Data$/, '').replace(/_/g, ' ');

  // Count assets files with Ink blobs
  const files = fs.readdirSync(gameDir);
  const assetsFiles = files.filter(f => f.startsWith('sharedassets') && f.endsWith('.assets'));
  const levelFiles = files.filter(f => /^level\d+$/.test(f));

  let inkBlobCount = 0;
  const inkMarker = Buffer.from('inkVersion');

  for (const f of [...assetsFiles, ...levelFiles]) {
    const fp = path.join(gameDir, f);
    try {
      const data = fs.readFileSync(fp);
      let idx = 0;
      while (true) {
        idx = data.indexOf(inkMarker, idx);
        if (idx === -1) break;
        inkBlobCount++;
        idx += 1;
      }
    } catch { /* skip unreadable files */ }
  }

  if (inkBlobCount === 0) {
    return NextResponse.json({
      error: 'Nessun blob Ink trovato. Assicurati che sia un gioco Unity con storie Ink.'
    });
  }

  return NextResponse.json({
    gameName,
    assetsCount: assetsFiles.length + levelFiles.length,
    inkBlobCount,
    assetsFiles: assetsFiles.map(f => f),
    levelFiles: levelFiles.map(f => f),
  });
});
