
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';
import { ProfileWrapper } from '@/components/profiles/profile-wrapper';
import { ErrorBoundary } from '@/components/ui/error-boundary';

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
              <ErrorBoundary
                showErrorDetails={process.env.NODE_ENV === 'development'}
              >
                <ProfileWrapper>
                  <ErrorBoundary
                    showErrorDetails={process.env.NODE_ENV === 'development'}
                  >
                    {children}
                  </ErrorBoundary>
                </ProfileWrapper>
              </ErrorBoundary>
              <Toaster richColors position="top-right" />
            </Providers>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
