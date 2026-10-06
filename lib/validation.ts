export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]);

export const ALLOWED_IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
]);

export const ALLOWED_VIDEO_EXTS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
]);

export const REJECTED_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'exe',
  'apk', 'txt', 'js', 'html', 'css', 'svg', 'json', 'xml',
  'csv', 'ppt', 'pptx', 'mp3', 'wav', 'flac', 'iso', 'dmg',
  'tar', 'gz', '7z', 'bat', 'sh', 'py', 'rb', 'java', 'c',
  'cpp', 'go', 'rs', 'ts', 'tsx', 'jsx', 'md', 'yml', 'yaml',
]);

export type MediaCategory = 'image' | 'video';

export type ValidationResult = {
  valid: boolean;
  category?: MediaCategory;
  error?: string;
};

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function getCategoryFromMime(mime: string): MediaCategory | null {
  if (ALLOWED_IMAGE_TYPES.has(mime)) return 'image';
  if (ALLOWED_VIDEO_TYPES.has(mime)) return 'video';
  return null;
}

export function getCategoryFromExt(ext: string): MediaCategory | null {
  if (ALLOWED_IMAGE_EXTS.has(ext)) return 'image';
  if (ALLOWED_VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

export function validateFileClient(
  file: File,
  maxImageSize: number,
  maxVideoSize: number
): ValidationResult {
  const ext = getExtension(file.name);

  if (ext && REJECTED_EXTS.has(ext)) {
    return { valid: false, error: `"${ext.toUpperCase()}" files are not allowed. Only photos and videos are supported.` };
  }

  let category = getCategoryFromMime(file.type);
  if (!category) {
    category = getCategoryFromExt(ext);
  }

  if (!category) {
    return { valid: false, error: 'This file type is not supported. Only image and video files are allowed.' };
  }

  const max = category === 'image' ? maxImageSize : maxVideoSize;
  if (file.size > max) {
    const maxMB = Math.round(max / (1024 * 1024));
    return {
      valid: false,
      error: `This ${category} is too large. Maximum allowed ${category} size is ${maxMB >= 1024 ? `${(maxMB / 1024).toFixed(0)} GB` : `${maxMB} MB`}.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'This file is empty.' };
  }

  return { valid: true, category };
}

export function validateFileServer(
  filename: string,
  contentType: string | undefined,
  size: number,
  maxImageSize: number,
  maxVideoSize: number
): ValidationResult {
  const ext = getExtension(filename);

  if (ext && REJECTED_EXTS.has(ext)) {
    return { valid: false, error: 'File type is not allowed.' };
  }

  let category = contentType ? getCategoryFromMime(contentType) : null;
  if (!category) {
    category = getCategoryFromExt(ext);
  }

  if (!category) {
    return { valid: false, error: 'Unsupported file type.' };
  }

  const max = category === 'image' ? maxImageSize : maxVideoSize;
  if (size > max) {
    return { valid: false, error: 'File exceeds size limit.' };
  }

  if (size <= 0) {
    return { valid: false, error: 'File is empty.' };
  }

  return { valid: true, category };
}

export function generateObjectKey(category: MediaCategory, filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = getExtension(filename);
  const prefix = category === 'image' ? 'photos' : 'videos';
  const uuid = crypto.randomUUID();
  const base = ext ? `${uuid}.${ext}` : uuid;
  return `${prefix}/${year}/${month}/${base}`;
}

export function isSafeS3Key(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.includes('..')) return false;
  if (key.startsWith('/')) return false;
  if (key.includes('//')) return false;
  const parts = key.split('/');
  const validPrefixes = ['photos', 'videos'];
  if (parts.length < 2) return false;
  if (!validPrefixes.includes(parts[0])) return false;
  if (!parts.every((p) => p.length > 0 && !p.includes('\\') && !p.includes('\0'))) return false;
  return true;
}
