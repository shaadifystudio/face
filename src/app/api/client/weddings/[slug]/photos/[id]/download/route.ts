import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    if (!URL || !SERVICE_KEY) return NextResponse.json({ error: 'Gallery service is not configured.' }, { status: 500 });
    const supabase = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: wedding } = await supabase.from('weddings').select('id,client_enabled,client_downloads').eq('slug', slug).single();
    if (!wedding?.client_enabled) return NextResponse.json({ error: 'Gallery not found.' }, { status: 404 });
    if (!wedding.client_downloads) return NextResponse.json({ error: 'Downloads are disabled.' }, { status: 403 });

    const { data: photo } = await supabase.from('photos').select('storage_path,original_name').eq('id', id).eq('wedding_id', wedding.id).single();
    if (!photo) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });

    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storage_path, 60);
    if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not prepare download.' }, { status: 500 });

    const response = await fetch(signed.signedUrl);
    if (!response.ok) return NextResponse.json({ error: 'Could not fetch photo.' }, { status: 502 });
    const blob = await response.blob();
    return new Response(blob, {
      headers: {
        'content-type': photo.original_name?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        'content-disposition': `attachment; filename="${String(photo.original_name || 'photo').replace(/["\\\r\n]/g, '')}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not download photo.' }, { status: 500 });
  }
}
