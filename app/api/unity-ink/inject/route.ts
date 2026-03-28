import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const POST = withErrorHandler(async function(req: NextRequest) {
  const { gameDir } = await req.json();

  if (!gameDir || !fs.existsSync(gameDir)) {
    return NextResponse.json({ error: 'Cartella gioco non trovata' }, { status: 400 });
  }

  const gsDir = path.join(gameDir, '_gamestringer');
  const translationsPath = path.join(gsDir, 'translations.json');

  if (!fs.existsSync(translationsPath)) {
    return NextResponse.json({ error: 'Nessuna traduzione trovata. Esegui prima la traduzione.' }, { status: 400 });
  }

  // Load translations and write as CSV for the C# tool
  const translations: Record<string, string> = JSON.parse(fs.readFileSync(translationsPath, 'utf-8'));
  const csvPath = path.join(gsDir, 'inject_translations.csv');

  // Write CSV
  const lines = ['english,italian'];
  for (const [eng, ita] of Object.entries(translations)) {
    if (eng && ita) {
      const escEng = `"${eng.replace(/"/g, '""')}"`;
      const escIta = `"${ita.replace(/"/g, '""')}"`;
      lines.push(`${escEng},${escIta}`);
    }
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');

  // Also check if there are pre-existing translation CSVs to merge
  const toolsDir = path.resolve(process.cwd(), 'tools');
  const inkCsv = path.join(toolsDir, 'esoteric_ebb_strings', 'ink_strings', 'translated', 'ink_translations.csv');
  const levelCsv = path.join(toolsDir, 'esoteric_ebb_strings', 'level_strings', 'translated', 'level_translations.csv');

  // Try to run the C# InjectInk tool
  const injectDir = path.resolve(process.cwd(), 'tools', 'assetstools_inject', 'InjectInk');
  const csproj = path.join(injectDir, 'InjectInk.csproj');

  if (!fs.existsSync(csproj)) {
    return NextResponse.json({
      error: 'Tool InjectInk non trovato. Assicurati che tools/assetstools_inject/InjectInk esista.'
    }, { status: 500 });
  }

  // Run dotnet tool
  try {
    const output = execSync('dotnet run --configuration Debug', {
      cwd: injectDir,
      timeout: 300000, // 5 min timeout
      encoding: 'utf-8',
      env: { ...process.env },
    });

    // Parse output for stats
    const filesMatch = output.match(/Files processed: (\d+)\/(\d+)/);
    const storiesMatch = output.match(/Stories modified: (\d+)/);
    const replacementsMatch = output.match(/Total replacements: (\d+)/);

    return NextResponse.json({
      filesProcessed: filesMatch ? parseInt(filesMatch[1]) : 0,
      totalFiles: filesMatch ? parseInt(filesMatch[2]) : 0,
      storiesModified: storiesMatch ? parseInt(storiesMatch[1]) : 0,
      totalReplacements: replacementsMatch ? parseInt(replacementsMatch[1]) : 0,
      output: output.substring(0, 2000),
    });
  } catch (e: unknown) {
    return NextResponse.json({
      error: `Errore InjectInk: ${e.stderr?.substring(0, 500) || e.message}`
    }, { status: 500 });
  }
});
