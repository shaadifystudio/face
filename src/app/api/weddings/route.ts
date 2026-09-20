import { NextResponse } from 'next/server';
import { getOrCreateStudio, getRequestSupabase, requireUser } from '@/lib/auth';
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'wedding'; }

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { client } = getRequestSupabase(req);
    const body = await req.json();
    const coupleName = String(body?.coupleName || '').trim();
    if (!coupleName) return NextResponse.json({ error: 'coupleName is required' }, { status: 400 });

    const studio = await getOrCreateStudio(user.id, `${coupleName.split('&')[0].trim()}'s Studio`, client);
    const base = slugify(coupleName);
    let slug = base;
    for (let i = 2; i < 100; i++) {
      const { data, error } = await client.from('weddings').select('id').eq('slug', slug).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) break;
      slug = `${base}-${i}`;
    }

    const { data: wedding, error } = await client
      .from('weddings')
      .insert({ studio_id: studio.id, slug, couple_name: coupleName, wedding_date: body?.weddingDate || null, status: 'created' })
      .select('id,slug,couple_name,wedding_date,status')
      .single();

    if (error || !wedding) return NextResponse.json({ error: error?.message || 'Could not create wedding.' }, { status: 500 });
    return NextResponse.json({ ok: true, wedding: { id: wedding.id, slug: wedding.slug, coupleName: wedding.couple_name, weddingDate: wedding.wedding_date, status: wedding.status } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create wedding.' }, { status: 401 });
  }
}