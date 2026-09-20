// Seamless editorial masonry gallery implementation
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type Settings = {
  id?: string;
  couple_name: string;
  wedding_date?: string | null;
  client_enabled: boolean;
  client_face_search: boolean;
  client_all_photos: boolean;
  client_downloads: boolean;
  client_favourites: boolean;
};

type Photo = { id: string; name: string; url: string | null; bytes?: number };

export default function ClientSearch() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gallery, setGallery] = useState<Photo[]>([]);
  const [matches, setMatches] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'search' | 'gallery'>('search');
  const [loading, setLoading] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [favourites, setFavourites] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(\`shaadify-favourites-\${slug}\`);
    if (saved) { try { setFavourites(JSON.parse(saved)); } catch {} }
    fetch(\`/api/client/weddings/\${encodeURIComponent(slug)}\`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'This wedding link is unavailable.'); setSettings(d.wedding); })
      .catch(e => setError(e instanceof Error ? e.message : 'This wedding link is unavailable.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (tab !== 'gallery' || !settings?.client_all_photos || gallery.length) return;
    setGalleryLoading(true); setError('');
    fetch(\`/api/client/weddings/\${encodeURIComponent(slug)}/photos\`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load gallery.'); setGallery(d.photos || []); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load gallery.'))
      .finally(() => setGalleryLoading(false));
  }, [tab, settings, slug, gallery.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox]);

  function toggleFavourite(id: string) {
    if (!settings?.client_favourites) return;
    const next = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id];
    setFavourites(next);
    window.localStorage.setItem(\`shaadify-favourites-\${slug}\`, JSON.stringify(next));
  }

  async function searchFace() {
    if (!file || !settings?.client_face_search) return;
    setSearching(true); setError(''); setMatches([]);
    try {
      const form = new FormData(); form.append('selfie', file);
      const r = await fetch(\`/api/client/weddings/\${encodeURIComponent(slug)}/search\`, { method: 'POST', body: form });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Face search failed.');
      setMatches(d.matches || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Face search failed.'); }
    finally { setSearching(false); }
  }

  const resultCount = useMemo(() => matches.length, [matches]);
  const cards = tab === 'gallery' ? gallery : matches;

  if (loading) return <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center text-[#756e67]">Loading private gallery…</main>;

  if (!settings || !settings.client_enabled) return (
    <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center px-6 text-center">
      <div><div className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></div><h1 className="serif text-5xl mt-6">This gallery is private.</h1><p className="text-[#756e67] mt-3">{error || 'Client access has been turned off by the photographer.'}</p></div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/80 flex items-center justify-between px-5 md:px-8 sticky top-0 z-20 backdrop-blur">
        <div><div className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></div><div className="text-xs text-[#8a8179] mt-1">{settings.couple_name}</div></div>
        <span className="text-xs text-[#8a8179]">Private wedding gallery</span>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div><div className="uppercase tracking-[.25em] text-xs text-[#A69A8B]">Your private gallery</div><h1 className="serif text-5xl md:text-7xl mt-3">Find your moments.</h1><p className="text-[#756e67] mt-3 max-w-xl">Search your wedding by face or browse the full gallery when the photographer allows it.</p></div>
          <div className="flex rounded-full bg-white border border-black/5 p-1 self-start md:self-auto">
            <button onClick={() => setTab('search')} className={\`px-5 py-2.5 rounded-full text-sm \${tab === 'search' ? 'bg-[#171514] text-white' : 'text-[#756e67]'}\`}>Face Search</button>
            {settings.client_all_photos && <button onClick={() => setTab('gallery')} className={\`px-5 py-2.5 rounded-full text-sm \${tab === 'gallery' ? 'bg-[#171514] text-white' : 'text-[#756e67]'}\`}>All Photos</button>}
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl bg-red-50 text-red-700 px-5 py-4 text-sm">{error}</div>}

        {tab === 'search' && settings.client_face_search && (
          <section className="mt-8 rounded-[28px] bg-white border border-black/5 p-6 md:p-8">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[.2em] text-[#A69A8B]">1 · Upload selfie</p>
              <h2 className="serif text-3xl mt-2">Let Shaadify find you.</h2>
              <p className="text-sm text-[#8a8179] mt-2">Use a clear front-facing photo. Your selfie is processed only for this wedding search.</p>
              <label className="mt-6 block rounded-3xl border-2 border-dashed border-[#C9A875]/50 p-8 md:p-12 text-center cursor-pointer bg-[#F7F3ED]/60 hover:bg-[#F7F3ED] transition">
                <div className="serif text-2xl">{file ? file.name : 'Choose a selfie'}</div><div className="text-sm text-[#8a8179] mt-2">JPG, PNG or WebP · up to 10MB</div>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              <button onClick={searchFace} disabled={!file || searching} className="w-full mt-4 rounded-full bg-[#171514] disabled:opacity-30 text-white py-4">{searching ? 'Finding your photos…' : 'Find My Photos'}</button>
            </div>
          </section>
        )}

        {tab === 'search' && !settings.client_face_search && <div className="mt-8 rounded-3xl bg-white border border-black/5 p-10 text-center text-[#756e67]">Face Search is disabled for this wedding.</div>}
        {tab === 'search' && matches.length > 0 && <section className="mt-10"><p className="text-xs uppercase tracking-[.2em] text-[#A69A8B]">2 · Your results</p><h2 className="serif text-4xl mt-2">{resultCount} moments found</h2></section>}
        {tab === 'gallery' && <section className="mt-10"><p className="text-xs uppercase tracking-[.2em] text-[#A69A8B]">Wedding gallery</p><h2 className="serif text-4xl mt-2">{gallery.length} photos</h2>{galleryLoading && <div className="py-20 text-center text-[#8a8179]">Loading your gallery…</div>}</section>}

        {cards.length > 0 && (
          <section className="mt-8 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 md:gap-5">
            {cards.map(photo => (
              <article key={photo.id} className="group relative mb-4 md:mb-5 break-inside-avoid overflow-hidden rounded-[20px] bg-white border border-black/5 shadow-[0_8px_30px_rgba(23,21,20,0.05)]">
                <button type="button" onClick={() => photo.url && setLightbox(photo)} className="block w-full text-left">
                  {photo.url ? <img src={photo.url} alt={photo.name} loading="lazy" className="block w-full h-auto object-cover transition duration-700 group-hover:scale-[1.025]" /> : <div className="aspect-[4/5] w-full flex items-center justify-center text-xs text-[#8a8179]">Preview unavailable</div>}
                </button>
                <div className="absolute inset-x-0 bottom-0 p-3 flex justify-between items-end bg-gradient-to-t from-black/65 via-black/10 to-transparent pt-14 opacity-0 group-hover:opacity-100 transition-opacity">
                  {settings.client_favourites ? <button type="button" onClick={() => toggleFavourite(photo.id)} className="h-10 w-10 rounded-full bg-white/95 text-lg shadow-sm">{favourites.includes(photo.id) ? '♥' : '♡'}</button> : <span />}
                  {settings.client_downloads && <a href={\`/api/client/weddings/\${encodeURIComponent(slug)}/photos/\${encodeURIComponent(photo.id)}/download\`} onClick={e => e.stopPropagation()} className="px-4 py-2 rounded-full bg-white/95 text-xs font-medium shadow-sm">Download</a>}
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === 'search' && !searching && file && matches.length === 0 && <div className="mt-8 text-center text-sm text-[#8a8179]">No results yet. Click “Find My Photos” to search this wedding.</div>}
      </div>

      {lightbox?.url && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 md:p-8 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} className="absolute top-5 right-5 h-11 w-11 rounded-full bg-white/10 text-white text-xl">×</button>
          <img src={lightbox.url} alt={lightbox.name} className="max-h-[92vh] max-w-[94vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}