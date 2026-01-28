// Generate static params for export (empty = dynamic at runtime)
export function generateStaticParams() {
  return [];
}

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
