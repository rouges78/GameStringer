// Dichiarazioni TypeScript per Tauri

declare global {
  interface Window {
    __TAURI__?: {
      tauri: {
        invoke: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
      };
      event: {
        listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
        emit: (event: string, payload?: unknown) => Promise<void>;
      };
      notification: {
        sendNotification: (options: {
          title: string;
          body?: string;
          icon?: string;
        }) => Promise<void>;
        isPermissionGranted: () => Promise<boolean>;
        requestPermission: () => Promise<string>;
      };
      os: {
        platform: () => Promise<string>;
        version: () => Promise<string>;
        type: () => Promise<string>;
      };
      path: {
        appDir: () => Promise<string>;
        appDataDir: () => Promise<string>;
        appLocalDataDir: () => Promise<string>;
        appConfigDir: () => Promise<string>;
        appLogDir: () => Promise<string>;
        appCacheDir: () => Promise<string>;
      };
      fs: {
        readTextFile: (path: string) => Promise<string>;
        writeTextFile: (path: string, contents: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        createDir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
      };
    };
  }
}

export {};