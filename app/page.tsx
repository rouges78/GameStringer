
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Gamepad2, 
  Languages, 
  Search,
  Download,
  Box,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { ScanButton } from '@/components/scan-button';

// Componenti UI riutilizzabili
const StatCard = ({ icon: Icon, title, value, change, progress, color }: any) => (
  <Card className="bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change && <p className="text-xs text-muted-foreground">{change}</p>}
      {progress !== undefined && <Progress value={progress} className="mt-2 h-2" />}
    </CardContent>
  </Card>
);

const ActionButton = ({ icon: Icon, label, href }: any) => (
  <Button variant="ghost" className="w-full justify-start" asChild>
    <Link href={href}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Link>
  </Button>
);

const RecentActivityItem = ({ color, text, time }: any) => (
  <div className="flex items-start">
    <div className={`mt-1.5 h-2 w-2 rounded-full ${color} mr-3 flex-shrink-0`}></div>
    <div className="flex-grow">
      <p className="text-sm">{text}</p>
      <p className="text-xs text-muted-foreground">{time}</p>
    </div>
  </div>
);

// Funzione per recuperare i dati
async function getDashboardData() {
  try {
    const installedGamesCount = await prisma.game.count();
    return { installedGamesCount };
  } catch (error) {
    console.error("Errore nel caricamento dei dati della dashboard:", error);
    return { installedGamesCount: 0 };
  }
}

// Pagina Dashboard
export default async function Dashboard() {
  const { installedGamesCount } = await getDashboardData();
  const totalGames = 247; // Placeholder
  const installedProgress = totalGames > 0 ? (installedGamesCount / totalGames) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Panoramica del sistema di traduzione giochi</p>
        </div>
        <ScanButton />
      </div>

      { /* Sezione Statistiche */ }
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gamepad2} title="Giochi Totali" value={totalGames} change="+20% dal mese scorso" color="text-primary" />
        <StatCard icon={Download} title="Giochi Installati" value={installedGamesCount} progress={installedProgress} color="text-sky-400" />
        <StatCard icon={Languages} title="Traduzioni" value="15,420" change="+450 oggi" color="text-emerald-400" />
        <StatCard icon={Box} title="Patch Create" value="23" change="Spazio: 2.3 GB" color="text-amber-400" />
      </div>

      { /* Sezione Principale */ }
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Attività Recenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RecentActivityItem color="bg-purple-500" text="Cyberpunk 2077: Traduzione completata" time="5 min fa" />
            <RecentActivityItem color="bg-orange-500" text="Mass Effect LE: Patch v1.5.2 creata" time="1 ora fa" />
            <RecentActivityItem color="bg-blue-500" text="Horizon Zero Dawn: Backup automatico creato" time="2 ore fa" />
            <RecentActivityItem color="bg-green-500" text="Steam: Sincronizzazione completata" time="3 ore fa" />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ActionButton icon={Gamepad2} label="Gestisci Giochi" href="/games" />
              <ActionButton icon={Languages} label="Nuova Traduzione" href="/translator" />
              <ActionButton icon={Clock} label="Modalità Tempo Reale" href="/tempo-reale" />
              <ActionButton icon={Box} label="Crea Patch" href="/patch" />
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Stato Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">AI Engine</span><Badge variant="outline" className="border-green-500/50 text-green-400">Online</Badge></div>
              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Database</span><Badge variant="outline" className="border-green-500/50 text-green-400">Connesso</Badge></div>
              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Store Sync</span><Badge variant="outline" className="border-sky-500/50 text-sky-400">Attivo</Badge></div>
              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Ultima Scansione</span><span className="text-muted-foreground">2 ore fa</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
