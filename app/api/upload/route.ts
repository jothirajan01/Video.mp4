import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUpload, createMultipartUpload } from '@/lib/s3';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, contentType, size, multipart } = body as {
      filename: string;
      contentType?: string;
      size: number;
      multipart?: boolean;
    };

    if (!filename || typeof size !== 'number' || size <= 0) {
      return NextResponse.json({ error: 'filename and size are required.' }, { status: 400 });
    }

    if (multipart || size > config.multipartThreshold) {
      const session = await createMultipartUpload(filename, contentType, size);
      return NextResponse.json({ mode: 'multipart', ...session });
    }

    const params = await createPresignedUpload(filename, contentType, size);
    return NextResponse.json({ mode: 'simple', ...params });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload request failed.';
    const isValidation = message.includes('not allowed') || message.includes('not supported') || message.includes('too large') || message.includes('empty');
    return NextResponse.json({ error: message }, { status: isValidation ? 422 : 500 });
  }
}
