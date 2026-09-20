import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL = process.env.AI_WORKER_URL;
const WORKER_SECRET = process.env.AI_WORKER_SECRET;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!URL || !SERVICE_KEY) return NextResponse.json({ error: 'Face search service is not configured.' }, { status: 500 });
    if (!WORKER_URL || !WORKER_SECRET) return NextResponse.json({ error: 'Face search AI is not connected yet.' }, { status: 503 });

    const supabase = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: wedding } = await supabase.from('weddings').select('id,client_enabled,client_face_search').eq('slug', slug).single();
    if (!wedding?.client_enabled) return NextResponse.json({ error: 'This wedding gallery is private.' }, { status: 404 });
    if (!wedding.client_face_search) return NextResponse.json({ error: 'Face Search is disabled for this wedding.' }, { status: 403 });

    const form = await req.formData();
    const file = form.get('selfie');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Please upload a selfie.' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Please upload an image.' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Selfie must be 10MB or smaller.' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const response = await fetch(`${WORKER_URL.replace(/\/$/, '')}/search-image?wedding_id=${encodeURIComponent(wedding.id)}&threshold=90`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream', authorization: `Bearer ${WORKER_SECRET}` },
      body: bytes,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: result.detail || result.error || 'Face search failed.' }, { status: response.status >= 500 ? 502 : response.status });

    return NextResponse.json({ matches: result.matches || [], provider: result.provider || 'aws' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Face search failed.' }, { status: 500 });
  }
}
