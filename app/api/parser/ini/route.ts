import { NextRequest, NextResponse } from 'next/server';
import ini from 'ini';

export async function POST(req: NextRequest) {
    try {
        const { content } = await req.json();

        if (typeof content !== 'string') {
            return NextResponse.json({ error: 'Contenuto non valido' }, { status: 400 });
        }

        const parsedData = ini.parse(content);

        // Filtriamo per restituire solo le coppie chiave-valore semplici (stringhe)
        const stringValues: { [key: string]: string } = {};
        for (const section in parsedData) {
            if (typeof parsedData[section] === 'object') {
                for (const key in parsedData[section]) {
                    if (typeof parsedData[section][key] === 'string') {
                         // @ts-ignore
                        stringValues[`${section}.${key}`] = parsedData[section][key];
                    }
                }
            } else if (typeof parsedData[section] === 'string') {
                 // @ts-ignore
                stringValues[section] = parsedData[section];
            }
        }

        return NextResponse.json({ strings: stringValues });

    } catch (error: any) {
        console.error('Errore nel parser INI:', error);
        return NextResponse.json({ error: "Errore interno durante l'analisi del file INI." }, { status: 500 });
    }
}
