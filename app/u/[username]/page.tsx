import { TranslatorProfilePage } from '@/components/social/translator-profile-page';

// Next 15 con `output: 'export'` richiede almeno un param generato in
// `generateStaticParams()`. Il valore reale (username) è letto a runtime dal
// componente client via useParams. Route condivisibile: /u/<username>.
export function generateStaticParams() {
  return [{ username: '_' }];
}
export const dynamicParams = false;

export default function TranslatorProfileRoute() {
  return <TranslatorProfilePage />;
}
