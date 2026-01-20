'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FolderOpen, 
  Save, 
  Download, 
  Upload, 
  Plus, 
  FileText, 
  Settings,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  BookOpen,
  BarChart3,
  Globe,
  Gamepad2,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { projectManager, GameStringerProject, ProjectFile } from '@/lib/project-manager';

export function ProjectManagerUI() {
  const [project, setProject] = useState<GameStringerProject | null>(null);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectAuthor, setNewProjectAuthor] = useState('');
  const [newProjectGame, setNewProjectGame] = useState('');
  const [newProjectSourceLang, setNewProjectSourceLang] = useState('en');
  const [newProjectTargetLang, setNewProjectTargetLang] = useState('it');

  // Load project on startup if exists
  useEffect(() => {
    if (projectManager.hasProject) {
      setProject(projectManager.project);
    }
  }, []);

  // Create new project
  const handleCreateProject = useCallback(() => {
    if (!newProjectName.trim()) {
      toast.error('Enter a project name');
      return;
    }

    const newProject = projectManager.createProject({
      name: newProjectName,
      description: newProjectDescription,
      author: newProjectAuthor,
      gameName: newProjectGame,
      sourceLanguage: newProjectSourceLang,
      targetLanguage: newProjectTargetLang,
    });

    setProject(newProject);
    setIsNewProjectDialogOpen(false);
    
    // Reset form
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectAuthor('');
    setNewProjectGame('');
    
    toast.success('Project created successfully!');
  }, [newProjectName, newProjectDescription, newProjectAuthor, newProjectGame, newProjectSourceLang, newProjectTargetLang]);

  // Open project
  const handleOpenProject = useCallback(async () => {
    try {
      const loadedProject = await projectManager.importProject();
      if (loadedProject) {
        setProject(loadedProject);
        toast.success(`Project "${loadedProject.metadata.name}" loaded`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error opening project');
    }
  }, []);

  // Save project
  const handleSaveProject = useCallback(async () => {
    try {
      if (projectManager.path) {
        await projectManager.saveProject();
        toast.success('Project saved');
      } else {
        const path = await projectManager.exportProject();
        if (path) {
          toast.success('Project saved');
        }
      }
      setProject(projectManager.project);
    } catch (error: any) {
      toast.error(error.message || 'Save error');
    }
  }, []);

  // Save as
  const handleSaveAs = useCallback(async () => {
    try {
      const path = await projectManager.exportProject();
      if (path) {
        toast.success('Project saved');
        setProject(projectManager.project);
      }
    } catch (error: any) {
      toast.error(error.message || 'Save error');
    }
  }, []);

  // Export translations
  const handleExportTranslations = useCallback(async (format: 'json' | 'csv' | 'po') => {
    try {
      const path = await projectManager.exportTranslations(format);
      if (path) {
        toast.success(`Translations exported to ${format.toUpperCase()}`);
        setIsExportDialogOpen(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Export error');
    }
  }, []);

  // Add files to project
  const handleAddFiles = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const files = await open({
        multiple: true,
        filters: [
          { name: 'Translation Files', extensions: ['json', 'po', 'csv', 'resx', 'xliff', 'yaml', 'yml', 'txt', 'xml'] }
        ]
      });

      if (files && Array.isArray(files)) {
        for (const filePath of files) {
          const fileName = (filePath as string).split(/[/\\]/).pop() || 'unknown';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          
          projectManager.addFile({
            path: filePath as string,
            relativePath: fileName,
            fileType: ext.toUpperCase(),
            entries: [], // TODO: Parse file content
          });
        }
        
        setProject({ ...projectManager.project! });
        toast.success(`${files.length} files added to project`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error adding files');
    }
  }, []);

  // Remove file
  const handleRemoveFile = useCallback((filePath: string) => {
    projectManager.removeFile(filePath);
    setProject({ ...projectManager.project! });
    toast.success('File removed');
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-cyan-950/80 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
              <FolderOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                Project Manager
              </h1>
              <p className="text-sm text-emerald-200/60 mt-1">
                {project ? project.metadata.name : 'Manage your translation projects'}
              </p>
            </div>
          </div>
          
          {/* Stats */}
          {project && (
            <div className="hidden md:flex gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400">
                  <FileText className="h-4 w-4" />
                  <span className="text-lg font-bold">{project.statistics.totalFiles}</span>
                </div>
                <p className="text-xs text-emerald-200/50">File</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-teal-400">
                  <Globe className="h-4 w-4" />
                  <span className="text-lg font-bold">{project.statistics.totalStrings.toLocaleString()}</span>
                </div>
                <p className="text-xs text-emerald-200/50">Strings</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-cyan-400">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-lg font-bold">{project.statistics.progress}%</span>
                </div>
                <p className="text-xs text-emerald-200/50">Completed</p>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="relative flex flex-wrap gap-2 mt-6 pt-4 border-t border-emerald-500/20">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsNewProjectDialogOpen(true)}
            className="border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenProject}
            className="border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Upload className="h-4 w-4 mr-1" />
            Open
          </Button>
          
          {project && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveProject}
                className="border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveAs}
                className="border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Download className="h-4 w-4 mr-1" />
                Save as...
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsExportDialogOpen(true)}
                className="border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
              >
                <Download className="h-4 w-4 mr-1" />
                Export translations
              </Button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {project && (
          <div className="relative mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-emerald-200/70">Translation progress</span>
              <span className="text-xs font-semibold text-emerald-300">{project.statistics.progress}%</span>
            </div>
            <Progress value={project.statistics.progress} className="h-2 bg-emerald-950/50" />
          </div>
        )}
      </div>

      {/* Project content */}
      {project ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">File ({project.files.length})</TabsTrigger>
            <TabsTrigger value="glossary">Glossary ({Object.keys(project.glossary).length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project info */}
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-300">
                    <FileText className="h-4 w-4" />
                    Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{project.metadata.name}</span>
                  </div>
                  {project.metadata.description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="font-medium truncate max-w-[200px]">{project.metadata.description}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">{project.metadata.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(project.metadata.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modified:</span>
                    <span className="font-medium">{formatDate(project.metadata.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Game info */}
              <Card className="border-teal-500/20 bg-teal-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-teal-300">
                    <Gamepad2 className="h-4 w-4" />
                    Associated Game
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {project.metadata.gameName ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{project.metadata.gameName}</span>
                      </div>
                      {project.metadata.gamePlatform && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform:</span>
                          <Badge variant="outline">{project.metadata.gamePlatform}</Badge>
                        </div>
                      )}
                      {project.metadata.gameEngine && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Engine:</span>
                          <Badge variant="outline">{project.metadata.gameEngine}</Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No associated game
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Statistics */}
              <Card className="border-cyan-500/20 bg-cyan-500/5 md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-cyan-300">
                    <BarChart3 className="h-4 w-4" />
                    Translation Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-emerald-400">{project.statistics.totalFiles}</div>
                      <div className="text-xs text-muted-foreground">Total files</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-teal-400">{project.statistics.totalStrings.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Total strings</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-blue-400">{project.statistics.translatedStrings.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Translated</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-purple-400">{project.statistics.reviewedStrings.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Reviewed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-green-400">{project.statistics.approvedStrings.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Approved</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* File */}
          <TabsContent value="files">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Project Files</CardTitle>
                  <Button size="sm" onClick={handleAddFiles}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Files
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {project.files.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No files in project</p>
                    <p className="text-xs mt-1">Add files to start translating</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {project.files.map((file) => (
                        <div 
                          key={file.path}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">{file.relativePath}</div>
                              <div className="text-xs text-muted-foreground">
                                {file.fileType} • {file.totalStrings} strings • {file.translatedStrings} translated
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={file.totalStrings > 0 ? (file.translatedStrings / file.totalStrings) * 100 : 0} 
                              className="w-20 h-2"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-400"
                              onClick={() => handleRemoveFile(file.path)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Glossario */}
          <TabsContent value="glossary">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Project Glossary
                </CardTitle>
                <CardDescription>
                  Terms to always translate the same way
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(project.glossary).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Empty glossary</p>
                    <p className="text-xs mt-1">Add terms to maintain consistency</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {Object.entries(project.glossary).map(([original, translated]) => (
                        <div 
                          key={original}
                          className="flex items-center justify-between p-2 rounded border border-border/50"
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm">{original}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono text-sm text-emerald-400">{translated}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-red-400"
                            onClick={() => {
                              projectManager.removeGlossaryTerm(original);
                              setProject({ ...projectManager.project! });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impostazioni */}
          <TabsContent value="settings">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Project Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source language</Label>
                    <Select 
                      value={project.settings.sourceLanguage}
                      onValueChange={(value) => {
                        project.settings.sourceLanguage = value;
                        setProject({ ...project });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                        <SelectItem value="zh">🇨🇳 中文</SelectItem>
                        <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                        <SelectItem value="auto">🔍 Auto-detect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target language</Label>
                    <Select 
                      value={project.settings.targetLanguage}
                      onValueChange={(value) => {
                        project.settings.targetLanguage = value;
                        setProject({ ...project });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="es">🇪🇸 Español</SelectItem>
                        <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                        <SelectItem value="fr">🇫🇷 Français</SelectItem>
                        <SelectItem value="pt">🇵🇹 Português</SelectItem>
                        <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Translation service</Label>
                  <Select 
                    value={project.settings.translationService}
                    onValueChange={(value) => {
                      project.settings.translationService = value;
                      setProject({ ...project });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">🦙 Ollama (Locale)</SelectItem>
                      <SelectItem value="openai">🤖 OpenAI</SelectItem>
                      <SelectItem value="claude">🧠 Claude</SelectItem>
                      <SelectItem value="deepl">📝 DeepL</SelectItem>
                      <SelectItem value="google">🌐 Google Translate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* No project open */
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">No project open</h3>
            <p className="text-muted-foreground mb-6">
              Create a new project or open an existing one (.gsproj)
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setIsNewProjectDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button variant="outline" onClick={handleOpenProject}>
                <Upload className="h-4 w-4 mr-2" />
                Open Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog New Project */}
      <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a new translation project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project name *</Label>
              <Input 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Dark Souls Translation"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Author</Label>
              <Input 
                value={newProjectAuthor}
                onChange={(e) => setNewProjectAuthor(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Game (optional)</Label>
              <Input 
                value={newProjectGame}
                onChange={(e) => setNewProjectGame(e.target.value)}
                placeholder="Game name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source language</Label>
                <Select value={newProjectSourceLang} onValueChange={setNewProjectSourceLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                    <SelectItem value="zh">🇨🇳 中文</SelectItem>
                    <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target language</Label>
                <Select value={newProjectTargetLang} onValueChange={setNewProjectTargetLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Translations Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Translations</DialogTitle>
            <DialogDescription>
              Choose export format
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleExportTranslations('json')}
            >
              <FileText className="h-6 w-6 mb-2" />
              JSON
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleExportTranslations('csv')}
            >
              <FileText className="h-6 w-6 mb-2" />
              CSV
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleExportTranslations('po')}
            >
              <FileText className="h-6 w-6 mb-2" />
              PO (Gettext)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectManagerUI;



