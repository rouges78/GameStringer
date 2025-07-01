import { NextResponse } from 'next/server';

// Simulazione API per testare l'Injekt-Translator
// Questo è un POC per dimostrare il funzionamento senza Tauri

export async function GET() {
  // Simula la ricerca di processi di gioco
  const mockProcesses = [
    {
      pid: 1234,
      name: "TestGame.exe",
      windowTitle: "Test Game - Demo",
      path: "C:\\Games\\TestGame\\TestGame.exe"
    },
    {
      pid: 5678,
      name: "SampleRPG.exe", 
      windowTitle: "Sample RPG Adventure",
      path: "C:\\Games\\SampleRPG\\SampleRPG.exe"
    }
  ];

  return NextResponse.json({
    success: true,
    processes: mockProcesses,
    message: "POC: Processi di gioco trovati (simulati)"
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  
  // Simula l'iniezione e la traduzione
  if (body.action === 'start') {
    return NextResponse.json({
      success: true,
      message: `POC: Iniezione avviata per processo ${body.pid}`,
      config: body.config,
      // Simula alcune traduzioni di esempio
      translations: [
        {
          original: "Hello, adventurer!",
          translated: "Ciao, avventuriero!",
          timestamp: Date.now()
        },
        {
          original: "Press SPACE to continue",
          translated: "Premi SPAZIO per continuare",
          timestamp: Date.now() + 1000
        }
      ]
    });
  }
  
  if (body.action === 'stop') {
    return NextResponse.json({
      success: true,
      message: "POC: Iniezione fermata"
    });
  }
  
  return NextResponse.json({
    success: false,
    message: "Azione non riconosciuta"
  });
}
