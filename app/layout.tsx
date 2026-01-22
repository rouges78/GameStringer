
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';
import { ProfileWrapper } from '@/components/profiles/profile-wrapper';
import { ErrorBoundary } from '@/components/error-boundary';
import { ProgressProvider } from '@/components/progress/progress-provider';
import { ProgressUIManager } from '@/components/progress/progress-ui-manager';
import { InteractiveTutorial } from '@/components/onboarding/interactive-tutorial';
import { DisclaimerModal } from '@/components/legal/disclaimer-modal';
import { UpdateNotification } from '@/components/update-notification';
import { I18nProvider } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GameStringer - AI Game Translation',
  description: 'GameStringer è un sistema avanzato per la traduzione automatica e manuale di videogames.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <I18nProvider>
            <Providers>
              <ProgressProvider>
                <ErrorBoundary>
                  {/* ProfileWrapper integra ProfileAuthProvider e ProtectedRoute */}
                  <ProfileWrapper>
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                    {/* Disclaimer legale - primo avvio */}
                    <DisclaimerModal />
                    {/* Tutorial interattivo per nuovi utenti */}
                    <InteractiveTutorial />
                  </ProfileWrapper>
                </ErrorBoundary>
                <Toaster richColors position="top-right" />
                {/* Progress UI Manager */}
                <ProgressUIManager />
                {/* Notifica aggiornamenti disponibili */}
                <UpdateNotification />
                {/* Debug Monitor disabilitato - problema risolto */}
                {/* {process.env.NODE_ENV === 'development' && <LoginDebugMonitor />} */}
              </ProgressProvider>
            </Providers>
            </I18nProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}



