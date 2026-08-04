"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Tipo ricavato dal componente, NON importato da un path del pacchetto.
// Storia (04/08/2026, CI #536): la PR Dependabot che porta next-themes a 0.4.x
// falliva il typecheck perché 0.4 ha tolto `dist/types` dai path importabili.
// L'alternativa ovvia — `import type { ThemeProviderProps } from "next-themes"` —
// romperebbe invece la 0.3.0 di main, che NON ri-esporta quel tipo
// dall'entrypoint. ComponentProps funziona su entrambe e su qualunque
// versione futura: se il componente esiste, il suo tipo si ricava.
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
      storageKey="gamestringer-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}




