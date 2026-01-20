'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Edit3,
  Languages,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TranslationStats {
  total: number;
  completed: number;
  reviewed: number;
  edited: number;
  pending: number;
  byLanguage: Record<string, number>;
  byGame: Record<string, { name: string; count: number }>;
}

interface TranslationStatsProps {
  translations: Array<{
    status: string;
    targetLanguage: string;
    game: { id: string; title: string };
  }>;
}

export function TranslationStats({ translations }: TranslationStatsProps) {
  // Calcola le statistiche
  const stats: TranslationStats = {
    total: translations.length,
    completed: translations.filter(t => t.status === 'completed').length,
    reviewed: translations.filter(t => t.status === 'reviewed').length,
    edited: translations.filter(t => t.status === 'edited').length,
    pending: translations.filter(t => t.status === 'pending').length,
    byLanguage: {},
    byGame: {}
  };

  // Statistiche per lingua
  translations.forEach(t => {
    stats.byLanguage[t.targetLanguage] = (stats.byLanguage[t.targetLanguage] || 0) + 1;
    
    if (!stats.byGame[t.game.id]) {
      stats.byGame[t.game.id] = { name: t.game.title, count: 0 };
    }
    stats.byGame[t.game.id].count++;
  });

  const completionRate = stats.total > 0 
    ? Math.round(((stats.completed + stats.reviewed + stats.edited) / stats.total) * 100)
    : 0;

  const statCards = [
    {
      title: 'Totale',
      value: stats.total,
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Completate',
      value: stats.completed,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Revisionate',
      value: stats.reviewed,
      icon: CheckCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Modificate',
      value: stats.edited,
      icon: Edit3,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'In Attesa',
      value: stats.pending,
      icon: AlertCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Statistiche principali */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Progress generale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Progresso Generale</span>
            </span>
            <span className="text-2xl font-bold">{completionRate}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={completionRate} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>{stats.completed + stats.reviewed + stats.edited} tradotte</span>
            <span>{stats.pending} rimanenti</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistiche per lingua */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Languages className="h-5 w-5" />
              <span>Per Lingua</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.byLanguage).map(([lang, count]) => (
              <div key={lang} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium uppercase">{lang}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((count / stats.total) * 100)}%)
                  </span>
                </div>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Statistiche per game */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Per game</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.values(stats.byGame)
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map((game) => (
                <div key={game.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1 mr-2">
                    {game.name}
                  </span>
                  <span className="text-sm font-bold">{game.count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


