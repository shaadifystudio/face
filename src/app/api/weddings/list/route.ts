import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = createSupabaseAdmin();
    const { data: studio } = await supabase.from('studios').select('id,name').eq('owner_id', user.id).maybeSingle();
    if (!studio) return NextResponse.json({ studio: null, weddings: [] });

    const { data: weddings, error } = await supabase
      .from('weddings')
      .select('id,slug,couple_name,wedding_date,status,photo_count,face_count,created_at')
      .eq('studio_id', studio.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ studio, weddings: weddings || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }
}