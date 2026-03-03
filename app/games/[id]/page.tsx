import GameDetailClient from '@/components/game-detail-client';

// Required for static export - returns empty array for dynamic runtime
export function generateStaticParams() {
  return [];
}

export default function GameDetailPage() {
  return <GameDetailClient />;
}
