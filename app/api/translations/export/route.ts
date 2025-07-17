import { NextRequest, NextResponse } from 'next/server';
import { getTranslationsBatch } from '@/lib/db-queries';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const format = searchParams.get('format') || 'json';
    const status = searchParams.get('status');
    const targetLanguage = searchParams.get('targetLanguage');

    if (!gameId) {
      return NextResponse.json(
        { error: 'Missing gameId parameter' },
        { status: 400 }
      );
    }

    // Get all translations for the game (no pagination for export)
    const result = await getTranslationsBatch({
      gameId,
      status: status || undefined,
      targetLanguage: targetLanguage || undefined,
      take: 10000 // Large number to get all translations
    });

    const { translations } = result;

    // Generate export data based on format
    let exportData: any;
    let contentType: string;
    let filename: string;

    switch (format.toLowerCase()) {
      case 'csv':
        exportData = generateCSVExport(translations);
        contentType = 'text/csv';
        filename = `translations_${gameId}.csv`;
        break;
      
      case 'json':
        exportData = JSON.stringify(translations, null, 2);
        contentType = 'application/json';
        filename = `translations_${gameId}.json`;
        break;
      
      case 'xml':
        exportData = generateXMLExport(translations);
        contentType = 'application/xml';
        filename = `translations_${gameId}.xml`;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Unsupported format. Use: json, csv, or xml' },
          { status: 400 }
        );
    }

    // Set headers for file download
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });

    return new NextResponse(exportData, { headers });

  } catch (error) {
    console.error('Error exporting translations:', error);
    return NextResponse.json(
      { error: 'Failed to export translations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, format = 'json', options = {} } = body;

    if (!gameId) {
      return NextResponse.json(
        { error: 'Missing gameId' },
        { status: 400 }
      );
    }

    // Get game info
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        translations: {
          include: {
            suggestions: {
              orderBy: { confidence: 'desc' },
              take: 3
            }
          },
          orderBy: { filePath: 'asc' }
        }
      }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Generate comprehensive export
    const exportData = {
      game: {
        id: game.id,
        title: game.title,
        platform: game.platform,
        steamAppId: game.steamAppId,
        exportDate: new Date().toISOString(),
        totalTranslations: game.translations.length
      },
      translations: game.translations.map(t => ({
        id: t.id,
        filePath: t.filePath,
        originalText: t.originalText,
        translatedText: t.translatedText,
        targetLanguage: t.targetLanguage,
        sourceLanguage: t.sourceLanguage,
        status: t.status,
        confidence: t.confidence,
        isManualEdit: t.isManualEdit,
        context: t.context,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        suggestions: options.includeSuggestions ? t.suggestions : undefined
      }))
    };

    // Format based on requested format
    let formattedData: string;
    let contentType: string;
    let filename: string;

    switch (format.toLowerCase()) {
      case 'csv':
        formattedData = generateCSVExport(exportData.translations);
        contentType = 'text/csv';
        filename = `${game.title.replace(/[^a-zA-Z0-9]/g, '_')}_translations.csv`;
        break;
      
      case 'json':
        formattedData = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename = `${game.title.replace(/[^a-zA-Z0-9]/g, '_')}_translations.json`;
        break;
      
      case 'xml':
        formattedData = generateXMLExport(exportData.translations, game.title);
        contentType = 'application/xml';
        filename = `${game.title.replace(/[^a-zA-Z0-9]/g, '_')}_translations.xml`;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Unsupported format. Use: json, csv, or xml' },
          { status: 400 }
        );
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });

    return new NextResponse(formattedData, { headers });

  } catch (error) {
    console.error('Error exporting translations:', error);
    return NextResponse.json(
      { error: 'Failed to export translations' },
      { status: 500 }
    );
  }
}

function generateCSVExport(translations: any[]): string {
  const headers = [
    'ID',
    'File Path',
    'Original Text',
    'Translated Text',
    'Target Language',
    'Source Language',
    'Status',
    'Confidence',
    'Manual Edit',
    'Context',
    'Created At',
    'Updated At'
  ];

  const csvRows = [headers.join(',')];

  translations.forEach(t => {
    const row = [
      t.id,
      `"${t.filePath}"`,
      `"${t.originalText.replace(/"/g, '""')}"`,
      `"${t.translatedText.replace(/"/g, '""')}"`,
      t.targetLanguage,
      t.sourceLanguage,
      t.status,
      t.confidence,
      t.isManualEdit,
      `"${(t.context || '').replace(/"/g, '""')}"`,
      t.createdAt,
      t.updatedAt
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

function generateXMLExport(translations: any[], gameTitle?: string): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const rootOpen = `<translations${gameTitle ? ` game="${gameTitle}"` : ''} exportDate="${new Date().toISOString()}">\n`;
  const rootClose = '</translations>';

  const xmlContent = translations.map(t => `
  <translation id="${t.id}">
    <filePath>${escapeXML(t.filePath)}</filePath>
    <originalText>${escapeXML(t.originalText)}</originalText>
    <translatedText>${escapeXML(t.translatedText)}</translatedText>
    <targetLanguage>${t.targetLanguage}</targetLanguage>
    <sourceLanguage>${t.sourceLanguage}</sourceLanguage>
    <status>${t.status}</status>
    <confidence>${t.confidence}</confidence>
    <isManualEdit>${t.isManualEdit}</isManualEdit>
    <context>${escapeXML(t.context || '')}</context>
    <createdAt>${t.createdAt}</createdAt>
    <updatedAt>${t.updatedAt}</updatedAt>
  </translation>`).join('\n');

  return xmlHeader + rootOpen + xmlContent + '\n' + rootClose;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}