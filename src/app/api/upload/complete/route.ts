import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos';
export async function POST(req: Request) {
  try {
    const user = await requireUser(req); const body = await req.json(); const weddingId = String(body?.weddingId || ''); const photoIds = Array.isArray(body?.photoIds) ? body.photoIds.map(String) : [];
    if (!weddingId || !photoIds.length) return NextResponse.json({ error: 'weddingId and photoIds are required' }, { status: 400 });
    const supabase = createSupabaseAdmin();
    const { data: photos, error } = await supabase.from('photos').select('id,storage_path,weddings!inner(studios!inner(owner_id))').eq('wedding_id', weddingId).in('id', photoIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ownerId = (photos?.[0] as any)?.weddings?.studios?.owner_id;
    if (ownerId !== user.id) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });
    if (!photos?.length) return NextResponse.json({ error: 'No matching photos found.' }, { status: 404 });
    const verified: string[] = [];
    for (const photo of photos) { const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storage_path, 60 * 60); if (signedError || !signed?.signedUrl) continue; verified.push(photo.id); }
    await supabase.from('photos').update({ status: 'queued' }).eq('wedding_id', weddingId).in('id', verified);
    const { count } = await supabase.from('photos').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId);
    await supabase.from('weddings').update({ status: 'processing', photo_count: count || 0 }).eq('id', weddingId);
    const workerUrl = process.env.AI_WORKER_URL; const workerSecret = process.env.AI_WORKER_SECRET;
    if (workerUrl && workerSecret && verified.length) await fetch(`${workerUrl.replace(/\/$/, '')}/enqueue`, { method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${workerSecret}`}, body:JSON.stringify({wedding_id:weddingId,photo_ids:verified}) }).catch(()=>undefined);
    return NextResponse.json({ ok: true, queued: verified.length, bucket: BUCKET });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not finalize upload.' }, { status: 500 }); }
}