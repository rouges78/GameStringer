import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as deepl from 'deepl-node';
import { Translate } from '@google-cloud/translate/build/src/v2';

// Funzione di utility per la traduzione con OpenAI
async function translateWithOpenAI(text: string, apiKey: string, targetLang: string) {
    const openai = new OpenAI({ apiKey });
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional video game translator. Translate the following text to ${targetLang}. Maintain the original tone and context. Preserve any variables like {player_name} or %s. Provide only the translated text.`
                },
                {
                    role: "user",
                    content: text,
                }
            ],
            temperature: 0.3,
        });
        return response.choices[0].message.content;
    } catch (error: any) {
        console.error("[OpenAI Error]", error);
        // Rilancia l'errore per una gestione centralizzata
        throw new Error("OpenAI API key not valid or request failed.");
    }
}

// Funzione di utility per la traduzione con DeepL
async function translateWithDeepL(text: string, apiKey: string, targetLang: deepl.TargetLanguageCode) {
    const translator = new deepl.Translator(apiKey);
    const result = await translator.translateText(text, null, targetLang);
    return result.text;
}

// Funzione di utility per la traduzione con Google Translate
async function translateWithGoogle(text: string, apiKey: string, targetLang: string) {
    const translate = new Translate({ key: apiKey });
    const [translation] = await translate.translate(text, targetLang);
    return translation;
}

export async function POST(req: NextRequest) {
    let provider: string | undefined;
    try {
        const { text, provider: reqProvider, apiKey, targetLang = 'it' } = await req.json();
        provider = reqProvider; // Assegna a una variabile con scope più ampio

        if (!text || !provider || !apiKey) {
            return NextResponse.json({ error: 'Parametri mancanti: sono richiesti testo, provider e chiave API.' }, { status: 400 });
        }

        let translatedText: string | null | undefined;

        switch (provider) {
            case 'openai':
                translatedText = await translateWithOpenAI(text, apiKey, targetLang);
                break;
            case 'deepl':
                translatedText = await translateWithDeepL(text, apiKey, targetLang as deepl.TargetLanguageCode);
                break;
            case 'google':
                translatedText = await translateWithGoogle(text, apiKey, targetLang);
                break;
            default:
                return NextResponse.json({ error: 'Provider di traduzione non valido.' }, { status: 400 });
        }

        if (translatedText === null || translatedText === undefined) {
             throw new Error('La traduzione non ha prodotto un risultato.');
        }

        return NextResponse.json({ translatedText });

    } catch (error: any) {
        console.error(`[ERRORE TRADUZIONE] Provider: ${provider || 'Sconosciuto'}`, error);
        
        let errorMessage = 'Si è verificato un errore sconosciuto durante la traduzione.';
        if (error instanceof deepl.AuthorizationError) {
            errorMessage = 'Autenticazione fallita con DeepL. La chiave API non è valida.';
        } else if (error.message?.includes('API key not valid') || error.message?.includes('Incorrect API key')) {
            errorMessage = 'Autenticazione fallita. La chiave API non è corretta.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
