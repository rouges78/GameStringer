import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Isola ogni file di test in un processo figlio dedicato: un leak in un
    // file non contamina gli altri. Heap volutamente contenuto (2GB): se un
    // test entra in un render-loop (es. mock con identità instabile nelle
    // dependency di un effect, vedi notification-center.test) l'OOM emerge
    // in secondi invece di saturare la RAM per minuti.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        execArgv: ['--max-old-space-size=2048'],
      },
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // I worktree degli agenti sotto .claude/ sono checkout completi del repo:
      // senza questa riga la suite raccoglie ANCHE i loro __tests__, gira ogni
      // file due volte e valuta una copia potenzialmente vecchia del codice
      // come se fosse questa. Nota: dichiarare `exclude` sostituisce l'elenco
      // di default di vitest, non lo estende — per questo node_modules e dist
      // sono riscritti a mano qui sopra, e per questo un percorso che manca qui
      // non e' escluso da nessun'altra parte.
      '**/.claude/**',
      '**/e2e/**',
      '**/tests/e2e/**',
      '**/.next/**',
      '**/out/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/types': path.resolve(__dirname, './types'),
      '@/app': path.resolve(__dirname, './app')
    }
  }
});
