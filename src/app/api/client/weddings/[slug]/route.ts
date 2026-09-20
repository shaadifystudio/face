import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase server configuration is missing.' }, { status: 500 });
    }

    const { slug } = await params;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: wedding, error } = await supabase
      .from('weddings')
      .select('slug,couple_name,wedding_date,client_enabled,client_face_search,client_all_photos,client_downloads,client_favourites')
      .eq('slug', slug)
      .eq('client_enabled', true)
      .single();

    if (error || !wedding) {
      return NextResponse.json({ error: 'Wedding gallery not found.' }, { status: 404 });
    }

    return NextResponse.json({ wedding });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load wedding gallery.' },
      { status: 500 }
    );
  }
}
