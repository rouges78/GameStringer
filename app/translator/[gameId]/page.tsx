import TranslatorClient from './TranslatorClient';

// Required for static export - returns empty array for dynamic runtime
export function generateStaticParams() {
  return [];
}

export default async function TranslatorPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <TranslatorClient params={{ gameId }} />;
}
