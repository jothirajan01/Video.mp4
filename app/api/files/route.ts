import { NextRequest, NextResponse } from 'next/server';
import { listMediaFiles } from '@/lib/s3';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter');

    let prefix: string | undefined;
    if (filter === 'photos') prefix = 'photos/';
    else if (filter === 'videos') prefix = 'videos/';

    const files = await listMediaFiles(prefix);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list files.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
