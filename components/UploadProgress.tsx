'use client';

import { CheckCircle2, XCircle, Loader2, X, RotateCcw, Image as ImageIcon, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EMPTY_UPLOAD_ITEMS, UploadItem, uploadManager } from '@/lib/upload';
import { useSyncExternalStore } from 'react';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function UploadRow({ item }: { item: UploadItem }) {
  const isVideo = item.category === 'video';

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {isVideo ? (
          <Film className="h-5 w-5 text-blue-500" />
        ) : (
          <ImageIcon className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{formatSize(item.size)}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item.status === 'failed'
                  ? 'bg-destructive'
                  : item.status === 'completed'
                  ? 'bg-emerald-500'
                  : item.status === 'cancelled'
                  ? 'bg-muted-foreground'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {item.status === 'completed' ? 'Done' : item.status === 'failed' ? 'Error' : item.status === 'cancelled' ? 'Stopped' : `${item.progress}%`}
          </span>
        </div>

        {item.error && (
          <p className="mt-1 truncate text-xs text-destructive">{item.error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.status === 'uploading' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => uploadManager.cancel(item.id)}
            title="Cancel upload"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {item.status === 'completed' && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
        {item.status === 'failed' && (
          <>
            <XCircle className="h-5 w-5 text-destructive" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => uploadManager.retry(item.id)}
              title="Retry upload"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        )}
        {item.status === 'uploading' && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {item.status === 'cancelled' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => uploadManager.retry(item.id)}
            title="Retry upload"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function UploadProgress() {
  const items = useSyncExternalStore(
    (cb) => uploadManager.subscribe(cb),
    () => uploadManager.getItems(),
    () => EMPTY_UPLOAD_ITEMS
  );

  if (items.length === 0) return null;

  const active = items.filter((i) => i.status === 'uploading' || i.status === 'pending');
  const completed = items.filter((i) => i.status === 'completed');
  const failed = items.filter((i) => i.status === 'failed');
  const cancelled = items.filter((i) => i.status === 'cancelled');
  const totalSize = active.reduce((s, i) => s + i.size, 0);
  const uploadedSize = active.reduce((s, i) => s + (i.size * i.progress) / 100, 0);
  const overallProgress = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-foreground">
              Uploading {active.length} file{active.length > 1 ? 's' : ''}...
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">{overallProgress}%</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <UploadRow key={item.id} item={item} />
        ))}
      </div>

      {(completed.length > 0 || failed.length > 0 || cancelled.length > 0) && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {completed.length > 0 && <span className="text-emerald-600">{completed.length} completed</span>}
            {completed.length > 0 && (failed.length > 0 || cancelled.length > 0) && ' · '}
            {failed.length > 0 && <span className="text-destructive">{failed.length} failed</span>}
            {failed.length > 0 && cancelled.length > 0 && ' · '}
            {cancelled.length > 0 && <span>{cancelled.length} cancelled</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={() => uploadManager.clearCompleted()}>
            Clear list
          </Button>
        </div>
      )}
    </div>
  );
}
