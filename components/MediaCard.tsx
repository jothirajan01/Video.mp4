'use client';

import { useState } from 'react';
import { Image as ImageIcon, Film, Download, Trash2, Play } from 'lucide-react';
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

type MediaCardProps = {
  file: MediaFile;
  onClick: () => void;
  onDeleted: (key: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MediaCard({ file, onClick, onDeleted }: MediaCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isVideo = file.category === 'video';

  const loadThumb = async () => {
    if (thumbUrl) return;
    try {
      const resp = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setThumbUrl(data.url);
      }
    } catch {
      // ignore
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const a = document.createElement('a');
        a.href = data.url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      // ignore
    }
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
      <div
        className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
        onClick={onClick}
        onMouseEnter={loadThumb}
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {thumbUrl ? (
            isVideo ? (
              <video
                src={thumbUrl}
                className="h-full w-full object-cover"
                muted
                preload="metadata"
                onLoadedMetadata={(e) => {
                  e.currentTarget.currentTime = 0.1;
                }}
              />
            ) : (
              <img src={thumbUrl} alt={file.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {isVideo ? <Film className="h-10 w-10 text-muted-foreground/40" /> : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
            </div>
          )}

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="h-5 w-5 fill-black text-black ml-0.5" />
              </div>
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-white"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-destructive hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowDelete(true);
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatSize(file.size)}</span>
            <span>{formatDate(file.lastModified)}</span>
          </div>
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
