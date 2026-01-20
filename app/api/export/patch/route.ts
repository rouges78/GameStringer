import { NextRequest, NextResponse } from 'next/server';
import { exportPatchZip, exportGSTranslation, TranslatedFile, PatchMetadata } from '@/lib/patch-exporter';

interface ExportRequest {
  files: TranslatedFile[];
  metadata: PatchMetadata;
  format: 'zip' | 'xunity' | 'gstranslation';
  options?: {
    includeBackup?: boolean;
    includeReadme?: boolean;
    includeMetadata?: boolean;
    xunityFormat?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { files, metadata, format, options } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (!metadata || !metadata.gameName) {
      return NextResponse.json(
        { error: 'Missing metadata' },
        { status: 400 }
      );
    }

    let blob: Blob;
    let filename: string;
    let contentType: string;

    switch (format) {
      case 'zip':
        blob = await exportPatchZip(files, metadata, {
          ...options,
          xunityFormat: options?.xunityFormat ?? true
        });
        filename = `${sanitizeFilename(metadata.gameName)}_${metadata.targetLanguage}_patch.zip`;
        contentType = 'application/zip';
        break;

      case 'gstranslation':
        blob = await exportGSTranslation(files, metadata);
        filename = `${sanitizeFilename(metadata.gameName)}_${metadata.targetLanguage}.gstranslation`;
        contentType = 'application/x-gstranslation';
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported format: ${format}` },
          { status: 400 }
        );
    }

    // Converti Blob in ArrayBuffer per la risposta
    const arrayBuffer = await blob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': arrayBuffer.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('[EXPORT API] Error:', error);
    return NextResponse.json(
      { error: 'Export failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}
