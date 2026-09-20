import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos';

function admin() {
  if (!URL || !SERVICE_KEY) throw new Error('Supabase server credentials are missing.');
  return createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = admin();
    const { data: wedding, error } = await supabase
      .from('weddings')
      .select('id,slug,couple_name,wedding_date,client_enabled,client_all_photos,client_downloads,client_favourites')
      .eq('slug', slug)
      .eq('client_enabled', true)
      .single();

    if (error || !wedding) return NextResponse.json({ error: 'Wedding gallery not found.' }, { status: 404 });
    if (!wedding.client_all_photos) return NextResponse.json({ error: 'Browsing all photos is disabled.' }, { status: 403 });

    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id,original_name,bytes,mime_type,status,created_at,storage_path')
      .eq('wedding_id', wedding.id)
      .order('created_at', { ascending: false });

    if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });

    const paths = (photos || []).map(p => p.storage_path).filter(Boolean);
    const { data: signed } = paths.length
      ? await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
      : { data: [] as any[] };

    const rows = (photos || []).map((photo, i) => ({
      id: photo.id,
      name: photo.original_name,
      bytes: photo.bytes,
      mimeType: photo.mime_type,
      createdAt: photo.created_at,
      url: signed?.[i]?.signedUrl || null,
    }));

    return NextResponse.json({ wedding: { slug: wedding.slug, couple_name: wedding.couple_name, wedding_date: wedding.wedding_date, client_downloads: wedding.client_downloads, client_favourites: wedding.client_favourites }, photos: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load gallery.' }, { status: 500 });
  }
}
