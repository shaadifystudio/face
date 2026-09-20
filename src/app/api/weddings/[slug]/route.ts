import { NextResponse } from 'next/server';
import { getRequestSupabase, requireUser } from '@/lib/auth';

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos';

async function getOwnedWedding(req: Request, slug: string) {
  const user = await requireUser(req);
  const { client: supabase } = getRequestSupabase(req);
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('id,slug,couple_name,wedding_date,status,photo_count,face_count,created_at,studios!inner(owner_id)')
    .eq('slug', slug)
    .single();
  if (error || !wedding || (wedding as any).studios?.owner_id !== user.id) return { user, supabase, wedding: null };
  return { user, supabase, wedding };
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { supabase, wedding } = await getOwnedWedding(req, slug);
    if (!wedding) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });

    const { data: photos } = await supabase
      .from('photos')
      .select('id,original_name,bytes,mime_type,status,created_at,storage_path')
      .eq('wedding_id', wedding.id)
      .order('created_at', { ascending: false })
      .limit(60);

    const { data: signed } = photos?.length
      ? await supabase.storage.from(BUCKET).createSignedUrls(photos.map(p => p.storage_path), 60 * 60)
      : { data: [] as any[] };

    const photoRows = (photos || []).map((photo, index) => ({
      ...photo,
      url: signed?.[index]?.signedUrl || null,
    }));

    return NextResponse.json({ wedding, photos: photoRows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load wedding.' }, { status: 401 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { supabase, wedding } = await getOwnedWedding(req, slug);
    if (!wedding) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });

    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id,storage_path')
      .eq('wedding_id', wedding.id);

    if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });

    const paths = (photos || []).map(p => p.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from('weddings').delete().eq('id', wedding.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not delete wedding.' }, { status: 500 });
  }
}
