export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';

export type UploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  category: 'image' | 'video';
  status: UploadStatus;
  progress: number;
  error?: string;
  key?: string;
};

type PartUploadResult = {
  PartNumber: number;
  ETag?: string;
};

type MultipartSession = {
  uploadId: string;
  key: string;
  partSize: number;
  parts: { number: number; url: string }[];
};

export class UploadManager {
  private items: Map<string, UploadItem> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private listeners: Set<() => void> = new Set();
  private multipartParts: Map<string, PartUploadResult[]> = new Map();
  private snapshot: UploadItem[] = [];

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.snapshot = Array.from(this.items.values());
    this.listeners.forEach((l) => l());
  }

  getItems(): UploadItem[] {
    return this.snapshot;
  }

  private update(id: string, patch: Partial<UploadItem>) {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, { ...item, ...patch });
      this.notify();
    }
  }

  addFile(file: File, category: 'image' | 'video'): string {
    const id = crypto.randomUUID();
    this.items.set(id, {
      id,
      file,
      name: file.name,
      size: file.size,
      category,
      status: 'pending',
      progress: 0,
    });
    this.notify();
    return id;
  }

  remove(id: string) {
    this.cancel(id);
    this.items.delete(id);
    this.multipartParts.delete(id);
    this.notify();
  }

  clearCompleted() {
    const toRemove: string[] = [];
    this.items.forEach((item, id) => {
      if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => {
      this.items.delete(id);
      this.multipartParts.delete(id);
    });
    this.notify();
  }

  cancel(id: string) {
    const ctrl = this.abortControllers.get(id);
    if (ctrl) {
      ctrl.abort();
      this.abortControllers.delete(id);
    }
    const item = this.items.get(id);
    if (item && (item.status === 'uploading' || item.status === 'pending')) {
      this.update(id, { status: 'cancelled', progress: 0 });
    }
  }

  retry(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    this.update(id, { status: 'pending', progress: 0, error: undefined });
    this.multipartParts.delete(id);
    this.startUpload(id).catch((err) => {
      this.update(id, { status: 'failed', error: err instanceof Error ? err.message : 'Retry failed.' });
    });
  }

  async startUpload(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item || item.status === 'uploading' || item.status === 'completed') return;

    const controller = new AbortController();
    this.abortControllers.set(id, controller);

    this.update(id, { status: 'uploading', progress: 0, error: undefined });

    try {
      const initResp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || undefined,
          size: item.file.size,
        }),
      });

      if (!initResp.ok) {
        const err = await initResp.json();
        throw new Error(err.error || 'Upload initialization failed.');
      }

      const initData = await initResp.json();

      if (initData.mode === 'multipart') {
        await this.uploadMultipart(id, initData as MultipartSession, controller.signal);
      } else {
        await this.uploadSimple(id, initData.url, initData.key, controller.signal);
      }

      this.update(id, { status: 'completed', progress: 100, key: initData.key });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        this.update(id, { status: 'cancelled' });
      } else {
        this.update(id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed.',
        });
      }
    } finally {
      this.abortControllers.delete(id);
    }
  }

  private async uploadSimple(id: string, url: string, key: string, signal: AbortSignal): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    const response = await fetch(url, {
      method: 'PUT',
      body: item.file,
      signal,
      headers: {
        'Content-Type': item.file.type || 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}.`);
    }

    this.update(id, { progress: 100, key });
  }

  private async uploadMultipart(id: string, session: MultipartSession, signal: AbortSignal): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    const { uploadId, key, partSize, parts } = session;
    const results: PartUploadResult[] = [];
    this.multipartParts.set(id, results);

    let uploadedBytes = 0;

    for (let i = 0; i < parts.length; i++) {
      if (signal.aborted) {
        await this.abortMultipart(key, uploadId);
        return;
      }

      const partInfo = parts[i];
      const start = i * partSize;
      const end = Math.min(start + partSize, item.file.size);
      const blob = item.file.slice(start, end);

      try {
        const partResp = await fetch(partInfo.url, {
          method: 'PUT',
          body: blob,
          signal,
        });

        if (!partResp.ok) {
          throw new Error(`Part ${partInfo.number} upload failed with status ${partResp.status}.`);
        }

        const etag = partResp.headers.get('ETag') || partResp.headers.get('etag');
        if (!etag) throw new Error(`Part ${partInfo.number} missing ETag.`);

        results.push({ PartNumber: partInfo.number, ETag: etag });
        uploadedBytes += (end - start);
        this.update(id, { progress: Math.round((uploadedBytes / item.file.size) * 100), key });
      } catch (err) {
        if (signal.aborted) {
          await this.abortMultipart(key, uploadId);
          return;
        }
        throw err;
      }
    }

    const completeResp = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ key, uploadId, parts: results }),
    });

    if (!completeResp.ok) {
      const err = await completeResp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to complete multipart upload.');
    }
  }

  private async abortMultipart(key: string, uploadId: string): Promise<void> {
    try {
      await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, uploadId, abort: true }),
      });
    } catch {
      // best-effort abort
    }
  }
}

export const EMPTY_UPLOAD_ITEMS: UploadItem[] = [];
export const uploadManager = new UploadManager();
