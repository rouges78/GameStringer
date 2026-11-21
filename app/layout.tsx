
import type { Metadata } from 'next';
import { BRAND_FULL } from '@/lib/brand';
import { IBM_Plex_Sans, JetBrains_Mono, Pixelify_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';
import { ProfileWrapper } from '@/components/profiles/profile-wrapper';
import { ErrorBoundary, AppErrorBoundary } from '@/components/error-boundary';
import { ProgressProvider } from '@/components/progress/progress-provider';
import { ProgressUIManager } from '@/components/progress/progress-ui-manager';
import { I18nProvider } from '@/lib/i18n';
import { ScreenProvider } from '@/components/providers/screen-provider';
import { SettingsBootGate } from '@/components/providers/settings-boot-gate';
import { FeedbackHost } from '@/components/feedback/feedback-host';

// next/font scarica i file in build e li serve dall'app: funzionano offline in
// Tauri. Prima c'era solo Inter latin, e cirillico e greco (interfaccia in 12
// lingue) cadevano sul font di sistema a metà frase. CJK resta ai font di
// sistema: un font giapponese incluso costerebbe megabyte all'installer.
const body = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});
const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});
// Accento "Save Slot": solo titoli brevi e contatori, mai testo corrente.
const pixel = Pixelify_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '600'],
  variable: '--font-pixel',
});

export const metadata: Metadata = {
  title: `${BRAND_FULL} - AI Game Translation`,
  description: 'Rouges-GameStringer è un sistema avanzato per la traduzione automatica e manuale di videogames.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`dark ${body.variable} ${mono.variable} ${pixel.variable}`} suppressHydrationWarning>
      {/* Niente più AnimatedBackground: blob sfocati e 50 particelle in un loop
          rAF permanente, anche nelle finestre overlay. */}
      <body className="font-sans">
        <AppErrorBoundary>
          <ThemeProvider>
            <SettingsBootGate>
            <I18nProvider>
            <ScreenProvider>
            <Providers>
              <ProgressProvider>
                <ErrorBoundary>
                  {/* ProfileWrapper integra ProfileAuthProvider e ProtectedRoute */}
                  <ProfileWrapper>
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </ProfileWrapper>
                </ErrorBoundary>
                {/* In basso al centro, come un sottotitolo; sopra la barra di stato. */}
                <Toaster position="bottom-center" offset={40} />
                {/* Progress UI Manager */}
                <ProgressUIManager />
                {/* Dialog di feedback apribile da ovunque (sidebar, invito post-run) */}
                <FeedbackHost />
                {/* Debug Monitor disabilitato - problema risolto */}
                {/* {process.env.NODE_ENV === 'development' && <LoginDebugMonitor />} */}
              </ProgressProvider>
            </Providers>
            </ScreenProvider>
            </I18nProvider>
            </SettingsBootGate>
          </ThemeProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}




