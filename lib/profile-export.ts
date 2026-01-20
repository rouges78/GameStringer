/**
 * Profile Export/Import utilities
 */
import { toast } from 'sonner';

export interface ProfileExportData {
  version: string;
  exportedAt: string;
  profile: {
    name: string;
    avatar_path?: string;
    created_at: string;
  };
  settings?: any;
}

export function exportProfile(profile: any, settings: any) {
  try {
    const exportData: ProfileExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: {
        name: profile.name,
        avatar_path: profile.avatar_path,
        created_at: profile.created_at,
      },
      settings: settings,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamestringer-profile-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Profilo esportato!', {
      description: `${profile.name} salvato come file JSON`
    });
  } catch (error) {
    toast.error('Errore esportazione', {
      description: 'Impossibile esportare il profilo'
    });
  }
}

export function importProfile(): Promise<ProfileExportData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const text = await file.text();
        const data = JSON.parse(text) as ProfileExportData;
        
        if (!data.version || !data.profile) {
          throw new Error('Formato file non valido');
        }
        
        toast.success('Profilo importato!', {
          description: `Dati di "${data.profile.name}" caricati`
        });
        
        localStorage.setItem('importedProfileData', text);
        resolve(data);
      } catch (error) {
        toast.error('Errore importazione', {
          description: 'File non valido o corrotto'
        });
        resolve(null);
      }
    };
    input.click();
  });
}
