
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react';
import React from 'react';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

const stores = [
  { name: 'Steam', logoUrl: '/logos/steam.png', id: 'steam' },
  { name: 'GOG', logoUrl: '/logos/gog.png', id: 'gog' },
  { name: 'Epic Games', logoUrl: '/logos/epic-games.png', id: 'epic' },
  { name: 'Ubisoft Connect', logoUrl: '/logos/ubisoft-connect.png', id: 'ubisoft' },
  { name: 'EA App', logoUrl: '/logos/ea-app.png', id: 'ea' },
  { name: 'Battle.net', logoUrl: '/logos/battlenet.png', id: 'battlenet' },
  { name: 'Rockstar', logoUrl: '/logos/rockstar.png', id: 'rockstar' },
  { name: 'itch.io', logoUrl: '/logos/itch-io.png', id: 'itchio' },
];

export default function StoresPage() {
  const { data: session, status } = useSession();

  const isSteamConnected = !!session?.user?.steam;
  const isLoading = status === 'loading';

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Connessioni Store</h1>
        <p className="text-muted-foreground">
          Collega i tuoi account per sincronizzare la tua libreria di giochi e accedere a funzionalità avanzate.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stores.map((store) => {
          const isConnectable = ['steam', 'epic'].includes(store.id);
          const isConnected =
            (store.id === 'steam' && !!session?.user?.steam) ||
            (store.id === 'epic' && !!session?.user?.epic);

          const handleConnect = () => {
            if (store.id === 'epic') {
              signIn('epic', { callbackUrl: '/stores' });
            }
          };

          const handleDisconnect = () => {
            // This is a simplified disconnect. A real implementation might need
            // to call a backend endpoint to unlink the account without logging out.
            signOut({ callbackUrl: '/stores' });
          };

          return (
            <Card key={store.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12">
                    <Image
                      src={store.logoUrl}
                      alt={`${store.name} logo`}
                      fill
                      sizes="48px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <CardTitle className="text-xl font-bold">{store.name}</CardTitle>
                </div>
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  {isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className={`font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                    {isConnected ? 'Connesso' : 'Non Connesso'}
                  </span>
                </div>
                <CardDescription>
                  {isConnectable
                    ? `Collega il tuo account ${store.name} per importare automaticamente i tuoi giochi.`
                    : `La connessione con ${store.name} non è ancora supportata.`}
                </CardDescription>
                {isConnected ? (
                  <Button
                    className="w-full mt-4"
                    variant="destructive"
                    disabled={isLoading}
                    onClick={handleDisconnect}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {isLoading ? 'Caricamento...' : 'Disconnetti'}
                  </Button>
                ) : isConnectable ? (
                  store.id === 'steam' ? (
                    <Button asChild className="w-full mt-4">
                      <Link href={`https://steamcommunity.com/openid/login?${new URLSearchParams({
                        "openid.ns": "http://specs.openid.net/auth/2.0",
                        "openid.mode": "checkid_setup",
                        "openid.return_to": `${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/steam`,
                        "openid.realm": `${typeof window !== 'undefined' ? window.location.origin : ''}`,
                        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
                        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
                      })}`}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Collega Account
                      </Link>
                    </Button>
                  ) : ( // This is for Epic Games
                    <Button className="w-full mt-4" onClick={handleConnect} disabled={isLoading}>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      {isLoading ? 'Caricamento...' : 'Collega Account'}
                    </Button>
                  )
                ) : (
                  <Button className="w-full mt-4" disabled={true}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Collega Account
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
