import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';

// POST /api/translations/suggestions - Generate real AI suggestions from multiple providers
export const POST = withErrorHandler(async function(request: NextRequest) {
  const body = await request.json();
  const { translationId, originalText, targetLanguage, sourceLanguage = 'auto', provider } = body;

  if (!originalText) {
    return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
  }

  const target = targetLanguage || 'it';
  const baseUrl = request.nextUrl.origin; // http://127.0.0.1:3199

  // Chiedi traduzioni a più provider in parallelo
  const providers = ['libre', 'mock'];
  if (provider && !providers.includes(provider)) {
    providers.unshift(provider); // Aggiungi il provider dell'utente in testa
  }

  const results = await Promise.allSettled(
    providers.map(async (prov) => {
      const res = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          targetLanguage: target,
          sourceLanguage,
          provider: prov,
        }),
      });
      if (!res.ok) throw new Error(`Provider ${prov} errore: ${res.status}`);
      const data = await res.json();
      return { ...data, usedProvider: prov };
    })
  );

  const suggestions: Array<{
    id: string;
    suggestion: string;
    confidence: number;
    provider: string;
  }> = [];
  const seen = new Set<string>();

  for (const [i, result] of results.entries()) {
    if (result.status !== 'fulfilled') continue;
    const data = result.value;
    const text = data.translatedText || '';
    const conf = data.confidence || 0.5;
    const prov = data.provider || data.usedProvider || providers[i];

    // Aggiungi traduzione principale se non duplicata
    if (text && text !== originalText && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      suggestions.push({
        id: `sug-${Date.now()}-${suggestions.length}`,
        suggestion: text,
        confidence: conf,
        provider: prov,
      });
    }

    // Aggiungi suggerimenti alternativi dal provider
    if (Array.isArray(data.suggestions)) {
      for (const alt of data.suggestions) {
        const altText = typeof alt === 'string' ? alt : alt?.suggestion || alt?.text || '';
        if (
          altText &&
          altText !== originalText &&
          !altText.startsWith('⚠') &&
          !altText.startsWith('💡') &&
          !altText.startsWith('🔧') &&
          !altText.startsWith('📝') &&
          !seen.has(altText.toLowerCase())
        ) {
          seen.add(altText.toLowerCase());
          suggestions.push({
            id: `sug-${Date.now()}-${suggestions.length}`,
            suggestion: altText,
            confidence: conf * 0.85,
            provider: `${prov} (alt)`,
          });
        }
      }
    }
  }

  // Ordina per confidence decrescente
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json(suggestions.slice(0, 8));
});
