'use client';

import { useState, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DragDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxSize?: number; // in MB
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DragDropZone({
  onFilesDropped,
  accept = ['.txt', '.json', '.csv', '.po', '.xml'],
  multiple = true,
  maxSize = 50,
  children,
  className,
  disabled = false,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    const maxBytes = maxSize * 1024 * 1024;

    for (const file of files) {
      // Check extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (accept.length > 0 && !accept.includes(ext)) {
        setError(`Formato non supportato: ${ext}`);
        continue;
      }

      // Check size
      if (file.size > maxBytes) {
        setError(`File troppo grande: ${file.name} (max ${maxSize}MB)`);
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  }, [accept, maxSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
      setError(null);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const filesToProcess = multiple ? droppedFiles : [droppedFiles[0]];
    const validFiles = validateFiles(filesToProcess);

    if (validFiles.length > 0) {
      onFilesDropped(validFiles);
      setError(null);
    }
  }, [disabled, multiple, validateFiles, onFilesDropped]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = validateFiles(fileArray);

    if (validFiles.length > 0) {
      onFilesDropped(validFiles);
      setError(null);
    }

    // Reset input
    e.target.value = '';
  }, [validateFiles, onFilesDropped]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200",
        isDragging 
          ? "border-primary bg-primary/5 scale-[1.02]" 
          : "border-border/50 hover:border-border",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children || (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className={cn(
            "mb-3 p-3 rounded-full transition-colors",
            isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Upload className="h-6 w-6" />
          </div>
          
          <p className="text-sm font-medium mb-1">
            {isDragging ? "Drop files here" : "Drag files here"}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            or click to select
          </p>
          
          <label className="cursor-pointer">
            <input
              type="file"
              multiple={multiple}
              accept={accept.join(',')}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
            <Button variant="outline" size="sm" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
          
          <p className="text-[10px] text-muted-foreground mt-3">
            Formats: {accept.join(', ')} • Max {maxSize}MB
          </p>
        </div>
      )}

      {error && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
          <X className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Overlay when dragging */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm rounded-xl">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8 animate-bounce" />
            <span className="font-medium">Drop to upload</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact inline version
export function DragDropInline({
  onFilesDropped,
  accept = ['.txt', '.json'],
  className,
}: {
  onFilesDropped: (files: File[]) => void;
  accept?: string[];
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        onFilesDropped(files);
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed transition-all",
        isDragging ? "border-primary bg-primary/5" : "border-border/50",
        className
      )}
    >
      <FileText className={cn("h-4 w-4", isDragging ? "text-primary" : "text-muted-foreground")} />
      <span className="text-xs text-muted-foreground">
        {isDragging ? "Rilascia qui" : "Trascina file o"}
      </span>
      <label className="cursor-pointer">
        <input
          type="file"
          accept={accept.join(',')}
          onChange={(e) => {
            if (e.target.files) {
              onFilesDropped(Array.from(e.target.files));
              e.target.value = '';
            }
          }}
          className="hidden"
        />
        <span className="text-xs text-primary hover:underline">browse</span>
      </label>
    </div>
  );
}

export default DragDropZone;
