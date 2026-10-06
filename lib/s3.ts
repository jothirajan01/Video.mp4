import { S3Client } from '@aws-sdk/client-s3';
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config';
import { isSafeS3Key, generateObjectKey, validateFileServer, MediaCategory } from './validation';

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_client) {
    if (!config.hasAwsConfig) {
      throw new Error('AWS is not configured. Please set AWS_REGION and AWS_S3_BUCKET.');
    }
    if (config.hasPartialCredentials) {
      throw new Error('AWS credentials are incomplete. Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or use an attached IAM role.');
    }

    _client = new S3Client({
      region: config.awsRegion,
      ...(config.hasExplicitCredentials
        ? {
            credentials: {
              accessKeyId: config.awsAccessKeyId,
              secretAccessKey: config.awsSecretAccessKey,
            },
          }
        : {}),
    });
  }
  return _client;
}

export type MediaFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  category: MediaCategory;
  contentType?: string;
};

function deriveCategory(key: string): MediaCategory {
  if (key.startsWith('photos/')) return 'image';
  if (key.startsWith('videos/')) return 'video';
  const parts = key.split('.');
  const ext = parts[parts.length - 1]?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
  if (imageExts.includes(ext)) return 'image';
  return 'video';
}

function deriveName(key: string): string {
  const parts = key.split('/');
  const last = parts[parts.length - 1] ?? key;
  const dotIdx = last.lastIndexOf('.');
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

export async function listMediaFiles(prefix?: string): Promise<MediaFile[]> {
  const client = getS3Client();
  const files: MediaFile[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      ContinuationToken: continuationToken,
      Prefix: prefix,
    });
    const response = await client.send(command);
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key || obj.Key.endsWith('/')) continue;
        files.push({
          key: obj.Key,
          name: deriveName(obj.Key),
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? new Date().toISOString(),
          category: deriveCategory(obj.Key),
        });
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  if (!isSafeS3Key(key)) throw new Error('Invalid object key.');
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: config.s3Bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: config.signedUrlExpiration });
}

export type PresignedUploadParams = {
  key: string;
  url: string;
  category: MediaCategory;
};

export async function createPresignedUpload(
  filename: string,
  contentType: string | undefined,
  size: number
): Promise<PresignedUploadParams> {
  const result = validateFileServer(filename, contentType, size, config.maxImageSize, config.maxVideoSize);
  if (!result.valid || !result.category) {
    throw new Error(result.error ?? 'File validation failed.');
  }

  const key = generateObjectKey(result.category, filename);

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType || (result.category === 'image' ? 'image/jpeg' : 'video/mp4'),
    Metadata: {
      'original-filename': encodeURIComponent(filename),
    },
  });

  const url = await getSignedUrl(client, command, { expiresIn: config.signedUrlExpiration });
  return { key, url, category: result.category };
}

export type MultipartUploadSession = {
  uploadId: string;
  key: string;
  partSize: number;
  parts: { number: number; url: string }[];
};

export async function createMultipartUpload(
  filename: string,
  contentType: string | undefined,
  size: number
): Promise<MultipartUploadSession> {
  const result = validateFileServer(filename, contentType, size, config.maxImageSize, config.maxVideoSize);
  if (!result.valid || !result.category) {
    throw new Error(result.error ?? 'File validation failed.');
  }

  const key = generateObjectKey(result.category, filename);
  const client = getS3Client();

  const createCmd = new CreateMultipartUploadCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType || (result.category === 'image' ? 'image/jpeg' : 'video/mp4'),
    Metadata: {
      'original-filename': encodeURIComponent(filename),
    },
  });
  const createResp = await client.send(createCmd);
  const uploadId = createResp.UploadId;
  if (!uploadId) throw new Error('Failed to create multipart upload.');

  const partSize = config.multipartPartSize;
  const numParts = Math.ceil(size / partSize);
  const parts: { number: number; url: string }[] = [];

  for (let i = 0; i < numParts; i++) {
    const partNumber = i + 1;
    const cmd = new UploadPartCommand({
      Bucket: config.s3Bucket,
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId,
    });
    const url = await getSignedUrl(client, cmd, { expiresIn: 3600 });
    parts.push({ number: partNumber, url });
  }

  return { uploadId, key, partSize, parts };
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag?: string }[]
): Promise<void> {
  if (!isSafeS3Key(key)) throw new Error('Invalid object key.');
  const client = getS3Client();
  const filtered = parts.filter((p) => p.ETag);
  const cmd = new CompleteMultipartUploadCommand({
    Bucket: config.s3Bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: filtered.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
    },
  });
  await client.send(cmd);
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  if (!isSafeS3Key(key)) return;
  const client = getS3Client();
  const cmd = new AbortMultipartUploadCommand({
    Bucket: config.s3Bucket,
    Key: key,
    UploadId: uploadId,
  });
  await client.send(cmd);
}

export async function deleteMediaFile(key: string): Promise<void> {
  if (!isSafeS3Key(key)) throw new Error('Invalid or unauthorized object key.');
  const client = getS3Client();
  const cmd = new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key });
  await client.send(cmd);
}
