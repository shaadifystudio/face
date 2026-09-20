import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || user.user_metadata?.full_name || 'My Studio').trim() || 'My Studio';

    const supabase = createSupabaseAdmin();
    const { data: existing, error: findError } = await supabase
      .from('studios')
      .select('id,name')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
    if (existing) return NextResponse.json({ studio: existing, created: false });

    const { data: studio, error } = await supabase
      .from('studios')
      .insert({ owner_id: user.id, name })
      .select('id,name')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ studio, created: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }
}