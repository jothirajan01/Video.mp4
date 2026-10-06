'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, RefreshCw, Loader2, Image as ImageIcon, Film, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaCard } from './MediaCard';
import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';
import { MediaFile } from '@/lib/s3';

type MediaGalleryProps = {
  files: MediaFile[];
  loading: boolean;
  onRefresh: () => void;
  onDeleted: (key: string) => void;
};

export function MediaGallery({ files, loading, onRefresh, onDeleted }: MediaGalleryProps) {
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = files;
    if (filter === 'photos') result = result.filter((f) => f.category === 'image');
    if (filter === 'videos') result = result.filter((f) => f.category === 'video');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const da = new Date(a.lastModified).getTime();
      const db = new Date(b.lastModified).getTime();
      return sort === 'newest' ? db - da : da - db;
    });
    return result;
  }, [files, filter, search, sort]);

  const openFile = useCallback((index: number) => setViewerIndex(index), []);
  const closeViewer = useCallback(() => setViewerIndex(null), []);
  const nextFile = useCallback(() => {
    setViewerIndex((prev) => (prev !== null && prev < filtered.length - 1 ? prev + 1 : prev));
  }, [filtered.length]);
  const prevFile = useCallback(() => {
    setViewerIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const currentFile = viewerIndex !== null ? filtered[viewerIndex] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">My Media</h2>
          {files.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              All
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5">
              <Film className="h-3.5 w-3.5" />
              Videos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as 'newest' | 'oldest')}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Loading your media...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">
            {files.length === 0 ? 'No files yet. Upload your first photo or video above.' : 'No files match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((file, index) => (
            <MediaCard
              key={file.key}
              file={file}
              onClick={() => openFile(index)}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}

      {currentFile && currentFile.category === 'image' && (
        <ImageViewer
          file={currentFile}
          onClose={closeViewer}
          onNext={nextFile}
          onPrev={prevFile}
          hasNext={viewerIndex !== null && viewerIndex < filtered.length - 1}
          hasPrev={viewerIndex !== null && viewerIndex > 0}
          onDeleted={onDeleted}
        />
      )}

      {currentFile && currentFile.category === 'video' && (
        <VideoPlayer
          file={currentFile}
          onClose={closeViewer}
          onNext={nextFile}
          onPrev={prevFile}
          hasNext={viewerIndex !== null && viewerIndex < filtered.length - 1}
          hasPrev={viewerIndex !== null && viewerIndex > 0}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
