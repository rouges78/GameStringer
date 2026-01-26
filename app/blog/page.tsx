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
  ArrowLeft
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

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-pink-500 to-red-500 p-3 text-white">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 bg-black/30 rounded-lg border border-white/10">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Gestione Blog</h1>
              <p className="text-white/60 text-[10px]">Aggiungi e modifica news</p>
            </div>
          </div>
          
          <Button 
            size="sm" 
            onClick={() => setIsAdding(true)}
            className="bg-white text-rose-600 hover:bg-white/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuovo Post
          </Button>
        </div>
      </div>

      {/* Form nuovo post */}
      {isAdding && (
        <Card className="border-rose-500/30">
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
      <div className="space-y-2">
        {posts.map(post => (
          <Card key={post.id} className={`${post.pinned ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
            <CardContent className="p-3">
              {editingId === post.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      value={form.date}
                      onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                      className="h-7 text-xs"
                    />
                    <select 
                      value={form.tag}
                      onChange={(e) => setForm(f => ({ ...f, tag: e.target.value }))}
                      className="h-7 text-xs rounded-md border bg-background px-2"
                    >
                      {tags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <Input 
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <Input 
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-6 text-xs" onClick={() => handleUpdate(post.id)}>
                      <Save className="h-3 w-3 mr-1" />
                      Salva
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditingId(null)}>
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0 pt-0.5">{post.date}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{post.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{post.tag}</Badge>
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className={`h-6 w-6 ${post.pinned ? 'text-yellow-500' : ''}`}
                      onClick={() => handleTogglePin(post.id, !!post.pinned)}
                    >
                      <Pin className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(post)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Newspaper className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessun post. Clicca "Nuovo Post" per iniziare.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
