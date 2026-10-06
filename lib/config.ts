function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

const MB = 1024 * 1024;

export const config = {
  awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  s3Bucket: process.env.AWS_S3_BUCKET ?? '',

  maxImageSize: numEnv('MAX_IMAGE_SIZE_MB', 100) * MB,
  maxVideoSize: numEnv('MAX_VIDEO_SIZE_MB', 4096) * MB,

  signedUrlExpiration: numEnv('SIGNED_URL_EXPIRATION_SECONDS', 300),
  multipartThreshold: numEnv('MULTIPART_UPLOAD_THRESHOLD_MB', 100) * MB,
  multipartPartSize: numEnv('MULTIPART_PART_SIZE_MB', 10) * MB,

  get hasAwsConfig() {
    return !!this.awsRegion && !!this.s3Bucket;
  },

  get hasExplicitCredentials() {
    return !!this.awsAccessKeyId && !!this.awsSecretAccessKey;
  },

  get hasPartialCredentials() {
    return (!!this.awsAccessKeyId && !this.awsSecretAccessKey) || (!this.awsAccessKeyId && !!this.awsSecretAccessKey);
  },
};
