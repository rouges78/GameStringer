'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  Key, 
  Clock, 
  Smartphone, 
  History, 
  Eye, 
  EyeOff,
  Check,
  X,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface SecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
}

interface ActivityLog {
  id: string;
  action: string;
  timestamp: Date;
  device: string;
  ip: string;
  success: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number; // minutes
  autoLockEnabled: boolean;
  autoLockTimeout: number; // minutes
  loginNotifications: boolean;
}

export function SecurityDialog({ open, onOpenChange, profileId, profileName }: SecurityDialogProps) {
  const [activeTab, setActiveTab] = useState('password');
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Security settings state
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: 60,
    autoLockEnabled: false,
    autoLockTimeout: 15,
    loginNotifications: true
  });
  
  // 2FA state
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  
  // Activity log
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  
  // Load settings and logs on mount
  useEffect(() => {
    if (open && profileId) {
      loadSecuritySettings();
      loadActivityLogs();
    }
  }, [open, profileId]);
  
  const loadSecuritySettings = () => {
    const saved = localStorage.getItem(`security_${profileId}`);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading security settings:', e);
      }
    }
  };
  
  const saveSecuritySettings = (newSettings: SecuritySettings) => {
    setSettings(newSettings);
    localStorage.setItem(`security_${profileId}`, JSON.stringify(newSettings));
    logActivity('Impostazioni sicurezza aggiornate');
  };
  
  const loadActivityLogs = () => {
    const saved = localStorage.getItem(`activity_${profileId}`);
    if (saved) {
      try {
        const logs = JSON.parse(saved).map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
        setActivityLogs(logs);
      } catch (e) {
        console.error('Error loading activity logs:', e);
      }
    } else {
      // Generate some mock logs for demo
      const mockLogs: ActivityLog[] = [
        {
          id: '1',
          action: 'Login effettuato',
          timestamp: new Date(),
          device: 'Windows 11 - Chrome',
          ip: '192.168.1.x',
          success: true
        },
        {
          id: '2',
          action: 'Profilo creato',
          timestamp: new Date(Date.now() - 3600000),
          device: 'Windows 11 - Chrome',
          ip: '192.168.1.x',
          success: true
        }
      ];
      setActivityLogs(mockLogs);
      localStorage.setItem(`activity_${profileId}`, JSON.stringify(mockLogs));
    }
  };
  
  const logActivity = (action: string, success: boolean = true) => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      action,
      timestamp: new Date(),
      device: navigator.userAgent.includes('Windows') ? 'Windows' : 'Unknown',
      ip: '192.168.1.x',
      success
    };
    
    const updatedLogs = [newLog, ...activityLogs].slice(0, 50); // Keep last 50
    setActivityLogs(updatedLogs);
    localStorage.setItem(`activity_${profileId}`, JSON.stringify(updatedLogs));
  };
  
  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter current password');
      return;
    }
    
    if (newPassword.length < 4) {
      toast.error('New password must be at least 4 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Le password non coincidono');
      return;
    }
    
    setIsChangingPassword(true);
    
    // Simulate password change
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Save new password hash (in real app, this would be hashed)
    localStorage.setItem(`password_${profileId}`, btoa(newPassword));
    
    logActivity('Password changed');
    toast.success('Password changed successfully!');
    
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
  };
  
  const handleSetup2FA = async () => {
    if (settings.twoFactorEnabled) {
      // Disable 2FA
      if (twoFactorCode !== '123456') { // Demo code
        toast.error('Codice non valido');
        return;
      }
      
      saveSecuritySettings({ ...settings, twoFactorEnabled: false });
      logActivity('2FA disabilitato');
      toast.success('Autenticazione a due fattori disabilitata');
      setTwoFactorCode('');
      setIsSettingUp2FA(false);
    } else {
      // Enable 2FA
      if (!isSettingUp2FA) {
        // Generate secret
        const secret = Math.random().toString(36).substring(2, 10).toUpperCase();
        setTwoFactorSecret(secret);
        setIsSettingUp2FA(true);
        return;
      }
      
      if (twoFactorCode.length !== 6) {
        toast.error('Enter a 6 digit code');
        return;
      }
      
      // Verify code (demo: accept any 6 digit code)
      saveSecuritySettings({ ...settings, twoFactorEnabled: true });
      logActivity('2FA abilitato');
      toast.success('Autenticazione a due fattori abilitata!');
      setTwoFactorCode('');
      setIsSettingUp2FA(false);
    }
  };
  
  const handleClearActivityLog = () => {
    setActivityLogs([]);
    localStorage.removeItem(`activity_${profileId}`);
    toast.success('Activity history cleared');
  };
  
  const handleLogoutAllSessions = () => {
    logActivity('Disconnected from all sessions');
    toast.success('Disconnected from all other sessions');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Sicurezza - {profileName}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="password" className="text-xs">
              <Key className="h-3 w-3 mr-1" />
              Password
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="2fa" className="text-xs">
              <Smartphone className="h-3 w-3 mr-1" />
              2FA
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              Activity
            </TabsTrigger>
          </TabsList>
          
          {/* Password Tab */}
          <TabsContent value="password" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4 mr-2" />
                  Cambia Password
                </CardTitle>
                <CardDescription className="text-xs">
                  Modifica la password del tuo profilo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-xs">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" /> Le password non coincidono
                    </p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Le password coincidono
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={handleChangePassword} 
                  disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="w-full"
                >
                  {isChangingPassword ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  Cambia Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Session Management
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure timeout and auto-lock
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Timeout Sessione</Label>
                    <p className="text-xs text-muted-foreground">
                      Disconnect after inactivity
                    </p>
                  </div>
                  <select
                    value={settings.sessionTimeout}
                    onChange={(e) => saveSecuritySettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                    className="bg-background border rounded-md px-3 py-1.5 text-sm"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={0}>Never</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Auto Lock</Label>
                    <p className="text-xs text-muted-foreground">
                      Require password after inactivity
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoLockEnabled}
                    onCheckedChange={(checked) => saveSecuritySettings({ ...settings, autoLockEnabled: checked })}
                  />
                </div>
                
                {settings.autoLockEnabled && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Timeout Blocco</Label>
                    </div>
                    <select
                      value={settings.autoLockTimeout}
                      onChange={(e) => saveSecuritySettings({ ...settings, autoLockTimeout: Number(e.target.value) })}
                      className="bg-background border rounded-md px-3 py-1.5 text-sm"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Notifiche Login</Label>
                    <p className="text-xs text-muted-foreground">
                      Avvisa per nuovi accessi
                    </p>
                  </div>
                  <Switch
                    checked={settings.loginNotifications}
                    onCheckedChange={(checked) => saveSecuritySettings({ ...settings, loginNotifications: checked })}
                  />
                </div>
                
                <div className="pt-4 border-t">
                  <Button variant="destructive" onClick={handleLogoutAllSessions} className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect All Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 2FA Tab */}
          <TabsContent value="2fa" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Two-Factor Authentication
                  {settings.twoFactorEnabled ? (
                    <Badge className="bg-green-500 text-xs">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Add an extra layer of security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!settings.twoFactorEnabled && !isSettingUp2FA && (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Protect your account with a second authentication factor
                    </p>
                    <Button onClick={handleSetup2FA}>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Configure 2FA
                    </Button>
                  </div>
                )}
                
                {!settings.twoFactorEnabled && isSettingUp2FA && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-2">Your secret code:</p>
                      <p className="text-2xl font-mono font-bold tracking-wider">{twoFactorSecret}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Save it in an authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Enter verification code</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsSettingUp2FA(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={handleSetup2FA} className="flex-1">
                        <Check className="h-4 w-4 mr-2" />
                        Verify
                      </Button>
                    </div>
                  </div>
                )}
                
                {settings.twoFactorEnabled && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Unlock className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-500">2FA Attivo</p>
                        <p className="text-xs text-muted-foreground">
                          Il tuo account è protetto
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Enter code to disable</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Demo: usa 123456</p>
                    </div>
                    
                    <Button variant="destructive" onClick={handleSetup2FA} className="w-full">
                      <X className="h-4 w-4 mr-2" />
                      Disabilita 2FA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Activity History
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Recent logins and changes
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearActivityLog}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {activityLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activity recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activityLogs.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border",
                            log.success 
                              ? "bg-muted/30 border-muted" 
                              : "bg-red-500/10 border-red-500/20"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            log.success ? "bg-green-500/20" : "bg-red-500/20"
                          )}>
                            {log.success ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: it })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {log.device} • {log.ip}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
