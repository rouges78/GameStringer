import { NextRequest, NextResponse } from 'next/server';
import { patchManager } from '@/lib/patch-manager';

export async function GET(request: NextRequest) {
  try {
    await patchManager.initialize();
    
    const { searchParams } = new URL(request.url);
    const patchId = searchParams.get('id');
    
    if (patchId) {
      // Ottieni una patch specifica
      const patch = await patchManager.getPatch(patchId);
      if (!patch) {
        return NextResponse.json({ error: 'Patch non trovata' }, { status: 404 });
      }
      return NextResponse.json(patch);
    } else {
      // Ottieni tutte le patch
      const patches = await patchManager.getAllPatches();
      return NextResponse.json(patches);
    }
  } catch (error) {
    console.error('Errore nel recuperare le patch:', error);
    return NextResponse.json(
      { error: 'Errore nel recuperare le patch' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await patchManager.initialize();
    
    const body = await request.json();
    const { options, translations } = body;
    
    if (!options || !translations) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      );
    }
    
    const patch = await patchManager.createPatch(options, translations);
    
    return NextResponse.json(patch, { status: 201 });
  } catch (error) {
    console.error('Errore nella creazione della patch:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione della patch' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await patchManager.initialize();
    
    const { searchParams } = new URL(request.url);
    const patchId = searchParams.get('id');
    
    if (!patchId) {
      return NextResponse.json(
        { error: 'ID patch mancante' },
        { status: 400 }
      );
    }
    
    const updates = await request.json();
    const updatedPatch = await patchManager.updatePatch(patchId, updates);
    
    if (!updatedPatch) {
      return NextResponse.json(
        { error: 'Patch non trovata' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedPatch);
  } catch (error) {
    console.error('Errore nell\'aggiornamento della patch:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento della patch' },
      { status: 500 }
    );
  }
}
