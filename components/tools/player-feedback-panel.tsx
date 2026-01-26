'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  MessageSquare, Star, TrendingUp, TrendingDown, Minus, 
  Download, Upload, Check, X, Eye, RefreshCw, Filter,
  BarChart3, Send, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { 
  playerFeedbackService, 
  FeedbackEntry, 
  FeedbackCategory,
  FeedbackStats,
  FEEDBACK_CATEGORIES 
} from '@/lib/player-feedback';

export function PlayerFeedbackPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  
  // Filtri
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Form nuovo feedback
  const [newOriginal, setNewOriginal] = useState('');
  const [newTranslated, setNewTranslated] = useState('');
  const [newSuggested, setNewSuggested] = useState('');
  const [newRating, setNewRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [newCategory, setNewCategory] = useState<FeedbackCategory>('accuracy');
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    refreshData();
  }, [filterStatus, filterCategory]);

  const refreshData = () => {
    const filter: any = {};
    if (filterStatus !== 'all') filter.status = filterStatus;
    if (filterCategory !== 'all') filter.category = filterCategory;
    
    setFeedbackList(playerFeedbackService.getFeedback(filter));
    setStats(playerFeedbackService.getStats());
  };

  const handleSubmitFeedback = () => {
    if (!newOriginal.trim() || !newTranslated.trim()) {
      toast.error(t('playerFeedback.fillRequired'));
      return;
    }

    playerFeedbackService.submitFeedback({
      translationId: crypto.randomUUID(),
      originalText: newOriginal,
      translatedText: newTranslated,
      suggestedText: newSuggested || undefined,
      rating: newRating,
      category: newCategory,
      comment: newComment || undefined,
      language: 'it',
    });

    // Reset form
    setNewOriginal('');
    setNewTranslated('');
    setNewSuggested('');
    setNewRating(3);
    setNewCategory('accuracy');
    setNewComment('');
    setShowSubmitDialog(false);
    
    refreshData();
    toast.success(t('playerFeedback.submitted'));
  };

  const handleUpdateStatus = (id: string, status: FeedbackEntry['status']) => {
    playerFeedbackService.updateFeedbackStatus(id, status, 'user');
    refreshData();
    setSelectedFeedback(null);
    toast.success(t('playerFeedback.statusUpdated'));
  };

  const handleExport = (format: 'json' | 'csv') => {
    const data = playerFeedbackService.exportFeedback(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('playerFeedback.exported'));
  };

  const getTrendIcon = () => {
    if (!stats) return <Minus className="h-4 w-4" />;
    switch (stats.recentTrend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: FeedbackEntry['status']) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-500',
      reviewed: 'bg-blue-500',
      applied: 'bg-green-500',
      rejected: 'bg-red-500',
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const renderStars = (rating: number, onClick?: (r: number) => void) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-400'
            } ${onClick ? 'cursor-pointer hover:scale-110' : ''}`}
            onClick={() => onClick?.(star as 1 | 2 | 3 | 4 | 5)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hero Header - Stile verde */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('playerFeedback.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('playerFeedback.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleExport('json')}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleExport('csv')}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowSubmitDialog(true)} 
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <Send className="h-4 w-4 mr-1" />
              {t('playerFeedback.submit')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">{t('playerFeedback.total')}</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">{t('playerFeedback.pending')}</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-green-500">{stats.applied}</div>
            <div className="text-xs text-muted-foreground">{t('playerFeedback.applied')}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</span>
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
            <div className="text-xs text-muted-foreground">{t('playerFeedback.avgRating')}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className="text-sm capitalize">{stats.recentTrend}</span>
            </div>
            <div className="text-xs text-muted-foreground">{t('playerFeedback.trend')}</div>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" />
            {t('playerFeedback.overview')}
          </TabsTrigger>
          <TabsTrigger value="list">
            <MessageSquare className="h-4 w-4 mr-1" />
            {t('playerFeedback.feedbackList')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('playerFeedback.byCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats && Object.entries(stats.byCategory)
                    .filter(([_, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{FEEDBACK_CATEGORIES[category as FeedbackCategory].icon}</span>
                          <span className="text-sm capitalize">{category}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  {stats && Object.values(stats.byCategory).every(c => c === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('playerFeedback.noData')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Feedback */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('playerFeedback.recent')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {feedbackList.slice(0, 5).map((fb) => (
                      <div
                        key={fb.id}
                        className="p-2 rounded-lg border hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedFeedback(fb)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {renderStars(fb.rating)}
                          {getStatusBadge(fb.status)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {fb.originalText}
                        </p>
                      </div>
                    ))}
                    {feedbackList.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('playerFeedback.noFeedback')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {Object.keys(FEEDBACK_CATEGORIES).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {FEEDBACK_CATEGORIES[cat as FeedbackCategory].icon} {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={refreshData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Feedback List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {feedbackList.map((fb) => (
                <Card
                  key={fb.id}
                  className="p-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedFeedback(fb)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {renderStars(fb.rating)}
                        <Badge variant="outline" className="text-xs">
                          {FEEDBACK_CATEGORIES[fb.category].icon} {fb.category}
                        </Badge>
                        {getStatusBadge(fb.status)}
                      </div>
                      <p className="text-sm font-medium">{fb.originalText}</p>
                      <p className="text-xs text-muted-foreground">→ {fb.translatedText}</p>
                      {fb.suggestedText && (
                        <p className="text-xs text-green-500 mt-1">
                          💡 {fb.suggestedText}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(fb.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              ))}
              {feedbackList.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t('playerFeedback.noFeedback')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent>
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {FEEDBACK_CATEGORIES[selectedFeedback.category].icon}
                  {t('playerFeedback.feedbackDetail')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  {renderStars(selectedFeedback.rating)}
                  {getStatusBadge(selectedFeedback.status)}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">{t('playerFeedback.original')}</Label>
                  <p className="p-2 rounded bg-muted text-sm">{selectedFeedback.originalText}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">{t('playerFeedback.translated')}</Label>
                  <p className="p-2 rounded bg-muted text-sm">{selectedFeedback.translatedText}</p>
                </div>
                
                {selectedFeedback.suggestedText && (
                  <div className="space-y-2">
                    <Label className="text-xs">{t('playerFeedback.suggested')}</Label>
                    <p className="p-2 rounded bg-green-500/10 border border-green-500/20 text-sm">
                      {selectedFeedback.suggestedText}
                    </p>
                  </div>
                )}
                
                {selectedFeedback.comment && (
                  <div className="space-y-2">
                    <Label className="text-xs">{t('playerFeedback.comment')}</Label>
                    <p className="p-2 rounded bg-muted text-sm">{selectedFeedback.comment}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedFeedback.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'rejected')}
                      className="text-red-500"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('playerFeedback.reject')}
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'applied')}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('playerFeedback.apply')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('playerFeedback.submitNew')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">{t('playerFeedback.originalText')} *</Label>
              <Input
                value={newOriginal}
                onChange={(e) => setNewOriginal(e.target.value)}
                placeholder={t('playerFeedback.originalPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('playerFeedback.translatedText')} *</Label>
              <Input
                value={newTranslated}
                onChange={(e) => setNewTranslated(e.target.value)}
                placeholder={t('playerFeedback.translatedPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('playerFeedback.suggestedText')}</Label>
              <Input
                value={newSuggested}
                onChange={(e) => setNewSuggested(e.target.value)}
                placeholder={t('playerFeedback.suggestedPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">{t('playerFeedback.rating')}</Label>
                {renderStars(newRating, (r) => setNewRating(r as 1 | 2 | 3 | 4 | 5))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('playerFeedback.category')}</Label>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as FeedbackCategory)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(FEEDBACK_CATEGORIES).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {FEEDBACK_CATEGORIES[cat as FeedbackCategory].icon} {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('playerFeedback.comment')}</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('playerFeedback.commentPlaceholder')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              {t('playerFeedback.cancel')}
            </Button>
            <Button onClick={handleSubmitFeedback} className="bg-pink-600 hover:bg-pink-500">
              <Send className="h-4 w-4 mr-1" />
              {t('playerFeedback.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
