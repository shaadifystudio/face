import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.weddingSlug || !body?.selfieUrl) return NextResponse.json({ error: 'weddingSlug and selfieUrl are required' }, { status: 400 });
  const workerUrl = process.env.AI_WORKER_URL;
  const workerSecret = process.env.AI_WORKER_SECRET;
  if (!workerUrl || !workerSecret) return NextResponse.json({ error: 'Face search worker is not configured yet.' }, { status: 503 });
  try {
    const { createSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabase = createSupabaseAdmin();
    const { data: wedding, error } = await supabase.from('weddings').select('id,status').eq('slug', String(body.weddingSlug)).single();
    if (error || !wedding) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/search`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${workerSecret}` },
      body: JSON.stringify({ wedding_id: wedding.id, selfie_url: String(body.selfieUrl), threshold: Number(body.threshold || 90) }), cache: 'no-store',
    });
    const result = await response.json().catch(() => ({ error: 'Worker returned an invalid response.' }));
    return NextResponse.json(result, { status: response.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Face search failed.' }, { status: 500 }); }
}