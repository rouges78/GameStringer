import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
    let filePath: string | undefined;
    try {
        const body = await req.json();
        filePath = body.filePath;

        if (!filePath || typeof filePath !== 'string') {
            return NextResponse.json({ error: '`filePath` è richiesto e deve essere una stringa.' }, { status: 400 });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        
        return NextResponse.json({ content });

    } catch (error: any) {
        console.error('Errore API in read-file:', error);
        if (error.code === 'ENOENT') {
             return NextResponse.json({ error: `File non trovato: ${filePath}` }, { status: 404 });
        }
        return NextResponse.json({ error: 'Errore interno del server durante la lettura del file' }, { status: 500 });
    }
}
