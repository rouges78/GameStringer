'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';

export default function SteamVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const steamId = searchParams.get('steamId');
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      // Handle error if the backend redirect with an error
      console.error('Error during Steam verification:', error);
      // Redirect to a safe page with an error message
      router.push('/stores?error=SteamLoginFailed');
      return;
    }

    if (steamId) {
      // Use the client-side signIn function
      signIn('steam-credentials', {
        steamid: steamId, // Corrected property name to match provider
        redirect: false, // We will handle the redirect manually
      }).then((result) => {
        if (result?.ok) {
          // On success, redirect to the stores page
          // A refresh might be needed for the session to be picked up immediately
          router.push('/stores');
          router.refresh(); // Force a refresh to update session state
        } else {
          // Handle sign-in failure
          console.error('NextAuth signIn failed:', result?.error);
          router.push(`/stores?error=${result?.error || 'SignInFailed'}`);
        }
      });
    } else {
        // If steamId is missing, it's an invalid state
        console.error('SteamVerifyPage: steamId is missing from URL.');
        router.push('/stores?error=InvalidState');
    }
  }, [steamId, router, error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Verifica in corso...</h1>
        <p className="text-muted-foreground">Stiamo completando l'accesso con Steam.</p>
      </div>
    </div>
  );
}
