'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Newspaper, 
  Plus, 
  Trash2, 
  Edit2, 
  Pin, 
  Save,
  X,
  ArrowLeft,
  Image,
  Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { blogService, BlogPost } from '@/lib/blog';
import { useTranslation } from '@/lib/i18n';

export default function BlogPage() {
  const { t, language } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', title: '', description: '', tag: 'Update', image: '', gameName: '' });

  useEffect(() => {
    setPosts(blogService.getPosts());
  }, []);

  const resetForm = () => setForm({ date: '', title: '', description: '', tag: 'Update', image: '', gameName: '' });

  const handleAdd = () => {
    if (!form.title || !form.date) {
      toast.error(language === 'it' ? 'Compila titolo e data' : 'Fill in title and date');
      return;
    }
    
    blogService.addPost({
      date: form.date,
      title: form.title,
      description: form.description,
      tag: form.tag,
      ...(form.image && { image: form.image }),
      ...(form.gameName && { gameName: form.gameName }),
    });
    
    setPosts(blogService.getPosts());
    resetForm();
    setIsAdding(false);
    toast.success(language === 'it' ? 'Notizia pubblicata!' : 'News published!');
  };

  const handleUpdate = (id: string) => {
    blogService.updatePost(id, {
      date: form.date,
      title: form.title,
      description: form.description,
      tag: form.tag,
      image: form.image || undefined,
      gameName: form.gameName || undefined,
    });
    
    setPosts(blogService.getPosts());
    setEditingId(null);
    resetForm();
    toast.success(language === 'it' ? 'Notizia aggiornata!' : 'News updated!');
  };

  const handleDelete = (id: string) => {
    if (confirm(language === 'it' ? 'Eliminare questa notizia?' : 'Delete this news?')) {
      blogService.deletePost(id);
      setPosts(blogService.getPosts());
      toast.success(language === 'it' ? 'Notizia eliminata' : 'News deleted');
    }
  };

  const handleTogglePin = (id: string, currentPinned: boolean) => {
    blogService.updatePost(id, { pinned: !currentPinned });
    setPosts(blogService.getPosts());
    toast.success(currentPinned 
      ? (language === 'it' ? 'Rimosso dai preferiti' : 'Unpinned') 
      : (language === 'it' ? 'Fissato in alto' : 'Pinned'));
  };

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      date: post.date,
      title: post.title,
      description: post.description,
      tag: post.tag,
      image: post.image || '',
      gameName: post.gameName || '',
    });
  };

  const tags = ['Feature', 'UI', 'Fix', 'Security', 'AI', 'Update', 'News', 'Patch', 'Release'];

  const tagColors: Record<string, string> = {
    Feature: 'text-emerald-400 bg-emerald-500/20',
    UI: 'text-violet-400 bg-violet-500/20',
    Fix: 'text-orange-400 bg-orange-500/20',
    Security: 'text-yellow-400 bg-yellow-500/20',
    AI: 'text-cyan-400 bg-cyan-500/20',
    Update: 'text-blue-400 bg-blue-500/20',
    News: 'text-pink-400 bg-pink-500/20',
    Patch: 'text-amber-400 bg-amber-500/20',
    Release: 'text-green-400 bg-green-500/20',
  };

  // Form condiviso per nuovo post e modifica
  const renderForm = (onSave: () => void, onCancel: () => void) => (
    <div className="rounded-sm bg-[#1b2838] border border-[#2a475e] p-4 space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 block">
            {language === 'it' ? 'Data' : 'Date'}
          </label>
          <Input 
            value={form.date}
            onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
            placeholder="20 Mar"
            className="h-8 text-xs bg-[#171d25] border-[#2a475e] text-[#c6d4df] placeholder:text-[#8f98a0]/40 focus:border-[#67c1f5]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 block">Tag</label>
          <select 
            value={form.tag}
            onChange={(e) => setForm(f => ({ ...f, tag: e.target.value }))}
            className="w-full h-8 text-xs rounded-md border border-[#2a475e] bg-[#171d25] text-[#c6d4df] px-2 focus:border-[#67c1f5] focus:outline-none"
          >
            {tags.map(tg => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1 ">
            <Gamepad2 className="h-3 w-3" /> {language === 'it' ? 'Gioco' : 'Game'}
          </label>
          <Input 
            value={form.gameName}
            onChange={(e) => setForm(f => ({ ...f, gameName: e.target.value }))}
            placeholder={language === 'it' ? 'Nome gioco (opzionale)' : 'Game name (optional)'}
            className="h-8 text-xs bg-[#171d25] border-[#2a475e] text-[#c6d4df] placeholder:text-[#8f98a0]/40 focus:border-[#67c1f5]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            <Image className="h-3 w-3" /> {language === 'it' ? 'Immagine URL' : 'Image URL'}
          </label>
          <Input 
            value={form.image}
            onChange={(e) => setForm(f => ({ ...f, image: e.target.value }))}
            placeholder="https://..."
            className="h-8 text-xs bg-[#171d25] border-[#2a475e] text-[#c6d4df] placeholder:text-[#8f98a0]/40 focus:border-[#67c1f5]"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 block">
          {language === 'it' ? 'Titolo' : 'Title'}
        </label>
        <Input 
          value={form.title}
          onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={language === 'it' ? 'Titolo della notizia...' : 'News title...'}
          className="h-8 text-sm bg-[#171d25] border-[#2a475e] text-[#c6d4df] placeholder:text-[#8f98a0]/40 focus:border-[#67c1f5] font-medium"
        />
      </div>
      <div>
        <label className="text-[10px] text-[#8f98a0] uppercase tracking-wider font-semibold mb-1 block">
          {language === 'it' ? 'Descrizione' : 'Description'}
        </label>
        <textarea 
          value={form.description}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder={language === 'it' ? 'Descrizione della notizia...' : 'News description...'}
          rows={3}
          className="w-full text-xs bg-[#171d25] border border-[#2a475e] text-[#c6d4df] placeholder:text-[#8f98a0]/40 focus:border-[#67c1f5] focus:outline-none rounded-md px-3 py-2 resize-none"
        />
      </div>
      {/* Preview immagine */}
      {form.image && (
        <div className="flex items-center gap-3 p-2 rounded bg-[#171d25] border border-[#2a475e]/50">
          <img src={form.image} alt="Preview" className="w-[120px] h-[68px] rounded-sm object-cover border border-black/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-[10px] text-[#8f98a0]">{language === 'it' ? 'Anteprima immagine' : 'Image preview'}</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} className="h-7 text-xs bg-[#1a9fff] hover:bg-[#67c1f5] text-white">
          <Save className="h-3 w-3 mr-1" /> {language === 'it' ? 'Salva' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs border-[#2a475e] text-[#8f98a0] hover:bg-[#2a475e]/30">
          <X className="h-3 w-3 mr-1" /> {language === 'it' ? 'Annulla' : 'Cancel'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ background: 'linear-gradient(180deg, #1b2838 0%, #171d25 40%, #0e1419 100%)' }}>
      {/* Header stile Steam */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="h-8 w-8 rounded-sm bg-[#2a475e]/30 hover:bg-[#2a475e]/50 flex items-center justify-center transition-colors">
              <ArrowLeft className="h-4 w-4 text-[#67c1f5]" />
            </button>
          </Link>
          <Newspaper className="h-5 w-5 text-[#67c1f5]" />
          <div>
            <h1 className="text-base font-bold text-[#c6d4df]">News & {language === 'it' ? 'Aggiornamenti' : 'Updates'}</h1>
            <p className="text-[10px] text-[#8f98a0]">{language === 'it' ? 'Gestisci il feed notizie della dashboard' : 'Manage the dashboard news feed'}</p>
          </div>
        </div>
        
        <button 
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1a9fff] hover:bg-[#67c1f5] text-white text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {language === 'it' ? 'Nuova Notizia' : 'New Post'}
        </button>
      </div>

      {/* Form nuovo post */}
      {isAdding && renderForm(handleAdd, () => { setIsAdding(false); resetForm(); })}

      {/* Lista post */}
      <div className="space-y-1">
        {posts.map((post) => (
          <div key={post.id}>
            {editingId === post.id ? (
              renderForm(() => handleUpdate(post.id), () => { setEditingId(null); resetForm(); })
            ) : (
              <div className={`group flex gap-3 p-3 rounded-sm border transition-all cursor-default ${
                post.pinned 
                  ? 'bg-[#1b2838] border-[#67c1f5]/30' 
                  : 'bg-[#1b2838]/60 border-transparent hover:bg-[#1b2838] hover:border-[#2a475e]'
              }`}>
                {/* Thumbnail */}
                {post.image ? (
                  <img src={post.image} alt={post.title} className="w-[140px] h-[80px] rounded-sm object-cover flex-shrink-0 border border-black/30" />
                ) : (
                  <div className="w-[140px] h-[80px] rounded-sm flex-shrink-0 border border-[#2a475e]/40 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #1b2838 0%, #2a475e 100%)' }}>
                    {post.gameName ? (
                      <span className="text-[10px] font-bold text-[#67c1f5]/50 text-center px-2">{post.gameName}</span>
                    ) : (
                      <Newspaper className="h-6 w-6 text-[#67c1f5]/15" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] text-[#8f98a0]/60">{post.date}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${tagColors[post.tag] || 'text-[#8f98a0] bg-[#2a475e]/30'}`}>
                        {post.tag}
                      </span>
                      {post.gameName && (
                        <span className="text-[8px] text-[#67c1f5]/60 flex items-center gap-0.5">
                          <Gamepad2 className="h-2.5 w-2.5" /> {post.gameName}
                        </span>
                      )}
                      {post.pinned && (
                        <Pin className="h-2.5 w-2.5 text-[#67c1f5] fill-[#67c1f5]/30" />
                      )}
                    </div>
                    <h3 className="text-[13px] font-bold text-[#c6d4df] leading-snug line-clamp-1">{post.title}</h3>
                  </div>
                  <p className="text-[11px] text-[#8f98a0] line-clamp-2 leading-relaxed mt-0.5">{post.description}</p>
                </div>

                {/* Azioni */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleTogglePin(post.id, !!post.pinned)}
                    className={`h-6 w-6 rounded-sm flex items-center justify-center transition-colors ${post.pinned ? 'text-[#67c1f5] bg-[#1a9fff]/20' : 'text-[#8f98a0] hover:bg-[#2a475e]/40'}`}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  <button onClick={() => startEdit(post)} className="h-6 w-6 rounded-sm flex items-center justify-center text-[#8f98a0] hover:bg-[#2a475e]/40 transition-colors">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(post.id)} className="h-6 w-6 rounded-sm flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {posts.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-sm bg-[#2a475e]/20 flex items-center justify-center mb-4">
            <Newspaper className="h-8 w-8 text-[#67c1f5]/20" />
          </div>
          <p className="text-sm font-medium text-[#c6d4df]/60 mb-1">{language === 'it' ? 'Nessuna notizia' : 'No news yet'}</p>
          <p className="text-[11px] text-[#8f98a0]/40 mb-4">{language === 'it' ? 'Crea la prima notizia per popolare il feed della dashboard' : 'Create the first news to populate the dashboard feed'}</p>
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#1a9fff] hover:bg-[#67c1f5] text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {language === 'it' ? 'Crea prima notizia' : 'Create first post'}
          </button>
        </div>
      )}
    </div>
  );
}
