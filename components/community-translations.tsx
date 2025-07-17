'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Star, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Flag,
  Award,
  Crown,
  Shield,
  Edit3,
  Send,
  Filter,
  Search,
  Globe,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CommunityTranslation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  gameTitle: string;
  context: string;
  author: CommunityUser;
  votes: number;
  upvotes: number;
  downvotes: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviews: TranslationReview[];
  timestamp: Date;
  lastModified: Date;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

interface CommunityUser {
  id: string;
  username: string;
  avatar?: string;
  level: number;
  reputation: number;
  badges: UserBadge[];
  contributionsCount: number;
  languages: string[];
  specializations: string[];
}

interface UserBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface TranslationReview {
  id: string;
  reviewer: CommunityUser;
  rating: number;
  comment: string;
  suggestions: string[];
  timestamp: Date;
}

interface CommunityTranslationsProps {
  currentUser?: CommunityUser;
  gameTitle?: string;
  onTranslationSubmit: (translation: CommunityTranslation) => void;
  className?: string;
}

const mockUsers: CommunityUser[] = [
  {
    id: '1',
    username: 'TranslatorPro',
    level: 15,
    reputation: 2450,
    badges: [
      { id: '1', name: 'Veterano', icon: '🏆', description: '1000+ traduzioni', rarity: 'epic' },
      { id: '2', name: 'Esperto RPG', icon: '⚔️', description: 'Specialista RPG', rarity: 'rare' }
    ],
    contributionsCount: 1247,
    languages: ['it', 'en', 'es'],
    specializations: ['RPG', 'Fantasy']
  },
  {
    id: '2',
    username: 'GameLinguist',
    level: 12,
    reputation: 1890,
    badges: [
      { id: '3', name: 'Poliglotta', icon: '🌍', description: '5+ lingue', rarity: 'legendary' }
    ],
    contributionsCount: 892,
    languages: ['it', 'en', 'fr', 'de', 'ja'],
    specializations: ['Action', 'Adventure']
  }
];

const CommunityTranslations: React.FC<CommunityTranslationsProps> = ({
  currentUser,
  gameTitle = 'GameStringer',
  onTranslationSubmit,
  className
}) => {
  const [translations, setTranslations] = useState<CommunityTranslation[]>([]);
  const [newTranslation, setNewTranslation] = useState({
    originalText: '',
    translatedText: '',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    context: '',
    category: 'dialogue'
  });
  const [selectedTranslation, setSelectedTranslation] = useState<CommunityTranslation | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockTranslations: CommunityTranslation[] = [
      {
        id: '1',
        originalText: 'Welcome to the realm of endless adventures!',
        translatedText: 'Benvenuto nel regno delle avventure infinite!',
        sourceLanguage: 'en',
        targetLanguage: 'it',
        gameTitle: 'Fantasy Quest',
        context: 'Messaggio di benvenuto iniziale',
        author: mockUsers[0],
        votes: 15,
        upvotes: 18,
        downvotes: 3,
        status: 'approved',
        reviews: [
          {
            id: '1',
            reviewer: mockUsers[1],
            rating: 5,
            comment: 'Traduzione eccellente, mantiene il tono epico!',
            suggestions: [],
            timestamp: new Date(Date.now() - 86400000)
          }
        ],
        timestamp: new Date(Date.now() - 172800000),
        lastModified: new Date(Date.now() - 86400000),
        difficulty: 'medium',
        category: 'dialogue'
      },
      {
        id: '2',
        originalText: 'Press E to interact with objects',
        translatedText: 'Premi E per interagire con gli oggetti',
        sourceLanguage: 'en',
        targetLanguage: 'it',
        gameTitle: 'Action Game',
        context: 'Istruzione interfaccia utente',
        author: mockUsers[1],
        votes: 8,
        upvotes: 10,
        downvotes: 2,
        status: 'pending',
        reviews: [],
        timestamp: new Date(Date.now() - 43200000),
        lastModified: new Date(Date.now() - 43200000),
        difficulty: 'easy',
        category: 'ui'
      }
    ];
    setTranslations(mockTranslations);
  }, []);

  const filteredTranslations = translations.filter(translation => {
    const matchesSearch = translation.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         translation.translatedText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || translation.status === statusFilter;
    const matchesLanguage = languageFilter === 'all' || translation.targetLanguage === languageFilter;
    
    return matchesSearch && matchesStatus && matchesLanguage;
  });

  const handleSubmitTranslation = () => {
    if (!newTranslation.originalText || !newTranslation.translatedText) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }

    const translation: CommunityTranslation = {
      id: `translation-${Date.now()}`,
      ...newTranslation,
      gameTitle,
      author: currentUser || mockUsers[0],
      votes: 0,
      upvotes: 0,
      downvotes: 0,
      status: 'pending',
      reviews: [],
      timestamp: new Date(),
      lastModified: new Date(),
      difficulty: 'medium'
    };

    setTranslations(prev => [translation, ...prev]);
    onTranslationSubmit(translation);
    setNewTranslation({
      originalText: '',
      translatedText: '',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      context: '',
      category: 'dialogue'
    });
    setIsSubmitDialogOpen(false);
    toast.success('Traduzione inviata per revisione');
  };

  const handleVote = (translationId: string, isUpvote: boolean) => {
    setTranslations(prev => prev.map(t => {
      if (t.id === translationId) {
        return {
          ...t,
          upvotes: isUpvote ? t.upvotes + 1 : t.upvotes,
          downvotes: !isUpvote ? t.downvotes + 1 : t.downvotes,
          votes: isUpvote ? t.votes + 1 : t.votes - 1
        };
      }
      return t;
    }));
    toast.success(isUpvote ? 'Voto positivo registrato' : 'Voto negativo registrato');
  };

  const handleSubmitReview = () => {
    if (!selectedTranslation || !reviewText) {
      toast.error('Compila tutti i campi della recensione');
      return;
    }

    const review: TranslationReview = {
      id: `review-${Date.now()}`,
      reviewer: currentUser || mockUsers[1],
      rating: reviewRating,
      comment: reviewText,
      suggestions: [],
      timestamp: new Date()
    };

    setTranslations(prev => prev.map(t => {
      if (t.id === selectedTranslation.id) {
        return {
          ...t,
          reviews: [...t.reviews, review]
        };
      }
      return t;
    }));

    setReviewText('');
    setReviewRating(5);
    setIsReviewDialogOpen(false);
    toast.success('Recensione inviata');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'needs_review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-purple-100 text-purple-800';
      case 'epic': return 'bg-orange-100 text-orange-800';
      case 'rare': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Traduzioni Community
          </h2>
          <p className="text-muted-foreground">
            Collabora con la community per migliorare le traduzioni
          </p>
        </div>
        
        <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Edit3 className="h-4 w-4 mr-2" />
              Nuova Traduzione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Contribuisci con una Traduzione</DialogTitle>
              <DialogDescription>
                Aiuta la community con una nuova traduzione
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lingua Origine</Label>
                  <Select 
                    value={newTranslation.sourceLanguage} 
                    onValueChange={(value) => setNewTranslation(prev => ({ ...prev, sourceLanguage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 Inglese</SelectItem>
                      <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                      <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Lingua Target</Label>
                  <Select 
                    value={newTranslation.targetLanguage} 
                    onValueChange={(value) => setNewTranslation(prev => ({ ...prev, targetLanguage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇺🇸 Inglese</SelectItem>
                      <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={newTranslation.category} 
                  onValueChange={(value) => setNewTranslation(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dialogue">💬 Dialogo</SelectItem>
                    <SelectItem value="ui">🖥️ Interfaccia</SelectItem>
                    <SelectItem value="item">🎒 Oggetto</SelectItem>
                    <SelectItem value="quest">📜 Missione</SelectItem>
                    <SelectItem value="lore">📚 Storia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Testo Originale</Label>
                <Textarea
                  value={newTranslation.originalText}
                  onChange={(e) => setNewTranslation(prev => ({ ...prev, originalText: e.target.value }))}
                  placeholder="Inserisci il testo originale..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Traduzione</Label>
                <Textarea
                  value={newTranslation.translatedText}
                  onChange={(e) => setNewTranslation(prev => ({ ...prev, translatedText: e.target.value }))}
                  placeholder="Inserisci la tua traduzione..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Contesto (opzionale)</Label>
                <Textarea
                  value={newTranslation.context}
                  onChange={(e) => setNewTranslation(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="Descrivi il contesto della traduzione..."
                  className="min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSubmitTranslation}>
                <Send className="h-4 w-4 mr-2" />
                Invia Traduzione
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca traduzioni..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="approved">Approvate</SelectItem>
                <SelectItem value="needs_review">Da rivedere</SelectItem>
                <SelectItem value="rejected">Rifiutate</SelectItem>
              </SelectContent>
            </Select>

            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le lingue</SelectItem>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇺🇸 Inglese</SelectItem>
                <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistiche Community */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">1,247</p>
                <p className="text-sm text-muted-foreground">Traduzioni Totali</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">89</p>
                <p className="text-sm text-muted-foreground">Contributori Attivi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Lingue Supportate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">94%</p>
                <p className="text-sm text-muted-foreground">Tasso Approvazione</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Traduzioni */}
      <div className="space-y-4">
        {filteredTranslations.map((translation) => (
          <Card key={translation.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={translation.author.avatar} />
                    <AvatarFallback>{translation.author.username[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{translation.author.username}</span>
                      <Badge variant="outline" className="text-xs">
                        Lv. {translation.author.level}
                      </Badge>
                      {translation.author.badges.slice(0, 2).map(badge => (
                        <Badge key={badge.id} className={`text-xs ${getBadgeColor(badge.rarity)}`}>
                          {badge.icon} {badge.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {translation.gameTitle} • {translation.category} • {translation.timestamp.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(translation.status)}>
                    {translation.status === 'approved' && '✓ Approvata'}
                    {translation.status === 'pending' && '⏳ In attesa'}
                    {translation.status === 'needs_review' && '👀 Da rivedere'}
                    {translation.status === 'rejected' && '❌ Rifiutata'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Testo Originale</Label>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{translation.originalText}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Traduzione</Label>
                  <div className="bg-primary/10 p-3 rounded-md">
                    <p className="text-sm font-medium">{translation.translatedText}</p>
                  </div>
                </div>
              </div>

              {translation.context && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contesto</Label>
                  <p className="text-sm text-muted-foreground">{translation.context}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote(translation.id, true)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {translation.upvotes}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote(translation.id, false)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      {translation.downvotes}
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {translation.reviews.length} recensioni
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTranslation(translation);
                      setIsReviewDialogOpen(true);
                    }}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Recensisci
                  </Button>
                  
                  <Button variant="ghost" size="sm">
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Recensioni */}
              {translation.reviews.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-sm font-medium">Recensioni</Label>
                  {translation.reviews.slice(0, 2).map((review) => (
                    <div key={review.id} className="flex gap-3 p-3 bg-muted/50 rounded-md">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{review.reviewer.username[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{review.reviewer.username}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {review.timestamp.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{review.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog Recensione */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recensisci Traduzione</DialogTitle>
            <DialogDescription>
              Fornisci feedback per aiutare a migliorare la traduzione
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valutazione</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    variant="ghost"
                    size="sm"
                    onClick={() => setReviewRating(rating)}
                  >
                    <Star
                      className={`h-5 w-5 ${rating <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Commento</Label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Scrivi il tuo feedback..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmitReview}>
              <Send className="h-4 w-4 mr-2" />
              Invia Recensione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityTranslations;
