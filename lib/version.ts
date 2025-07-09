import versionData from '../version.json';

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  buildNumber: number;
  buildDate: string;
  gitHash: string;
  branch: string;
  changelog?: Record<string, {
    date: string;
    type: 'major' | 'minor' | 'patch';
    changes: string[];
  }>;
}

export class Version {
  private static instance: Version;
  private versionInfo: VersionInfo;

  private constructor() {
    this.versionInfo = versionData as VersionInfo;
  }

  public static getInstance(): Version {
    if (!Version.instance) {
      Version.instance = new Version();
    }
    return Version.instance;
  }

  public getVersion(): string {
    return this.versionInfo.version;
  }

  public getFullVersion(): string {
    return `${this.versionInfo.version}.${this.versionInfo.buildNumber}`;
  }

  public getBuildInfo(): {
    version: string;
    build: number;
    date: string;
    git: string;
    branch: string;
  } {
    return {
      version: this.versionInfo.version,
      build: this.versionInfo.buildNumber,
      date: this.versionInfo.buildDate,
      git: this.versionInfo.gitHash,
      branch: this.versionInfo.branch,
    };
  }

  public getChangelog(version?: string): string[] | null {
    if (!this.versionInfo.changelog) return null;
    
    if (version) {
      return this.versionInfo.changelog[version]?.changes || null;
    }
    
    // Ritorna changelog della versione corrente
    return this.versionInfo.changelog[this.versionInfo.version]?.changes || null;
  }

  public getAllVersions(): Array<{
    version: string;
    date: string;
    type: string;
    changes: string[];
  }> {
    if (!this.versionInfo.changelog) return [];
    
    return Object.entries(this.versionInfo.changelog)
      .map(([version, info]) => ({
        version,
        date: info.date,
        type: info.type,
        changes: info.changes,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public isNewerThan(otherVersion: string): boolean {
    const [otherMajor, otherMinor, otherPatch] = otherVersion.split('.').map(Number);
    
    if (this.versionInfo.major !== otherMajor) {
      return this.versionInfo.major > otherMajor;
    }
    if (this.versionInfo.minor !== otherMinor) {
      return this.versionInfo.minor > otherMinor;
    }
    return this.versionInfo.patch > otherPatch;
  }

  public formatBuildDate(): string {
    return new Date(this.versionInfo.buildDate).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  public getVersionColor(): string {
    // Colori basati sul tipo di versione
    const { major, minor, patch } = this.versionInfo;
    
    if (major >= 4) return 'text-purple-400'; // Futuro
    if (major >= 3 && minor >= 5) return 'text-blue-400'; // Stabile avanzata
    if (major >= 3) return 'text-green-400'; // Stabile corrente
    if (major >= 2) return 'text-yellow-400'; // Legacy
    return 'text-red-400'; // Molto vecchia
  }
}

// Utility hooks per React
export function useVersion() {
  const version = Version.getInstance();
  
  return {
    version: version.getVersion(),
    fullVersion: version.getFullVersion(),
    buildInfo: version.getBuildInfo(),
    changelog: version.getChangelog(),
    allVersions: version.getAllVersions(),
    formatDate: version.formatBuildDate(),
    color: version.getVersionColor(),
  };
}

// Export per uso diretto
export const version = Version.getInstance();