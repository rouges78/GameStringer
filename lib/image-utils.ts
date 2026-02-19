/**
 * Utility per convertire RGBA/BGRA raw pixel data in Base64 (PNG/JPEG) 
 * nel frontend quando l'API Rust ritorna solo i byte grezzi.
 */

export function rawPixelsToBase64(
  data: Uint8Array | number[],
  width: number,
  height: number
): string {
  // Crea un canvas offscreen
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile ottenere il contesto 2D del canvas');

  // Crea l'oggetto ImageData (assume formato RGBA)
  // Nota: se Rust restituisce BGRA (comune su Windows), dobbiamo swappare i canali R e B
  const imageData = ctx.createImageData(width, height);
  const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
  
  // Windows capture di solito è BGRA. Convertiamo in RGBA per il canvas.
  for (let i = 0; i < dataArray.length; i += 4) {
    imageData.data[i] = dataArray[i + 2];     // R <- B
    imageData.data[i + 1] = dataArray[i + 1]; // G <- G
    imageData.data[i + 2] = dataArray[i];     // B <- R
    imageData.data[i + 3] = dataArray[i + 3]; // A <- A
  }

  // Disegna l'immagine sul canvas
  ctx.putImageData(imageData, 0, 0);

  // Esporta come Base64 PNG (più leggero per testo UI rispetto a JPEG)
  return canvas.toDataURL('image/png');
}
