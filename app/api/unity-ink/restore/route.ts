import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';

export const POST = withErrorHandler(async function(req: NextRequest) {
  const { gameDir } = await req.json();

  if (!gameDir || !fs.existsSync(gameDir)) {
    return NextResponse.json({ error: 'Cartella gioco non trovata' }, { status: 400 });
  }

  const files = fs.readdirSync(gameDir);
  const backups = files.filter(f => f.endsWith('.backup'));

  if (backups.length === 0) {
    return NextResponse.json({ message: 'Nessun backup trovato da ripristinare.' });
  }

  let restored = 0;
  for (const backup of backups) {
    const original = backup.replace('.backup', '');
    const backupPath = path.join(gameDir, backup);
    const originalPath = path.join(gameDir, original);

    try {
      fs.copyFileSync(backupPath, originalPath);
      restored++;
    } catch (e: any) {
      console.error(`Errore ripristino ${backup}: ${e.message}`);
    }
  }

  return NextResponse.json({
    message: `Ripristinati ${restored}/${backups.length} file originali.`,
    restored,
    total: backups.length
  });
});
