import { NextRequest, NextResponse } from 'next/server';

// GET /api/translations/export - Export translations in various formats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const format = searchParams.get('format') || 'json';
    const status = searchParams.get('status');

    if (!gameId || gameId === 'all') {
      return NextResponse.json({ error: 'Game ID is required for export' }, { status: 400 });
    }

    // Fetch translations from the main endpoint (in production, use shared storage)
    const baseUrl = request.nextUrl.origin;
    const params = new URLSearchParams();
    params.append('gameId', gameId);
    if (status && status !== 'all') params.append('status', status);

    const response = await fetch(`${baseUrl}/api/translations?${params}`);
    const translations = await response.json();

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = exportToCSV(translations);
        contentType = 'text/csv';
        filename = `translations-${gameId}.csv`;
        break;
      case 'po':
        content = exportToPO(translations);
        contentType = 'text/x-gettext-translation';
        filename = `translations-${gameId}.po`;
        break;
      case 'json':
      default:
        content = JSON.stringify(translations, null, 2);
        contentType = 'application/json';
        filename = `translations-${gameId}.json`;
        break;
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting translations:', error);
    return NextResponse.json({ error: 'Failed to export translations' }, { status: 500 });
  }
}

function exportToCSV(translations: any[]): string {
  const headers = ['id', 'originalText', 'translatedText', 'sourceLanguage', 'targetLanguage', 'status', 'confidence'];
  const rows = translations.map(t => [
    t.id,
    `"${(t.originalText || '').replace(/"/g, '""')}"`,
    `"${(t.translatedText || '').replace(/"/g, '""')}"`,
    t.sourceLanguage || 'en',
    t.targetLanguage || 'it',
    t.status || 'pending',
    t.confidence || 0
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function exportToPO(translations: any[]): string {
  const header = `# Translation file exported from GameStringer
# Generated: ${new Date().toISOString()}
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"

`;

  const entries = translations.map(t => {
    const originalText = (t.originalText || '').replace(/"/g, '\\"');
    const translatedText = (t.translatedText || '').replace(/"/g, '\\"');
    return `#: ${t.filePath || 'unknown'}
msgid "${originalText}"
msgstr "${translatedText}"
`;
  });

  return header + entries.join('\n');
}
