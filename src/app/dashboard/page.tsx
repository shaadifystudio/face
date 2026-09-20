'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type Wedding = {
  id: string;
  slug: string;
  couple_name: string;
  wedding_date: string | null;
  status: string;
  photo_count: number;
  face_count: number;
};

export default function Dashboard() {
  const [user, setUser] = useState({ name: 'Photographer', email: '' });
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          window.location.href = '/login';
          return;
        }
        const u = session.session.user;
        setUser({
          name: u.user_metadata?.full_name || 'Photographer',
          email: u.email || '',
        });
        const response = await fetch('/api/weddings/list', {
          headers: { authorization: `Bearer ${session.session.access_token}` },
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load weddings.');
        setWeddings(result.weddings || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load dashboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => ({
    weddings: weddings.length,
    photos: weddings.reduce((sum, w) => sum + (w.photo_count || 0), 0),
    faces: weddings.reduce((sum, w) => sum + (w.face_count || 0), 0),
  }), [weddings]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem('shaadify_user');
    window.location.href = '/';
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/70 flex items-center justify-between px-6 md:px-10">
        <Link href="/" className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        <div className="flex items-center gap-4">
          <span className="hidden md:block text-sm text-[#756e67]">{user.name}</span>
          <button onClick={signOut} className="text-xs text-[#756e67] hover:text-[#171514]">Sign out</button>
          <div className="h-9 w-9 rounded-full bg-[#171514] text-white flex items-center justify-center text-xs">{user.name[0]?.toUpperCase()}</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid md:grid-cols-[220px_1fr] min-h-[calc(100vh-80px)]">
        <aside className="hidden md:block border-r border-black/5 p-6">
          <nav className="space-y-2 text-sm">
            <div className="px-4 py-3 rounded-xl bg-[#171514] text-white">Dashboard</div>
            <Link href="/weddings/new" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">New wedding</Link>
            <Link href="/clients" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Clients</Link>
            <Link href="/storage" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Storage</Link>
            <Link href="/billing" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Billing</Link>
            <Link href="/settings" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Settings</Link>
          </nav>
        </aside>

        <section className="p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Studio dashboard</p>
              <h1 className="serif text-5xl mt-2">Good to see you, {user.name.split(' ')[0]}.</h1>
              <p className="text-sm text-[#8a8179] mt-2">{user.email}</p>
            </div>
            <Link href="/weddings/new" className="rounded-full bg-[#171514] text-white px-5 py-3 text-sm">+ New Wedding</Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            {[[stats.weddings, 'Total weddings'], [stats.photos.toLocaleString(), 'Photos uploaded'], [stats.faces.toLocaleString(), 'Faces indexed']].map(([v, l]) => (
              <div key={String(l)} className="bg-white rounded-2xl p-6 border border-black/5">
                <div className="serif text-3xl">{v}</div>
                <div className="text-xs text-[#8a8179] mt-2 uppercase tracking-widest">{l}</div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <div className="flex justify-between items-center">
              <h2 className="serif text-3xl">Your weddings</h2>
              <span className="text-xs text-[#8a8179]">{weddings.length} total</span>
            </div>

            {error && <div className="mt-5 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

            {loading ? (
              <div className="mt-5 bg-white rounded-2xl p-8 text-sm text-[#8a8179]">Loading your weddings…</div>
            ) : weddings.length === 0 ? (
              <div className="mt-5 bg-white rounded-2xl border border-black/5 p-10 text-center">
                <div className="serif text-3xl">Your first wedding starts here.</div>
                <p className="text-sm text-[#8a8179] mt-2">Create a wedding and upload your photos. Face recognition can be connected later.</p>
                <Link href="/weddings/new" className="inline-block mt-6 rounded-full bg-[#171514] text-white px-6 py-3 text-sm">Create wedding</Link>
              </div>
            ) : (
              <div className="space-y-4 mt-5">
                {weddings.map(w => (
                  <div key={w.id} className="bg-white rounded-2xl p-5 border border-black/5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-lg">{w.couple_name}</div>
                      <div className="text-sm text-[#8a8179] mt-1">
                        {w.photo_count.toLocaleString()} photos · {w.face_count.toLocaleString()} faces
                        {w.wedding_date ? ` · ${new Date(w.wedding_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </div>
                    </div>
                    <div className="text-xs rounded-full px-3 py-2 bg-[#F7F3ED] capitalize">{w.status}</div>
                    <Link href={`/w/${w.slug}`} className="rounded-full border border-black/10 px-4 py-2 text-sm text-center">Open</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}