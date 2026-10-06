import { NextRequest, NextResponse } from 'next/server';
import { getSignedDownloadUrl } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body as { key: string };

    if (!key) {
      return NextResponse.json({ error: 'key is required.' }, { status: 400 });
    }

    const url = await getSignedDownloadUrl(key);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate download URL.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
