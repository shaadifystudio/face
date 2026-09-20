'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ClientSearch() {
  const params = useParams<{ slug: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<{ couple_name: string; client_enabled: boolean; client_face_search: boolean; client_all_photos: boolean; client_downloads: boolean; client_favourites: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/client/weddings/${encodeURIComponent(params.slug)}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This wedding link is unavailable.');
        setSettings(data.wedding);
      })
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) return <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center text-[#756e67]">Loading private gallery…</main>;

  if (!settings || !settings.client_enabled) {
    return (
      <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center px-6 text-center">
        <div>
          <div className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></div>
          <h1 className="serif text-5xl mt-6">This gallery is private.</h1>
          <p className="text-[#756e67] mt-3">Client access has been turned off by the photographer.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/70 flex items-center justify-between px-6">
        <Link href={`/w/${params.slug}`} className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        <span className="text-xs text-[#8a8179]">Private wedding gallery</span>
      </header>

      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="uppercase tracking-[.25em] text-xs text-[#A69A8B]">Find my photos</div>
        <h1 className="serif text-6xl mt-5">Find your moments.</h1>
        <p className="text-[#756e67] mt-4 leading-relaxed">Upload a selfie to find the wedding photos you appear in.</p>

        <div className="mt-10 rounded-3xl bg-white border border-black/5 p-8">
          {settings.client_face_search && <label className="block rounded-2xl border-2 border-dashed border-[#C9A875]/50 p-10 cursor-pointer bg-[#F7F3ED]/60">
            <div className="serif text-3xl">{file ? file.name : 'Choose a selfie'}</div>
            <div className="text-sm text-[#8a8179] mt-2">JPG, PNG or WebP</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>}

          {!settings.client_face_search && <div className="rounded-2xl bg-[#F7F3ED] p-6 text-sm text-[#756e67]">Face Search is disabled for this wedding.</div>}

          <button disabled={!file || !settings.client_face_search} className="w-full mt-4 rounded-full bg-[#171514] disabled:opacity-30 text-white py-4">
            Face search is coming soon
          </button>

          <div className="mt-6 grid gap-2 text-left">
            <div className="rounded-2xl bg-[#F7F3ED] px-4 py-3 text-sm">{settings.client_all_photos ? '✓ Browse all photos enabled' : '• Browse all photos disabled'}</div>
            <div className="rounded-2xl bg-[#F7F3ED] px-4 py-3 text-sm">{settings.client_downloads ? '✓ Downloads enabled' : '• Downloads disabled'}</div>
            <div className="rounded-2xl bg-[#F7F3ED] px-4 py-3 text-sm">{settings.client_favourites ? '✓ Favourites enabled' : '• Favourites disabled'}</div>
          </div>

          <p className="text-xs text-[#8a8179] mt-5">
            Your selfie is not sent anywhere yet. This screen will connect to the biometric search service after the AI provider is configured.
          </p>
        </div>
      </div>
    </main>
  );
}