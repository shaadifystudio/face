import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';
export async function GET(req: Request) {
  let user; try { user = await requireUser(req); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 }); }
  const url = new URL(req.url); const weddingId = url.searchParams.get('weddingId'); if (!weddingId) return NextResponse.json({ error: 'weddingId is required' }, { status: 400 });
  try {
    const supabase = createSupabaseAdmin(); const { data: wedding, error: weddingError } = await supabase.from('weddings').select('id,status,photo_count,face_count,studios!inner(owner_id)').eq('id', weddingId).single();
    if (weddingError || !wedding || (wedding as any).studios?.owner_id !== user.id) return NextResponse.json({ error: 'Wedding not found.' }, { status: 404 });
    const { data: rows } = await supabase.from('photos').select('status').eq('wedding_id', weddingId);
    const total = rows?.length || 0; const indexed = rows?.filter(x => x.status === 'indexed').length || 0; const processing = rows?.filter(x => x.status === 'processing').length || 0; const failed = rows?.filter(x => x.status === 'failed').length || 0;
    return NextResponse.json({ wedding, progress: { total, indexed, processing, failed, percent: total ? Math.round((indexed / total) * 100) : 0 } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read status.' }, { status: 500 }); }
}