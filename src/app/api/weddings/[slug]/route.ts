import { NextResponse } from 'next/server';
import { getRequestSupabase, requireUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(req);
    const { slug } = await params;
    const { client: supabase } = getRequestSupabase(req);

    const { data: wedding, error } = await supabase
      .from('weddings')
      .select('id,slug,couple_name,wedding_date,status,photo_count,face_count,created_at,studios!inner(owner_id)')
      .eq('slug', slug)
      .single();

    if (error || !wedding || (wedding as any).studios?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });
    }

    const { data: photos } = await supabase
      .from('photos')
      .select('id,original_name,bytes,mime_type,status,created_at,storage_path')
      .eq('wedding_id', wedding.id)
      .order('created_at', { ascending: false })
      .limit(60);

    const { data: signed } = photos?.length
      ? await supabase.storage.from(process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos')
          .createSignedUrls(photos.map(p => p.storage_path), 60 * 60)
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