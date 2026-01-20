import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from nanonets import NANONETS_OCR
import uvicorn

# --- Configurazione ---
# NOTA: Per ora, l'API key è un segnaposto.
# Sostituiscila con la tua vera API key di NanoNets.
# Per sicurezza, è meglio caricarla da una variabile d'ambiente.
API_KEY = os.environ.get('NANONETS_API_KEY', 'REPLACE_WITH_YOUR_API_KEY')

# Inizializza il modello OCR
model = NANONETS_OCR()
model.set_token(API_KEY)

# Crea l'applicazione FastAPI
app = FastAPI(
    title="GameStringer OCR Service",
    description="Un microservizio per estrarre testo da immagini di gioco.",
    version="1.0.0"
)

# --- Endpoint API ---
@app.post("/ocr",
          summary="Estrai testo da un'immagine",
          response_description="Il testo estratto dall'immagine e i dettagli.")
async def ocr_endpoint(file: UploadFile = File(...) ):
    """
    Questo endpoint riceve un file immagine, estrae il testo utilizzando NanoNets OCR
    e restituisce il risultato.

    - **file**: L'immagine da processare (formati supportati: JPG, PNG, etc.).
    """
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Il file caricato non è un'immagine.")

    try:
        # Leggi i byte del file caricato
        image_bytes = await file.read()

        # Esegui la predizione OCR
        # Nota: la libreria potrebbe richiedere il salvataggio temporaneo del file
        # Qui usiamo direttamente i byte se la libreria lo supporta.
        # Per nanonets-ocr, è necessario un percorso file.
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            buffer.write(image_bytes)

        # Esegui l'OCR sul file temporaneo
        result = model.convert_to_string(temp_file_path, formatting='lines and spaces')

        # Rimuovi il file temporaneo
        os.remove(temp_file_path)

        return {"extracted_text": result}

    except Exception as e:
        # In caso di errore con l'API di NanoNets o altro
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione OCR: {str(e)}")

# --- Avvio del server (per test locali) ---
if __name__ == "__main__":
    # Esegui il server con Uvicorn
    # Host '0.0.0.0' lo rende accessibile da altri dispositivi nella stessa rete
    uvicorn.run(app, host="0.0.0.0", port=8000)
