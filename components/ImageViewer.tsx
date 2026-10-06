'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MediaFile } from '@/lib/s3';

type ImageViewerProps = {
  file: MediaFile;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  onDeleted: (key: string) => void;
};

export function ImageViewer({ file, onClose, onNext, onPrev, hasNext, hasPrev, onDeleted }: ImageViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setUrl(null);
    try {
      const resp = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setUrl(data.url);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [file.key]);

  useEffect(() => {
    loadUrl();
  }, [loadUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  const handleDownload = async () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const resp = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key }),
      });
      if (resp.ok) {
        onDeleted(file.key);
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
        <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
          <p className="truncate text-sm font-medium text-white/90">{file.name}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleDownload} disabled={!url}>
              <Download className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {hasPrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={onPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {loading ? (
            <div className="flex flex-col items-center text-white/60">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm">Loading image...</p>
            </div>
          ) : url ? (
            <img
              src={url}
              alt={file.name}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-white/60">Failed to load image.</p>
          )}

          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-10 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{file.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
