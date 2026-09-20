import { NextResponse } from 'next/server';
import { getRequestSupabase, requireUser } from '@/lib/auth';
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos'; const MAX_FILES_PER_REQUEST = 100; const MAX_FILE_BYTES = 50 * 1024 * 1024;
function safeName(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
export async function POST(req: Request) {
  try {
    const user = await requireUser(req); const body = await req.json(); const weddingId = String(body?.weddingId || ''); const files = Array.isArray(body?.files) ? body.files : [];
    if (!weddingId || !files.length) return NextResponse.json({ error: 'weddingId and files are required' }, { status: 400 });
    if (files.length > MAX_FILES_PER_REQUEST) return NextResponse.json({ error: `Upload at most ${MAX_FILES_PER_REQUEST} files per batch.` }, { status: 400 });
    const { client: supabase } = getRequestSupabase(req);
    const { data: wedding, error: weddingError } = await supabase.from('weddings').select('id,studio_id,status,studios!inner(owner_id)').eq('id', weddingId).single();
    if (weddingError || !wedding || (wedding as any).studios?.owner_id !== user.id) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });
    const results = [];
    for (const file of files) {
      const name = safeName(String(file.name || 'photo.jpg')) || 'photo.jpg'; const size = Number(file.size || 0); const type = String(file.type || 'image/jpeg');
      if (!type.startsWith('image/')) return NextResponse.json({ error: `${name} is not an image.` }, { status: 400 });
      if (size > MAX_FILE_BYTES) return NextResponse.json({ error: `${name} is larger than 50 MB.` }, { status: 400 });
      const photoId = crypto.randomUUID(); const storagePath = `${weddingId}/${photoId}-${name}`;
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signedError || !signed) return NextResponse.json({ error: signedError?.message || 'Could not create upload URL.' }, { status: 500 });
      const { error: photoError } = await supabase.from('photos').insert({ id: photoId, wedding_id: weddingId, storage_path: storagePath, original_name: name, bytes: size, mime_type: type, status: 'uploading' });
      if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });
      results.push({ photoId, storagePath, path: signed.path, token: signed.token, name, size, type });
    }
    await supabase.from('weddings').update({ status: 'uploading' }).eq('id', weddingId);
    return NextResponse.json({ ok: true, bucket: BUCKET, uploads: results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload preparation failed.' }, { status: 500 }); }
}