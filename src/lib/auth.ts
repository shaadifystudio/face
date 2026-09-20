import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getRequestSupabase(req: Request): { client: SupabaseClient; token: string } {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('Authentication required.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing.');
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { client, token };
}

export async function requireUser(req: Request) {
  const { client, token } = getRequestSupabase(req);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session.');
  return data.user;
}

export async function getOrCreateStudio(userId: string, name?: string, client?: SupabaseClient) {
  if (!client) throw new Error('Authenticated Supabase client required.');
  const existing = await client.from('studios').select('id,name').eq('owner_id', userId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;
  const created = await client.from('studios').insert({ owner_id: userId, name: name || 'My Studio' }).select('id,name').single();
  if (created.error || !created.data) throw new Error(created.error?.message || 'Could not create studio.');
  return created.data;
}