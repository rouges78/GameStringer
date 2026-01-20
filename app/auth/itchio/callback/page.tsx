'use client';

import { useEffect } from 'react';
import { signIn } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function ItchioCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The access token is in the URL hash from itch.io's implicit flow
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (accessToken) {
      // Pass the token to our backend via the credentials provider
      signIn('itchio-credentials', {
        accessToken: accessToken,
        redirect: false, // We will handle redirect manually
      }).then((result) => {
        if (result?.ok) {
          // Redirect to the stores page on successful login
          router.push('/stores');
        } else {
          // Handle sign-in error
          console.error('Failed to sign in with itch.io credentials:', result?.error);
          router.push('/stores?error=ItchioAuthFailed');
        }
      });
    } else {
      // No access token found in URL
      console.error('No access_token found in callback URL.');
      router.push('/stores?error=ItchioAuthFailed');
    }
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Finalizing itch.io connection, please wait...</p>
    </div>
  );
}



