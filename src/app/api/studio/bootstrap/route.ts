import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) throw new Error('Authentication required.');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase environment variables are missing.');

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error('Invalid or expired session.');

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || userData.user.user_metadata?.full_name || 'My Studio').trim() || 'My Studio';

    const { data: existing, error: findError } = await supabase
      .from('studios')
      .select('id,name')
      .eq('owner_id', userData.user.id)
      .maybeSingle();

    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
    if (existing) return NextResponse.json({ studio: existing, created: false });

    const { data: studio, error } = await supabase
      .from('studios')
      .insert({ owner_id: userData.user.id, name })
      .select('id,name')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ studio, created: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }
}