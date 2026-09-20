'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

type Photo = { id: string; original_name: string; bytes: number; status: string; url: string | null };

export default function WeddingWorkspace() {
  const params = useParams<{ slug: string }>();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ total: 0, indexed: 0, processing: 0, failed: 0, percent: 0 });

  async function load() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        window.location.href = '/login';
        return;
      }
      const headers = { authorization: `Bearer ${session.session.access_token}` };
      const [workspaceResponse, statusResponse] = await Promise.all([
        fetch(`/api/weddings/${params.slug}`, { headers, cache: 'no-store' }),
        fetch(`/api/upload/status?weddingId=${encodeURIComponent(wedding?.id || '')}`, { headers, cache: 'no-store' }),
      ]);
      const workspace = await workspaceResponse.json();
      if (!workspaceResponse.ok) throw new Error(workspace.error || 'Could not load wedding.');
      setWedding(workspace.wedding);
      setPhotos(workspace.photos || []);

      if (workspace.wedding?.id) {
        const statusRes = statusResponse.ok && wedding?.id === workspace.wedding.id
          ? statusResponse
          : await fetch(`/api/upload/status?weddingId=${encodeURIComponent(workspace.wedding.id)}`, { headers, cache: 'no-store' });
        if (statusRes.ok) {
          const status = await statusRes.json();
          setProgress(status.progress || { total: 0, indexed: 0, processing: 0, failed: 0, percent: 0 });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wedding.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const statusLabel = wedding?.status === 'uploaded'
    ? 'Photos uploaded · AI waiting'
    : wedding?.status === 'processing'
      ? 'AI processing'
      : wedding?.status || 'created';

  if (loading) return <main className="min-h-screen bg-[#F7F3ED] p-10 text-[#756e67]">Loading wedding…</main>;

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/70 flex items-center justify-between px-6 md:px-10">
        <Link href="/dashboard" className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        {wedding && (
          <Link href={`/w/${wedding.slug}/search`} className="rounded-full bg-[#171514] text-white px-5 py-3 text-sm">Client preview</Link>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm mb-6">{error}</div>}
        {wedding && (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Wedding workspace</p>
                <h1 className="serif text-6xl mt-2">{wedding.couple_name}</h1>
                <p className="text-[#756e67] mt-2">
                  {wedding.photo_count.toLocaleString()} photos · {wedding.face_count.toLocaleString()} faces
                  {wedding.wedding_date ? ` · ${new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigator.clipboard?.writeText(location.origin + `/w/${wedding.slug}/search`)} className="rounded-full border border-black/10 px-5 py-3">Copy client link</button>
                <Link href="/weddings/new" className="rounded-full bg-[#171514] text-white px-5 py-3">Add wedding</Link>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-10">
              <div className="lg:col-span-2 bg-[#171514] text-white rounded-3xl p-8">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#C9A875]">Processing status</div>
                    <div className="serif text-4xl mt-3">{statusLabel}</div>
                  </div>
                  <div className="serif text-4xl">{progress.percent}%</div>
                </div>
                <div className="h-2 bg-white/10 rounded-full mt-10 overflow-hidden">
                  <div className="h-full bg-[#C9A875] transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="grid grid-cols-3 mt-8 gap-5 text-sm">
                  <div><div className="text-2xl serif">{progress.total.toLocaleString()}</div><div className="text-white/45">Uploaded</div></div>
                  <div><div className="text-2xl serif">{progress.indexed.toLocaleString()}</div><div className="text-white/45">AI indexed</div></div>
                  <div><div className="text-2xl serif">{progress.failed.toLocaleString()}</div><div className="text-white/45">Failed</div></div>
                </div>
                {wedding.status === 'uploaded' && (
                  <div className="mt-7 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/65">
                    Your photos are safely uploaded. Face recognition is not connected yet, so no biometric processing is running.
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-black/5 p-7">
                <div className="text-xs uppercase tracking-widest text-[#A69A8B]">Client link</div>
                <div className="serif text-3xl mt-4">Find My Photos</div>
                <p className="text-sm text-[#756e67] mt-2">A private client experience for this wedding.</p>
                <div className="mt-7 rounded-2xl bg-[#F7F3ED] p-5 text-sm break-all">/w/{wedding.slug}/search</div>
                <Link href={`/w/${wedding.slug}/search`} className="block text-center rounded-full bg-[#C9A875] py-3 mt-4">Open client experience</Link>
              </div>
            </div>

            <div className="mt-10">
              <div className="flex justify-between items-center">
                <h2 className="serif text-3xl">Uploaded photos</h2>
                <span className="text-xs text-[#8a8179]">Showing latest {photos.length}</span>
              </div>
              {photos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-black/5 p-10 mt-5 text-sm text-[#8a8179]">No photos uploaded yet.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-5">
                  {photos.map(photo => (
                    <div key={photo.id} className="bg-white rounded-2xl overflow-hidden border border-black/5">
                      <div className="aspect-[4/5] bg-[#DED8CF]">
                        {photo.url && <img src={photo.url} alt={photo.original_name} className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="p-3">
                        <div className="text-xs truncate">{photo.original_name}</div>
                        <div className="text-[10px] text-[#8a8179] mt-1 capitalize">{photo.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}