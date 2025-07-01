import { NextRequest, NextResponse } from 'next/server';
import { patchManager } from '@/lib/patch-manager';
import { promises as fs } from 'fs';

export async function POST(request: NextRequest) {
  try {
    await patchManager.initialize();
    
    const body = await request.json();
    const { patchId, options } = body;
    
    if (!patchId || !options) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      );
    }
    
    // Esporta la patch
    const outputPath = await patchManager.exportPatch(patchId, options);
    
    // Leggi il file esportato
    const fileBuffer = await fs.readFile(outputPath);
    const fileName = outputPath.split('/').pop() || 'patch.zip';
    
    // Pulisci il file temporaneo
    await fs.unlink(outputPath);
    
    // Restituisci il file come download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Errore nell\'export della patch:', error);
    return NextResponse.json(
      { error: 'Errore nell\'export della patch' },
      { status: 500 }
    );
  }
}
