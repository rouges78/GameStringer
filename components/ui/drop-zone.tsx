'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface FileWithPreview extends File {
  preview?: string;
  status?: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

export interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  maxSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  showPreview?: boolean;
}

const DEFAULT_ACCEPT = ['.json', '.csv', '.xliff', '.tmx', '.po', '.resx', '.txt'];
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function DropZone({
  onFilesSelected,
  accept = DEFAULT_ACCEPT,
  maxFiles = 10,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = true,
  disabled = false,
  className,
  children,
  showPreview = true,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (accept.length > 0 && !accept.includes(ext) && !accept.includes('*')) {
      return `Tipo file non supportato: ${ext}`;
    }

    // Check file size
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024);
      return `File troppo grande (max ${maxMB}MB)`;
    }

    return null;
  }, [accept, maxSize]);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FileWithPreview[] = [];
    const newErrors: string[] = [];

    const filesArray = Array.from(fileList);
    
    // Check max files
    if (files.length + filesArray.length > maxFiles) {
      newErrors.push(`Massimo ${maxFiles} file consentiti`);
      return;
    }

    for (const file of filesArray) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        const fileWithPreview: FileWithPreview = Object.assign(file, {
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          status: 'pending' as const,
          progress: 0,
        });
        newFiles.push(fileWithPreview);
      }
    }

    if (newFiles.length > 0) {
      const updatedFiles = multiple ? [...files, ...newFiles] : newFiles;
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }

    setErrors(newErrors);
  }, [files, maxFiles, multiple, validateFile, onFilesSelected]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  }, [disabled, processFiles]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    // Reset input
    e.target.value = '';
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      onFilesSelected(newFiles);
      return newFiles;
    });
  }, [onFilesSelected]);

  const clearAll = useCallback(() => {
    setFiles([]);
    setErrors([]);
    onFilesSelected([]);
  }, [onFilesSelected]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: FileWithPreview) => {
    switch (file.status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-all cursor-pointer',
          isDragging && 'border-primary bg-primary/5 scale-[1.02]',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
        />

        {children || (
          <>
            <Upload className={cn(
              'h-10 w-10 mb-4 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )} />
            <p className="text-sm font-medium">
              {isDragging ? 'Rilascia i file qui' : 'Trascina i file o clicca per selezionare'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {accept.join(', ')} • Max {formatFileSize(maxSize)}
            </p>
          </>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, i) => (
            <p key={i} className="text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          ))}
        </div>
      )}

      {/* File List */}
      {showPreview && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{files.length} file selezionati</p>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Rimuovi tutti
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                {getFileIcon(file)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {file.error && <span className="text-red-500 ml-2">{file.error}</span>}
                  </p>
                  
                  {file.status === 'uploading' && file.progress !== undefined && (
                    <Progress value={file.progress} className="h-1 mt-1" />
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DropZone;
