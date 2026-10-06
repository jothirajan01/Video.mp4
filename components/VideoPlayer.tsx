'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Download,
  Trash2,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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

type VideoPlayerProps = {
  file: MediaFile;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  onDeleted: (key: string) => void;
};

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoPlayer({ file, onClose, onNext, onPrev, hasNext, hasPrev, onDeleted }: VideoPlayerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      if (e.key === ' ' && videoRef.current) {
        e.preventDefault();
        if (playing) videoRef.current.pause();
        else videoRef.current.play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNext, onPrev, hasNext, hasPrev, playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      v.play();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleSeek = (value: number[]) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = (value[0] / 100) * v.duration;
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      v.requestFullscreen();
    }
  };

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
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}>
        <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            {hasPrev && (
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onPrev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onNext}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            <p className="truncate text-sm font-medium text-white/90">{file.name}</p>
          </div>
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

        <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="flex flex-col items-center text-white/60">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm">Loading video...</p>
            </div>
          ) : url ? (
            <video
              ref={videoRef}
              src={url}
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              autoPlay
            />
          ) : (
            <p className="text-white/60">Failed to load video.</p>
          )}
        </div>

        {url && (
          <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-white/70">
                  {formatTime((progress / 100) * duration)}
                </span>
                <Slider
                  value={[progress]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums text-white/70">{formatTime(duration)}</span>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={togglePlay}>
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={toggleMute}>
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleFullscreen}>
                  <Maximize className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
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
