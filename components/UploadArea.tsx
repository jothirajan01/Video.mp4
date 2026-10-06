'use client';

import { useCallback, useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateFileClient, MediaCategory } from '@/lib/validation';

type UploadAreaProps = {
  onFilesSelected: (files: { file: File; category: MediaCategory }[], errors: string[]) => void;
  maxImageSize: number;
  maxVideoSize: number;
};

export function UploadArea({ onFilesSelected, maxImageSize, maxVideoSize }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const valid: { file: File; category: MediaCategory }[] = [];
      const errors: string[] = [];

      Array.from(fileList).forEach((file) => {
        const result = validateFileClient(file, maxImageSize, maxVideoSize);
        if (result.valid && result.category) {
          valid.push({ file, category: result.category });
        } else {
          errors.push(`${file.name}: ${result.error}`);
        }
      });

      onFilesSelected(valid, errors);
    },
    [maxImageSize, maxVideoSize, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'group relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300',
        isDragging
          ? 'border-blue-400 bg-blue-500/5 scale-[1.01]'
          : 'border-border hover:border-blue-400/50 hover:bg-muted/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.avi,.mkv,.webm"
        className="hidden"
        onChange={(e) => {
          processFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full transition-all duration-300',
            isDragging
              ? 'bg-blue-500/10 scale-110'
              : 'bg-muted group-hover:bg-blue-500/10'
          )}
        >
          <UploadCloud
            className={cn(
              'h-8 w-8 sm:h-10 sm:w-10 transition-colors',
              isDragging ? 'text-blue-500' : 'text-muted-foreground group-hover:text-blue-500'
            )}
          />
        </div>

        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            {isDragging ? 'Drop your files here' : 'Drag & drop your files here'}
          </p>
          <p className="text-sm text-muted-foreground">or</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all group-hover:shadow-md">
          Choose Photos / Videos
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            JPG PNG WEBP GIF HEIC
          </span>
          <span className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            MP4 MOV AVI MKV WEBM
          </span>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Only image and video files are supported
        </p>
      </div>
    </div>
  );
}
