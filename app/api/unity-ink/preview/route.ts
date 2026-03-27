import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';

export const GET = withErrorHandler(async function(req: NextRequest) {
  const gameDir = req.nextUrl.searchParams.get('gameDir');
  const page = parseInt(req.nextUrl.searchParams.get('page') || '0');
  const search = req.nextUrl.searchParams.get('search') || '';
  const pageSize = 20;

  if (!gameDir) {
    return NextResponse.json({ error: 'gameDir richiesto' }, { status: 400 });
  }

  const gsDir = path.join(gameDir, '_gamestringer');
  const stringsPath = path.join(gsDir, 'extracted_strings.json');
  const translationsPath = path.join(gsDir, 'translations.json');

  if (!fs.existsSync(stringsPath)) {
    return NextResponse.json({ error: 'Stringhe non estratte', pairs: [], stats: null });
  }

  const strings: string[] = JSON.parse(fs.readFileSync(stringsPath, 'utf-8'));

  let translations: Record<string, string> = {};
  if (fs.existsSync(translationsPath)) {
    translations = JSON.parse(fs.readFileSync(translationsPath, 'utf-8'));
  }

  // Stats
  const totalStrings = strings.length;
  const translatedCount = strings.filter(s => translations[s]).length;
  const coverage = totalStrings > 0 ? Math.round((translatedCount / totalStrings) * 100) : 0;

  // Length distribution
  const shortCount = strings.filter(s => s.length < 20).length;
  const mediumCount = strings.filter(s => s.length >= 20 && s.length < 80).length;
  const longCount = strings.filter(s => s.length >= 80).length;

  // Filter by search
  let filtered = strings.map(s => ({
    english: s,
    italian: translations[s] || '',
    translated: !!translations[s],
  }));

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.english.toLowerCase().includes(q) ||
      p.italian.toLowerCase().includes(q)
    );
  }

  // Paginate
  const totalPages = Math.ceil(filtered.length / pageSize);
  const pairs = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return NextResponse.json({
    pairs,
    stats: {
      totalStrings,
      translatedCount,
      untranslatedCount: totalStrings - translatedCount,
      coverage,
      shortCount,
      mediumCount,
      longCount,
    },
    pagination: {
      page,
      pageSize,
      totalPages,
      totalFiltered: filtered.length,
    }
  });
});
