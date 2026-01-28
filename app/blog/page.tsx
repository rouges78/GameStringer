'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Newspaper, 
  Plus, 
  Trash2, 
  Edit2, 
  Pin, 
  Save,
  X,
  ArrowLeft,
  Sparkles,
  Calendar,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { blogService, BlogPost } from '@/lib/blog';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', title: '', description: '', tag: 'Update' });

  useEffect(() => {
    setPosts(blogService.getPosts());
  }, []);

  const handleAdd = () => {
    if (!form.title || !form.date) {
      toast.error('Compila titolo e data');
      return;
    }
    
    blogService.addPost({
      date: form.date,
      title: form.title,
      description: form.description,
      tag: form.tag,
    });
    
    setPosts(blogService.getPosts());
    setForm({ date: '', title: '', description: '', tag: 'Update' });
    setIsAdding(false);
    toast.success('Post aggiunto!');
  };

  const handleUpdate = (id: string) => {
    blogService.updatePost(id, {
      date: form.date,
      title: form.title,
      description: form.description,
      tag: form.tag,
    });
    
    setPosts(blogService.getPosts());
    setEditingId(null);
    setForm({ date: '', title: '', description: '', tag: 'Update' });
    toast.success('Post aggiornato!');
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminare questo post?')) {
      blogService.deletePost(id);
      setPosts(blogService.getPosts());
      toast.success('Post eliminato');
    }
  };

  const handleTogglePin = (id: string, currentPinned: boolean) => {
    blogService.updatePost(id, { pinned: !currentPinned });
    setPosts(blogService.getPosts());
    toast.success(currentPinned ? 'Post rimosso dai preferiti' : 'Post fissato in alto');
  };

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      date: post.date,
      title: post.title,
      description: post.description,
      tag: post.tag,
    });
  };

  const tags = ['Feature', 'UI', 'Fix', 'Security', 'AI', 'Update', 'News'];

  const tagColors: Record<string, string> = {
    Feature: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    UI: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    Fix: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Security: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    AI: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    Update: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    News: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-black/10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 bg-black/20 rounded-lg">
              <Newspaper className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black">Gestione Blog</h1>
              <p className="text-black/60 text-[10px]">Aggiungi e modifica news</p>
            </div>
          </div>
          
          <Button 
            size="sm" 
            onClick={() => setIsAdding(true)}
            className="bg-white text-orange-600 hover:bg-white/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuovo Post
          </Button>
        </div>
      </div>

      {/* Form nuovo post */}
      {isAdding && (
        <Card className="border-orange-500/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuovo Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data (es. "24 Gen")</Label>
                <Input 
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  placeholder="24 Gen"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Tag</Label>
                <select 
                  value={form.tag}
                  onChange={(e) => setForm(f => ({ ...f, tag: e.target.value }))}
                  className="w-full h-8 text-sm rounded-md border bg-background px-2"
                >
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Titolo (usa emoji!)</Label>
              <Input 
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="🎮 Nuova funzionalità..."
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Descrizione</Label>
              <Input 
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrizione..."
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                <Save className="h-3 w-3 mr-1" />
                Salva
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
                <X className="h-3 w-3 mr-1" />
                Annulla
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista post */}
      <div className="space-y-3">
        {posts.map((post, index) => (
          <div 
            key={post.id} 
            className={`group relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-xl ${
              post.pinned 
                ? 'border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent shadow-lg shadow-yellow-500/10' 
                : 'border-white/10 bg-gradient-to-r from-slate-800/50 via-slate-900/50 to-slate-800/50 hover:border-rose-500/30 hover:shadow-rose-500/10'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/5 to-fuchsia-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {post.pinned && (
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-500/20 to-transparent" />
            )}
            
            <div className="relative p-4">
              {editingId === post.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Data
                      </Label>
                      <Input 
                        value={form.date}
                        onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                        className="h-8 text-xs bg-black/20"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tag
                      </Label>
                      <select 
                        value={form.tag}
                        onChange={(e) => setForm(f => ({ ...f, tag: e.target.value }))}
                        className="w-full h-8 text-xs rounded-md border bg-black/20 px-2"
                      >
                        {tags.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <Input 
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Titolo"
                    className="h-8 text-xs bg-black/20"
                  />
                  <Input 
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrizione"
                    className="h-8 text-xs bg-black/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500" onClick={() => handleUpdate(post.id)}>
                      <Save className="h-3 w-3 mr-1" />
                      Salva
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3 mr-1" />
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Data stilizzata */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-lg font-bold text-white/90">{post.date.split(' ')[0]}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{post.date.split(' ')[1]}</div>
                  </div>
                  
                  {/* Separatore verticale */}
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                  
                  {/* Contenuto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/90 truncate group-hover:text-rose-300 transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{post.description}</p>
                  </div>
                  
                  {/* Tag colorato */}
                  <Badge className={`text-[10px] font-medium border ${tagColors[post.tag] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {post.tag}
                  </Badge>
                  
                  {/* Azioni con hover */}
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className={`h-7 w-7 rounded-lg transition-all ${post.pinned ? 'text-yellow-400 bg-yellow-500/20' : 'hover:bg-white/10'}`}
                      onClick={() => handleTogglePin(post.id, !!post.pinned)}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-white/10" onClick={() => startEdit(post)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300" onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-gradient-to-br from-slate-900/50 to-slate-800/30 p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-fuchsia-500/5" />
          <div className="relative">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
              <Newspaper className="h-8 w-8 text-rose-400" />
            </div>
            <p className="text-lg font-semibold text-white/80 mb-1">Nessun post ancora</p>
            <p className="text-sm text-muted-foreground mb-4">Clicca "Nuovo Post" per creare il primo articolo</p>
            <Button onClick={() => setIsAdding(true)} className="bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-400 hover:to-fuchsia-400">
              <Plus className="h-4 w-4 mr-1.5" />
              Crea il primo post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
