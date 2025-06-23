declare module '@bitdisaster/exe-icon-extractor' {
  export const exeIcons: {
    getIcon: (executablePath: string, size: 'large' | 'small') => Buffer;
  };
}
