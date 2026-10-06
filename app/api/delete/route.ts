import { NextRequest, NextResponse } from 'next/server';
import { deleteMediaFile } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body as { key: string };

    if (!key) {
      return NextResponse.json({ error: 'key is required.' }, { status: 400 });
    }

    await deleteMediaFile(key);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete file.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
