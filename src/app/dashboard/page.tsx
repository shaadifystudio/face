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

function statusLabel(status: string) {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  if (status === 'failed') return 'Needs attention';
  if (status === 'uploading') return 'Uploading';
  return 'Created';
}

function statusClass(status: string) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700';
  if (status === 'processing' || status === 'uploading') return 'bg-[#FBF4E6] text-[#6f5c37]';
  if (status === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-[#F7F3ED] text-[#756e67]';
}

export default function Dashboard() {
  const [user, setUser] = useState({ name: 'Photographer', email: '' });
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

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
    ready: weddings.filter(w => w.status === 'ready').length,
  }), [weddings]);

  const filteredWeddings = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return weddings;
    return weddings.filter(w =>
      w.couple_name.toLowerCase().includes(term) ||
      w.slug.toLowerCase().includes(term)
    );
  }, [weddings, query]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem('shaadify_user');
    window.location.href = '/';
  }

  async function deleteWedding(slug: string, coupleName: string) {
    if (!window.confirm(`Delete ${coupleName}? This will permanently delete the wedding and its uploaded photos.`)) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { window.location.href = '/login'; return; }
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${session.session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete wedding.');
      setWeddings(current => current.filter(w => w.slug !== slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete wedding.');
    }
  }

  async function copyClientLink(slug: string) {
    await navigator.clipboard?.writeText(`${window.location.origin}/w/${slug}/search`);
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="sticky top-0 z-20 h-20 border-b border-black/5 bg-[#F7F3ED]/90 backdrop-blur-md flex items-center justify-between px-5 md:px-8">
        <Link href="/" className="tracking-[.2em] text-sm font-medium">
          SHAADIFY <span className="text-[#A69A8B]">FACE</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[#756e67]">{user.name}</span>
          <button onClick={signOut} className="text-xs text-[#756e67] hover:text-[#171514]">Sign out</button>
          <div className="h-9 w-9 rounded-full bg-[#171514] text-white flex items-center justify-center text-xs">
            {user.name[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto grid md:grid-cols-[220px_1fr] min-h-[calc(100vh-80px)]">
        <aside className="hidden md:block border-r border-black/5 p-5">
          <div className="text-[10px] uppercase tracking-[.22em] text-[#A69A8B] px-4 mb-4">Studio</div>
          <nav className="space-y-1 text-sm">
            <div className="px-4 py-3 rounded-xl bg-[#171514] text-white">Dashboard</div>
            <Link href="/weddings/new" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">New wedding</Link>
            <Link href="/clients" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Client links</Link>
            <Link href="/storage" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Storage</Link>
            <Link href="/billing" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Billing</Link>
            <Link href="/settings" className="block px-4 py-3 rounded-xl text-[#756e67] hover:bg-white">Settings</Link>
          </nav>

          <div className="mt-10 rounded-2xl bg-white border border-black/5 p-5">
            <div className="text-[10px] uppercase tracking-[.2em] text-[#A69A8B]">How it works</div>
            <div className="serif text-2xl mt-3">Upload once.<br />Share one link.</div>
            <p className="text-xs leading-5 text-[#8a8179] mt-3">
              Your clients can find their wedding photos with a selfie when AI face search is connected.
            </p>
          </div>
        </aside>

        <section className="p-5 md:p-10 lg:p-12">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Studio dashboard</p>
              <h1 className="serif text-5xl md:text-6xl mt-2">Good to see you, {user.name.split(' ')[0]}.</h1>
              <p className="text-sm text-[#8a8179] mt-2">{user.email}</p>
            </div>
            <Link href="/weddings/new" className="inline-flex items-center justify-center rounded-full bg-[#171514] text-white px-6 py-3 text-sm">
              + Create wedding
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-10">
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-black/5">
              <div className="text-[10px] uppercase tracking-widest text-[#A69A8B]">Weddings</div>
              <div className="serif text-4xl mt-2">{stats.weddings}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-black/5">
              <div className="text-[10px] uppercase tracking-widest text-[#A69A8B]">Photos</div>
              <div className="serif text-4xl mt-2">{stats.photos.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-black/5">
              <div className="text-[10px] uppercase tracking-widest text-[#A69A8B]">Faces indexed</div>
              <div className="serif text-4xl mt-2">{stats.faces.toLocaleString()}</div>
            </div>
            <div className="bg-[#171514] text-white rounded-2xl p-5 md:p-6">
              <div className="text-[10px] uppercase tracking-widest text-[#C9A875]">AI ready</div>
              <div className="serif text-4xl mt-2">{stats.ready}</div>
              <div className="text-[10px] text-white/45 mt-1">weddings</div>
            </div>
          </div>

          <div className="mt-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="serif text-4xl">Your weddings</h2>
                <p className="text-sm text-[#8a8179] mt-1">Every wedding becomes a private client gallery.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search weddings…"
                  className="w-full md:w-56 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#C9A875]"
                />
                <span className="hidden sm:block text-xs text-[#8a8179] whitespace-nowrap">{weddings.length} total</span>
              </div>
            </div>

            {error && <div className="mt-5 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

            {loading ? (
              <div className="mt-5 bg-white rounded-2xl p-8 text-sm text-[#8a8179]">Loading your weddings…</div>
            ) : filteredWeddings.length === 0 ? (
              <div className="mt-5 bg-white rounded-3xl border border-black/5 p-10 md:p-14 text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-[#F7F3ED] flex items-center justify-center text-xl">✦</div>
                <div className="serif text-3xl mt-5">{query ? 'No weddings found.' : 'Your first wedding starts here.'}</div>
                <p className="text-sm text-[#8a8179] mt-2 max-w-md mx-auto">
                  {query ? 'Try a different couple name or slug.' : 'Create a wedding, upload the gallery, and share one private client link.'}
                </p>
                {!query && (
                  <Link href="/weddings/new" className="inline-block mt-6 rounded-full bg-[#171514] text-white px-6 py-3 text-sm">
                    Create your first wedding
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid xl:grid-cols-2 gap-4 mt-5">
                {filteredWeddings.map(w => (
                  <article key={w.id} className="bg-white rounded-3xl border border-black/5 p-5 md:p-6 hover:border-black/10 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="serif text-3xl truncate">{w.couple_name}</div>
                        <div className="text-xs text-[#8a8179] mt-1">
                          {w.wedding_date
                            ? new Date(w.wedding_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Date not set'}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider ${statusClass(w.status)}`}>
                        {statusLabel(w.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <div className="rounded-2xl bg-[#F7F3ED] p-4">
                        <div className="serif text-2xl">{w.photo_count.toLocaleString()}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8a8179] mt-1">Photos</div>
                      </div>
                      <div className="rounded-2xl bg-[#F7F3ED] p-4">
                        <div className="serif text-2xl">{w.face_count.toLocaleString()}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8a8179] mt-1">Faces indexed</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-5">
                      <Link href={`/w/${w.slug}`} className="flex-1 min-w-[110px] text-center rounded-full bg-[#171514] text-white px-4 py-2.5 text-sm">
                        Manage wedding
                      </Link>
                      <Link href={`/w/${w.slug}/search`} className="rounded-full border border-black/10 px-4 py-2.5 text-sm">
                        Client view
                      </Link>
                      <button
                        onClick={() => copyClientLink(w.slug)}
                        className="rounded-full border border-black/10 px-4 py-2.5 text-sm"
                      >
                        Copy link
                      </button>
                      <button
                        onClick={() => deleteWedding(w.slug, w.couple_name)}
                        className="rounded-full border border-red-200 text-red-600 px-4 py-2.5 text-sm hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}