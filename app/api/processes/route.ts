import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Process {
  pid: number;
  name: string;
  windowTitle: string;
  path: string;
}

// Lista di processi di gioco comuni da cercare
const GAME_PROCESS_PATTERNS = [
  '.exe',
  'game',
  'launcher',
  'client'
];

// Lista di processi da escludere (processi di sistema, browser, ecc.)
const EXCLUDED_PROCESSES = [
  'System',
  'Registry',
  'svchost.exe',
  'RuntimeBroker.exe',
  'SearchHost.exe',
  'TextInputHost.exe',
  'conhost.exe',
  'dwm.exe',
  'ctfmon.exe',
  'SearchIndexer.exe',
  'MsMpEng.exe',
  'SecurityHealthService.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'spoolsv.exe',
  'audiodg.exe'
];

export async function GET() {
  try {
    console.log('Inizio rilevamento processi...');
    
    // Usa un comando PowerShell più semplice per ottenere tutti i processi con finestra
    const { stdout } = await execAsync(
      `powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object Id, ProcessName, MainWindowTitle, Path | ConvertTo-Json"`
    );
    
    let processData = [];
    try {
      processData = JSON.parse(stdout);
      // Se c'è un solo processo, PowerShell non restituisce un array
      if (!Array.isArray(processData)) {
        processData = [processData];
      }
    } catch (parseError) {
      console.error('Errore parsing JSON:', parseError);
      // Fallback: prova con WMIC
      const { stdout: wmicOutput } = await execAsync(
        'wmic process where "MainWindowTitle != NULL" get ProcessId,Name,ExecutablePath /format:csv'
      );
      
      const lines = wmicOutput.split('\n').filter(line => line.trim());
      for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 4) {
          processData.push({
            Id: parseInt(parts[3]),
            ProcessName: parts[1].replace('.exe', ''),
            MainWindowTitle: parts[1].replace('.exe', ''),
            Path: parts[2]
          });
        }
      }
    }
    
    console.log(`Trovati ${processData.length} processi con finestra`);
    
    const processes: Process[] = [];
    
    for (const proc of processData) {
      const name = proc.ProcessName + '.exe';
      
      // Escludi solo i processi di sistema più comuni
      if (!EXCLUDED_PROCESSES.includes(name)) {
        processes.push({
          pid: proc.Id,
          name: name,
          windowTitle: proc.MainWindowTitle || proc.ProcessName,
          path: proc.Path || 'N/A'
        });
      }
    }
    
    console.log(`Processi filtrati: ${processes.length}`);
    
    // Se non ci sono processi, mostra tutti i processi con finestra per debug
    if (processes.length === 0) {
      console.log('Nessun processo trovato dopo il filtraggio. Mostrando tutti i processi con finestra...');
      
      // Mostra TUTTI i processi con finestra per debug
      const allProcesses: Process[] = [];
      for (const proc of processData) {
        allProcesses.push({
          pid: proc.Id,
          name: proc.ProcessName + '.exe',
          windowTitle: proc.MainWindowTitle || proc.ProcessName,
          path: proc.Path || 'N/A'
        });
      }
      
      if (allProcesses.length > 0) {
        return NextResponse.json({
          success: true,
          processes: allProcesses.slice(0, 50),
          message: `Debug: Mostrando tutti i ${allProcesses.length} processi con finestra (nessun filtraggio applicato)`,
          debug: true
        });
      }
      
      return NextResponse.json({
        success: true,
        processes: [
          {
            pid: 1234,
            name: "NoProcesses.exe",
            windowTitle: "Nessun processo con finestra rilevato",
            path: "Potrebbe essere un problema di permessi. Prova ad eseguire come amministratore."
          }
        ],
        message: "Nessun processo con finestra rilevato. Verifica i permessi."
      });
    }
    
    return NextResponse.json({
      success: true,
      processes: processes.slice(0, 50), // Limita a 50 processi
      message: `${processes.length} processi di gioco trovati`
    });
    
  } catch (error) {
    console.error('Errore nel rilevamento processi:', error);
    
    // Fallback ai processi mock in caso di errore
    return NextResponse.json({
      success: false,
      error: 'Errore nel rilevamento processi',
      processes: [
        {
          pid: 9999,
          name: "ErrorDetection.exe",
          windowTitle: "Errore nel rilevamento processi",
          path: "Controlla i permessi di sistema"
        }
      ]
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  
  if (body.action === 'refresh') {
    // Forza un refresh della lista processi
    return GET();
  }
  
  // Per ora, l'iniezione vera e propria non è implementata
  // Questo richiederà Tauri o un servizio nativo
  if (body.action === 'inject') {
    return NextResponse.json({
      success: false,
      message: "L'iniezione reale richiede Tauri o un servizio nativo. Questa è solo una demo.",
      requiresNative: true
    });
  }
  
  return NextResponse.json({
    success: false,
    message: "Azione non supportata"
  });
}
