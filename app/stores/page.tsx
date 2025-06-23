
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react';
import React from 'react';

// --- Icone degli Store (SVG migliorati e nuovi) ---
const SteamIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.22 17.815c-1.84.735-3.83.92-5.76.435-1.93-.485-3.6-1.61-4.75-3.17l.01.005c.485.41 1.02.73 1.58.96l.01.005c.56.23 1.14.36 1.74.39 1.2.06 2.37-.18 3.46-.68.54-.25.92-.77.92-1.36v-1.37c0-.62-.4-1.16-.97-1.39l-2.02-1.1c-.57-.31-.95-.9-.95-1.55V9.24c0-.65.38-1.24.95-1.55l2.02-1.1c.57-.31.97-.85.97-1.39V5.83c0-.59-.38-1.11-.92-1.36-2.17-1-4.57-.8-6.55.48-.52.34-.78.94-.65 1.52l.74 3.29c.13.58.64 1 1.24.95.6-.05 1.11-.48 1.24-1.06l-.2-.88c.73-.34 1.52-.5 2.33-.45.81.05 1.58.31 2.25.74.33.21.53.58.53.97v.7c0 .39-.2.76-.53.97l-2.25 1.23c-.33.18-.53.55-.53.94v.7c0 .39.2.76.53.97l2.25 1.23c.33.18.53.55.53.94v.7c0 .39-.2.76-.53.97z"/></svg>;
const GOGIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.18 14.36L12 11.1l-4.18 5.26-1.53-1.22L12 8.67l5.71 7.14-1.53 1.22z"/></svg>;
const EpicGamesIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M18.5 3h-13C4.12 3 3 4.12 3 5.5v13C3 19.88 4.12 21 5.5 21h13c1.38 0 2.5-1.12 2.5-2.5v-13C21 4.12 19.88 3 18.5 3zM10.25 18H6.5V9.75h3.75v1.61H7.88v2.23h2.22v1.6H7.88v2.81h2.37V18zm6.25 0h-3.75V9.75h3.75c2.07 0 3.75 1.68 3.75 3.75s-1.68 3.75-3.75 3.75zm0-5.89h-2.14v4.28h2.14c1.18 0 2.14-.96 2.14-2.14s-.96-2.14-2.14-2.14z"/></svg>;
const UbisoftConnectIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4zm4-2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>;
const EALogo = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.6 14.5h-2.1l-1.9-4.9h-.1l-1.9 4.9H8.5l-3.1-8h2.2l2 5.4h.1l2-5.4h2.2l-3.1 8z"/></svg>;
const BattleNetIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.2 14.5H6.8V7.5h10.4v9zM8.3 15h7.4v-6H8.3v6z"/></svg>;
const RockstarIcon = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14h-2.5l-1.5-3h-2l-1.5 3H6l4-7h4l-2 3.5L16 16zm-5-4.5h2l-1-2-1 2z"/></svg>;

const stores = [
  { name: 'Steam', icon: SteamIcon, connected: true }, // Esempio: connesso
  { name: 'GOG', icon: GOGIcon, connected: false },
  { name: 'Epic Games', icon: EpicGamesIcon, connected: false },
  { name: 'Ubisoft Connect', icon: UbisoftConnectIcon, connected: false },
  { name: 'EA App', icon: EALogo, connected: false },
  { name: 'Battle.net', icon: BattleNetIcon, connected: false },
  { name: 'Rockstar', icon: RockstarIcon, connected: false },
];

export default function StoresPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Connessioni Store</h1>
        <p className="text-muted-foreground">
          Collega i tuoi account per sincronizzare la tua libreria di giochi e accedere a funzionalità avanzate.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stores.map((store) => (
          <Card key={store.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">{store.name}</CardTitle>
              <store.icon className="h-12 w-12 text-foreground/80" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                {store.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className={`font-medium ${store.connected ? 'text-green-500' : 'text-red-500'}`}>
                  {store.connected ? 'Connesso' : 'Non Connesso'}
                </span>
              </div>
              <CardDescription>
                Collega il tuo account {store.name} per importare automaticamente i tuoi giochi.
              </CardDescription>
              <Button className="w-full mt-4" disabled>
                <LinkIcon className="mr-2 h-4 w-4" />
                {store.connected ? 'Gestisci Connessione' : 'Collega Account'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

