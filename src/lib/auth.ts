import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from './supabase-admin';

export async function requireUser(req: Request) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('Authentication required.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase environment variables are missing.');
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session.');
  return data.user;
}

export async function getOrCreateStudio(userId: string, name?: string) {
  const admin = createSupabaseAdmin();
  const existing = await admin.from('studios').select('id,name').eq('owner_id', userId).limit(1).maybeSingle();
  if (existing.data) return existing.data;
  const created = await admin.from('studios').insert({ owner_id: userId, name: name || 'My Studio' }).select('id,name').single();
  if (created.error || !created.data) throw new Error(created.error?.message || 'Could not create studio.');
  return created.data;
}