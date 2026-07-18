'use client';

// Pagina profilo traduttore condivisibile (/u/[username]).
// Route statica (output: 'export') col pattern library: l'username reale è letto
// a runtime da useParams. onClose torna al Community Hub.

import { useParams, useRouter } from 'next/navigation';
import { UserProfileView } from './user-profile';
import { useProfiles } from '@/hooks/use-profiles';

export function TranslatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { currentProfile } = useProfiles();

  const raw = params?.username;
  const username = Array.isArray(raw) ? raw[0] : raw;
  const decoded = username ? decodeURIComponent(username) : '';

  return (
    <div className="h-full overflow-y-auto">
      <UserProfileView
        username={decoded}
        currentUserId={currentProfile?.id || undefined}
        onClose={() => router.push('/community-hub')}
      />
    </div>
  );
}

export default TranslatorProfilePage;
