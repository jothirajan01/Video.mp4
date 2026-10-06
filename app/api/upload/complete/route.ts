import { NextRequest, NextResponse } from 'next/server';
import { completeMultipartUpload, abortMultipartUpload } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, uploadId, parts, abort } = body as {
      key: string;
      uploadId: string;
      parts?: { PartNumber: number; ETag?: string }[];
      abort?: boolean;
    };

    if (!key || !uploadId) {
      return NextResponse.json({ error: 'key and uploadId are required.' }, { status: 400 });
    }

    if (abort) {
      await abortMultipartUpload(key, uploadId);
      return NextResponse.json({ ok: true });
    }

    if (!parts) {
      return NextResponse.json({ error: 'parts are required.' }, { status: 400 });
    }

    await completeMultipartUpload(key, uploadId, parts);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Complete upload failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
