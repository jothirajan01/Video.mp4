# My Media Vault

A personal photo and video management application that uses **Amazon S3** as the only storage. No database, no login, no local file storage.

## Features

- Drag-and-drop or file picker upload for photos and videos
- Multiple file upload with individual and overall progress
- Cancel and retry failed uploads
- Multipart upload for large videos (configurable threshold)
- Strict file type validation (frontend + backend) — only images and videos allowed
- Media gallery with thumbnails, filtering (All / Photos / Videos), search, and sort
- Full-screen image viewer with navigation, download, and delete
- Video player with play/pause, seek, volume, and fullscreen
- Download via temporary presigned URLs
- Delete with confirmation dialog
- Private S3 bucket with presigned URLs — AWS credentials never exposed to the browser
- Path traversal protection on all S3 keys
- Responsive design for mobile and desktop

## Allowed File Types

### Images
JPG, JPEG, PNG, WEBP, GIF, HEIC, HEIF

### Videos
MP4, MOV, AVI, MKV, WEBM

All other file types (PDF, DOCX, ZIP, EXE, TXT, JS, HTML, SVG, etc.) are rejected.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes (server-side, holds AWS credentials)
- **Storage:** Amazon S3 (AWS SDK v3, presigned URLs, multipart upload)

## Prerequisites

1. An AWS account
2. An S3 bucket (private, no public access)
3. An IAM user with least-privilege permissions (see `aws/iam-policy.json`)

## Setup

### 1. Create an S3 Bucket

```bash
aws s3api create-bucket \
  --bucket my-private-media-bucket \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
```

Keep **Block all public access** enabled. The bucket should remain private.

### 2. Configure S3 CORS

Apply the CORS configuration from `aws/s3-cors.json` to your bucket so the browser can upload directly to S3 via presigned URLs:

```bash
aws s3api put-bucket-cors \
  --bucket my-private-media-bucket \
  --cors-configuration file://aws/s3-cors.json
```

Update the `AllowedOrigins` in `aws/s3-cors.json` to match your actual domain(s). Keep `http://localhost:3000` for local development.

### 3. Create an IAM User and Policy

Create an IAM user and attach the policy from `aws/iam-policy.json` (replace `my-private-media-bucket` with your bucket name). This grants only:

- `s3:ListBucket` on the bucket
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` on objects

Create an access key for this user and note the Access Key ID and Secret Access Key.

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
AWS_REGION=ap-south-1
AWS_S3_BUCKET=my-private-media-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
MAX_IMAGE_SIZE_MB=100
MAX_VIDEO_SIZE_MB=4096
SIGNED_URL_EXPIRATION_SECONDS=300
MULTIPART_UPLOAD_THRESHOLD_MB=100
MULTIPART_PART_SIZE_MB=10
```

### AWS Configuration Reference

| Setting | Required | Purpose |
|---|---:|---|
| `AWS_REGION` | Yes | S3 bucket region, such as `ap-south-1` |
| `AWS_S3_BUCKET` | Yes | Exact private S3 bucket name |
| `AWS_ACCESS_KEY_ID` | Local use | IAM access key for the server |
| `AWS_SECRET_ACCESS_KEY` | Local use | Matching IAM secret key |
| `MAX_IMAGE_SIZE_MB` | No | Maximum image size; default `100` |
| `MAX_VIDEO_SIZE_MB` | No | Maximum video size; default `4096` |
| `SIGNED_URL_EXPIRATION_SECONDS` | No | Temporary URL lifetime; default `300` |
| `MULTIPART_UPLOAD_THRESHOLD_MB` | No | Size at which multipart upload begins; default `100` |
| `MULTIPART_PART_SIZE_MB` | No | Multipart chunk size; default `10` |

For local development, provide both AWS access-key settings. For EC2, ECS, Lambda, or another AWS-hosted deployment, leave both key settings unset and attach an IAM role with the permissions in `aws/iam-policy.json`; the AWS SDK will use the role automatically. Never put these server settings in browser code or variables prefixed with `NEXT_PUBLIC_`.

The website connects to S3 through these server routes:

- `GET /api/files` lists objects from S3.
- `POST /api/upload` creates presigned upload URLs or a multipart upload session.
- `POST /api/upload/complete` completes or aborts multipart uploads.
- `POST /api/download` creates a temporary private download URL.
- `POST /api/delete` deletes a validated object from S3.

### 5. Run the Application

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## How It Works

### Upload Flow

```
Browser → POST /api/upload (filename, contentType, size)
            → Server validates file type and size
            → Server generates presigned URL (or multipart session for large files)
         Browser uploads directly to S3 via presigned URL
         Browser → POST /api/upload/complete (for multipart)
```

For files larger than `MULTIPART_UPLOAD_THRESHOLD_MB`, the server creates a multipart upload session and returns presigned URLs for each part. The browser uploads each part individually, then calls the complete endpoint.

### Download Flow

```
Browser → POST /api/download (key)
            → Server validates key (path traversal protection)
            → Server generates temporary presigned GET URL
         Browser uses the URL to download/view the file
```

### Delete Flow

```
Browser → POST /api/delete (key)
            → Server validates key is under photos/ or videos/ prefix
            → Server calls S3 DeleteObject
```

### File Organization

Files are stored in S3 with keys like:

```
photos/2026/10/uuid-photo1.jpg
videos/2026/10/uuid-video1.mp4
```

The original filename is preserved in S3 object metadata (`x-amz-meta-original-filename`).

## Security Notes

- **No authentication:** This app has no login. It is designed for **private/personal deployment**.
- AWS credentials exist only on the server (Next.js API routes). They are never sent to the browser.
- The S3 bucket is private — no public read access.
- All S3 object keys are server-generated UUIDs. The browser never controls the key directly.
- Delete requests are validated server-side — only keys under `photos/` or `videos/` prefixes can be deleted.
- Path traversal is blocked (`..`, leading `/`, backslashes, null bytes).

### Recommended Infrastructure Protection

Since there is no login, protect the deployed app with one of:

- **Cloudflare Access** — put the app behind Cloudflare and require email/IP-based access
- **VPN** — deploy on a private network accessible only via VPN
- **IP allowlisting** — restrict access at the reverse proxy / load balancer level
- **Basic Auth** — add HTTP basic authentication at the reverse proxy (nginx, Caddy)

## File Size Limits

| Type  | Default Max |
|-------|-------------|
| Image | 100 MB      |
| Video | 4 GB        |

These are configurable via `MAX_IMAGE_SIZE_MB` and `MAX_VIDEO_SIZE_MB`.

## Production Deployment

### Build

```bash
npm run build
npm start
```

### Deploy to a VPS / EC2

1. Build the app: `npm run build`
2. Run with a process manager (PM2, systemd): `npm start`
3. Put behind a reverse proxy (nginx, Caddy) with HTTPS
4. Set environment variables on the server
5. Update S3 CORS to include your production domain

### Environment Variables for Production

Make sure to set all environment variables on your hosting platform. Never commit `.env.local` to version control.

## License

Personal use only.
# Video.mp4
# Video.mp4
