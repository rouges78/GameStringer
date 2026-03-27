import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { progressMap } from '../translate/route';

export const GET = withErrorHandler(async function(req: NextRequest) {
  const gameDir = req.nextUrl.searchParams.get('gameDir');

  if (!gameDir) {
    return NextResponse.json({ error: 'gameDir richiesto' }, { status: 400 });
  }

  // Check in-memory progress first
  const memProgress = progressMap.get(gameDir);
  if (memProgress) {
    return NextResponse.json(memProgress);
  }

  // Fallback to file-based progress
  const progressPath = path.join(gameDir, '_gamestringer', 'translate_progress.json');
  if (fs.existsSync(progressPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ status: 'idle', done: 0, total: 0, errors: 0, rate: 0, eta: 0 });
    }
  }

  return NextResponse.json({ status: 'idle', done: 0, total: 0, errors: 0, rate: 0, eta: 0 });
});
