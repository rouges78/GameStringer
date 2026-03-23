import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { gameDir } = await req.json();
    
    if (!gameDir || !fs.existsSync(gameDir)) {
      return NextResponse.json({ error: 'Cartella non trovata' }, { status: 400 });
    }

    const files = fs.readdirSync(gameDir);
    const targetFiles = [
      ...files.filter(f => f.startsWith('sharedassets') && f.endsWith('.assets')),
      ...files.filter(f => /^level\d+$/.test(f)),
    ];

    const inkMarker = Buffer.from('inkVersion');
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const allStrings = new Set<string>();
    let totalBlobs = 0;
    let totalCarets = 0;
    let totalFiles = 0;

    for (const f of targetFiles) {
      const fp = path.join(gameDir, f);
      let data: Buffer;
      try {
        data = fs.readFileSync(fp);
      } catch { continue; }

      // Find Ink blobs
      const seenLp = new Set<number>();
      let idx = 0;
      let fileHasInk = false;

      while (true) {
        idx = data.indexOf(inkMarker, idx);
        if (idx === -1) break;

        // Scan backward for BOM
        for (let back = 1; back < 300; back++) {
          const off = idx - back;
          if (off < 0) break;
          if (data[off] === bom[0] && data[off + 1] === bom[1] && data[off + 2] === bom[2]) {
            const lpOff = off - 4;
            if (lpOff >= 0 && !seenLp.has(lpOff)) {
              const lp = data.readUInt32LE(lpOff);
              const bs = lpOff + 4;
              const be = bs + lp;
              if (lp > 50 && be <= data.length) {
                seenLp.add(lpOff);
                totalBlobs++;
                fileHasInk = true;

                // Extract caret strings from blob
                const blob = data.subarray(bs, be);
                try {
                  const blobStr = blob.toString('utf-8');
                  const regex = /"\^([^"]*)"/g;
                  let match;
                  while ((match = regex.exec(blobStr)) !== null) {
                    const text = match[1].trim();
                    totalCarets++;
                    if (text.length >= 3 && isDisplayText(text)) {
                      allStrings.add(text);
                    }
                  }
                } catch { /* skip decode errors */ }
              }
            }
            break;
          }
        }
        idx += 1;
      }

      if (fileHasInk) totalFiles++;
    }

    // Save extracted strings to a JSON file for later use
    const outputDir = path.join(gameDir, '_gamestringer');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const stringsArray = Array.from(allStrings);
    const outputPath = path.join(outputDir, 'extracted_strings.json');
    fs.writeFileSync(outputPath, JSON.stringify(stringsArray, null, 2), 'utf-8');

    return NextResponse.json({
      totalFiles,
      totalBlobs,
      totalCarets,
      uniqueStrings: allStrings.size,
      extractedPath: outputPath,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function isDisplayText(text: string): boolean {
  if (text.startsWith('->')) return false;
  if (text.startsWith('.') && (/[=<>_]/.test(text))) return false;
  if (/^[A-Z_0-9]+$/.test(text)) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (text.length <= 3 && !text.includes(' ')) return false;
  if (text === '\\n' || text === '\n') return false;
  return true;
}
