import { NextResponse } from 'next/server';
import { getRequestSupabase, requireUser } from '@/lib/auth';

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'wedding-photos';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const { client: supabase } = getRequestSupabase(req);

    const { data: photo, error } = await supabase
      .from('photos')
      .select('id,storage_path,wedding_id,weddings!inner(studios!inner(owner_id))')
      .eq('id', id)
      .single();

    if (error || !photo || (photo as any).weddings?.studios?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
    }

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from('photos').delete().eq('id', id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    const { count } = await supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', photo.wedding_id);

    await supabase
      .from('weddings')
      .update({ photo_count: count || 0 })
      .eq('id', photo.wedding_id);

    return NextResponse.json({ ok: true, photoCount: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not delete photo.' }, { status: 500 });
  }
}
