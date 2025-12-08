
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';
import { ProfileWrapper } from '@/components/profiles/profile-wrapper';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { LoginDebugMonitor } from '@/components/debug/login-debug-monitor';
import { ProgressProvider } from '@/components/progress/progress-provider';
import { ProgressUIManager } from '@/components/progress/progress-ui-manager';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GameStringer - AI Game Translation',
  description: 'GameStringer è un sistema avanzato per la traduzione automatica e manuale di videogiochi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary
          showErrorDetails={process.env.NODE_ENV === 'development'}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <Providers>
              <ProgressProvider>
                <ErrorBoundary
                  showErrorDetails={process.env.NODE_ENV === 'development'}
                >
                  {/* ProfileWrapper integra ProfileAuthProvider e ProtectedRoute */}
                  <ProfileWrapper>
                    <ErrorBoundary
                      showErrorDetails={process.env.NODE_ENV === 'development'}
                    >
                      {children}
                    </ErrorBoundary>
                  </ProfileWrapper>
                </ErrorBoundary>
                <Toaster richColors position="top-right" />
                {/* Progress UI Manager */}
                <ProgressUIManager />
                {/* Debug Monitor disabilitato - problema risolto */}
                {/* {process.env.NODE_ENV === 'development' && <LoginDebugMonitor />} */}
              </ProgressProvider>
            </Providers>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
