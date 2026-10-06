'use client';

import { useState, useCallback, useEffect } from 'react';
import { Cloud, Shield, FolderOpen } from 'lucide-react';
import { UploadArea } from '@/components/UploadArea';
import { UploadProgress } from '@/components/UploadProgress';
import { MediaGallery } from '@/components/MediaGallery';
import { EMPTY_UPLOAD_ITEMS, uploadManager } from '@/lib/upload';
import { useSyncExternalStore } from 'react';
import { MediaFile } from '@/lib/s3';
import { MediaCategory } from '@/lib/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_SIZE = 4096 * 1024 * 1024;

export default function Home() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const uploadItems = useSyncExternalStore(
    (cb) => uploadManager.subscribe(cb),
    () => uploadManager.getItems(),
    () => EMPTY_UPLOAD_ITEMS
  );

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/files');
      if (resp.ok) {
        const data = await resp.json();
        setFiles(data.files);
      } else {
        const err = await resp.json();
        setError(err.error || 'Failed to load files.');
      }
    } catch {
      setError('Could not connect to the server. Make sure AWS credentials are configured.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFilesSelected = useCallback(
    (valid: { file: File; category: MediaCategory }[], errors: string[]) => {
      if (errors.length > 0) {
        setValidationErrors(errors);
      } else {
        setValidationErrors([]);
      }

      const ids = valid.map(({ file, category }) => uploadManager.addFile(file, category));
      ids.forEach((id) => {
        uploadManager.startUpload(id).catch((err) => {
          console.error('Upload failed:', err);
        });
      });
    },
    []
  );

  const handleDeleted = useCallback((key: string) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const completedUploads = uploadItems.filter((i) => i.status === 'completed');

  useEffect(() => {
    if (completedUploads.length > 0) {
      const timer = setTimeout(() => fetchFiles(), 500);
      return () => clearTimeout(timer);
    }
  }, [completedUploads.length, fetchFiles]);

  const photoCount = files.filter((f) => f.category === 'image').length;
  const videoCount = files.filter((f) => f.category === 'video').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">My Media Vault</h1>
              <p className="text-xs text-muted-foreground">Personal photo & video storage</p>
            </div>
          </div>

          <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-emerald-500" />
              Private S3
            </span>
            <span>{photoCount} photos</span>
            <span>{videoCount} videos</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Upload your photos and videos
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Drag and drop or browse to upload. Files are stored securely in your private Amazon S3 bucket.
          </p>
        </div>

        <UploadArea
          onFilesSelected={handleFilesSelected}
          maxImageSize={MAX_IMAGE_SIZE}
          maxVideoSize={MAX_VIDEO_SIZE}
        />

        {validationErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {validationErrors.map((err, i) => (
              <Alert key={i} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="mt-6">
          <UploadProgress />
        </div>

        <div className="mt-10">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <MediaGallery
            files={files}
            loading={loading}
            onRefresh={fetchFiles}
            onDeleted={handleDeleted}
          />
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Powered by Amazon S3 · No database · Private storage
          </p>
        </div>
      </footer>
    </div>
  );
}
