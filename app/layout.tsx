
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';
import { ThemeProvider } from '@/components/theme-provider';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';

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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Providers>
            <MainLayout>
              {children}
            </MainLayout>
            <Toaster richColors position="top-right" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
