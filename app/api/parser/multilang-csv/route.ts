import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

// Definiamo le lingue che ci aspettiamo di trovare nell'header e i loro nomi puliti
const LANGUAGE_MAP: { [key: string]: string } = {
    'FRENCH🔒': 'French',
    'ENGLISH🔒': 'English',
    'GERMAN': 'German',
    'SPANISH': 'Spanish',
    'PORTUGUESE': 'Portuguese',
    'POLISH': 'Polish',
    'CHINESE': 'Chinese',
    'JAPANESE': 'Japanese',
    'ITALIAN': 'Italian', // Aggiungiamo l'italiano per completezza futura
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const fileContent = body.content;

        if (!fileContent) {
            return NextResponse.json({ error: 'Nessun contenuto del file fornito.' }, { status: 400 });
        }

        const parsed = Papa.parse(fileContent, { header: false });
        const rows = parsed.data as string[][];

        if (rows.length < 2) {
            return NextResponse.json({ error: 'Il file CSV è vuoto o non valido.' }, { status: 400 });
        }

        const header = rows[0];
        const languageColumns: { index: number; name: string }[] = [];
        
        header.forEach((col, index) => {
            if (LANGUAGE_MAP[col.trim()]) {
                languageColumns.push({ index, name: LANGUAGE_MAP[col.trim()] });
            }
        });

        const stringKeyIndex = 1; // L'ID della stringa è nella seconda colonna (es. G2U_ID🔒)
        const strings: { [key: string]: { [lang: string]: string } } = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const key = row[stringKeyIndex]?.trim();

            if (key && row.length >= header.length) {
                strings[key] = {};
                languageColumns.forEach(langCol => {
                    strings[key][langCol.name] = row[langCol.index] || '';
                });
            }
        }

        return NextResponse.json({
            languages: languageColumns.map(l => l.name),
            strings,
        });

    } catch (error: any) {
        console.error('Errore nel parser CSV:', error);
        return NextResponse.json({ error: "Errore interno durante l'analisi del file." }, { status: 500 });
    }
}
