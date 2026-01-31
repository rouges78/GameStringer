'use client';

import { useState, useEffect } from 'react';
import { Rss, ExternalLink, RefreshCw, Settings, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { getRssFeeds, saveRssFeeds, RssFeed, defaultRssFeeds } from '@/components/ui/rss-ticker';
import { useTranslation } from '@/lib/i18n';

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  source: string;
}

export default function RssViewerPage() {
  const { t, language } = useTranslation();
  const [items, setItems] = useState<RssItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');

  const loadFeeds = async () => {
    setIsLoading(true);
    const savedFeeds = getRssFeeds();
    setFeeds(savedFeeds);
    
    const enabledFeeds = savedFeeds.filter(f => f.enabled);
    const allItems: RssItem[] = [];

    for (const feed of enabledFeeds) {
      try {
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const response = await fetch(corsProxy + encodeURIComponent(feed.url), {
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'text/xml');
          const rssItems = xml.querySelectorAll('item');

          rssItems.forEach((item, idx) => {
            if (idx < 10) {
              const title = item.querySelector('title')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '#';
              const description = item.querySelector('description')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || '';
              allItems.push({ title, link, description, pubDate, source: feed.name });
            }
          });
        }
      } catch {
        // Feed non raggiungibile
      }
    }

    setItems(allItems);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFeeds();
  }, []);

  const toggleFeed = (url: string) => {
    const updated = feeds.map(f => 
      f.url === url ? { ...f, enabled: !f.enabled } : f
    );
    setFeeds(updated);
    saveRssFeeds(updated);
  };

  const addFeed = () => {
    if (!newFeedUrl.trim() || !newFeedName.trim()) return;
    const updated = [...feeds, { url: newFeedUrl, name: newFeedName, enabled: true }];
    setFeeds(updated);
    saveRssFeeds(updated);
    setNewFeedUrl('');
    setNewFeedName('');
  };

  const removeFeed = (url: string) => {
    const updated = feeds.filter(f => f.url !== url);
    setFeeds(updated);
    saveRssFeeds(updated);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const locale = language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : `${language}-${language.toUpperCase()}`;
      return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950/10 to-slate-950 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Rss className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{t('rss.title')}</h1>
              <p className="text-xs text-gray-400">{items.length} {t('rss.news')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadFeeds}
              disabled={isLoading}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
              className={showSettings ? 'text-orange-400' : 'text-gray-400 hover:text-white'}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-medium text-white">{t('rss.manageFeeds')}</h3>
              
              {feeds.map((feed) => (
                <div key={feed.url} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch 
                      checked={feed.enabled} 
                      onCheckedChange={() => toggleFeed(feed.url)}
                    />
                    <span className="text-sm text-gray-300 truncate">{feed.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeFeed(feed.url)}
                    className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <Input
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  placeholder={t('rss.feedName')}
                  className="bg-slate-800 border-slate-600 h-8 text-sm"
                />
                <Input
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  placeholder={t('rss.feedUrl')}
                  className="bg-slate-800 border-slate-600 h-8 text-sm flex-1"
                />
                <Button size="sm" onClick={addFeed} className="bg-orange-600 hover:bg-orange-700 h-8">
                  <Check className="h-4 w-4" />
                </Button>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadFeeds}
                className="w-full mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('rss.reload')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* News List */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 text-orange-400 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Rss className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('rss.noNews')}</p>
              <p className="text-xs mt-1">{t('rss.enableFeed')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-orange-500/30 hover:bg-slate-900/80 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">
                          {item.source}
                        </span>
                        {item.pubDate && (
                          <span className="text-[10px] text-gray-500">
                            {formatDate(item.pubDate)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-white group-hover:text-orange-300 transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {stripHtml(item.description)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-600 group-hover:text-orange-400 shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
