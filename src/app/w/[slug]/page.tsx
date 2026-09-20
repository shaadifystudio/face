'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  client_enabled: boolean;
  client_face_search: boolean;
  client_all_photos: boolean;
  client_downloads: boolean;
  client_favourites: boolean;
};

type Photo = {
  id: string;
  original_name: string;
  bytes: number;
  status: string;
  url: string | null;
};

type QueueFile = {
  id: string;
  file: File;
  state: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const BATCH_SIZE = 50;

export default function WeddingWorkspace() {
  const params = useParams<{ slug: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(0);
  const [progress, setProgress] = useState({ total: 0, indexed: 0, processing: 0, failed: 0, percent: 0 });
  const [savingAccess, setSavingAccess] = useState(false);

  async function getSession() {
    const supabase = createSupabaseBrowserClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      window.location.href = '/login';
      return null;
    }
    return session.session;
  }

  async function load() {
    try {
      const session = await getSession();
      if (!session) return;
      const headers = { authorization: `Bearer ${session.access_token}` };
      const workspaceResponse = await fetch(`/api/weddings/${params.slug}`, { headers, cache: 'no-store' });
      const workspace = await workspaceResponse.json();
      if (!workspaceResponse.ok) throw new Error(workspace.error || 'Could not load wedding.');
      setWedding(workspace.wedding);
      setPhotos(workspace.photos || []);

      if (workspace.wedding?.id) {
        const statusRes = await fetch(`/api/upload/status?weddingId=${encodeURIComponent(workspace.wedding.id)}`, { headers, cache: 'no-store' });
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

  const queueStats = useMemo(() => ({
    total: queue.length,
    waiting: queue.filter(x => x.state === 'waiting').length,
    uploaded: queue.filter(x => x.state === 'uploaded').length,
    failed: queue.filter(x => x.state === 'failed').length,
  }), [queue]);

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    const accepted: QueueFile[] = [];
    const rejected: QueueFile[] = [];

    incoming.forEach(file => {
      if (!file.type.startsWith('image/')) {
        rejected.push({ id: crypto.randomUUID(), file, state: 'failed', error: 'Not an image' });
      } else if (file.size > MAX_FILE_BYTES) {
        rejected.push({ id: crypto.randomUUID(), file, state: 'failed', error: 'Over 50 MB' });
      } else {
        accepted.push({ id: crypto.randomUUID(), file, state: 'waiting' });
      }
    });

    setQueue(current => [...current, ...accepted, ...rejected]);
    setUploadComplete(0);
  }

  function removeWaiting(id: string) {
    if (uploading) return;
    setQueue(current => current.filter(item => item.id !== id));
  }

  async function updateClientAccess(key: 'client_enabled' | 'client_face_search' | 'client_all_photos' | 'client_downloads' | 'client_favourites', value: boolean) {
    if (!wedding || savingAccess) return;
    const session = await getSession();
    if (!session) return;
    setSavingAccess(true);
    setError('');
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(wedding.slug)}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update client access.');
      setWedding(result.wedding);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update client access.');
    } finally {
      setSavingAccess(false);
    }
  }

  async function uploadQueue() {
    if (!wedding || uploading) return;
    const session = await getSession();
    if (!session) return;

    const waiting = queue.filter(item => item.state === 'waiting');
    if (!waiting.length) return;

    setUploading(true);
    setError('');
    setUploadComplete(0);

    const supabase = createSupabaseBrowserClient();
    let completed = 0;

    try {
      for (let start = 0; start < waiting.length; start += BATCH_SIZE) {
        const batch = waiting.slice(start, start + BATCH_SIZE);
        const headers = {
          authorization: `Bearer ${session.access_token}`,
          'content-type': 'application/json',
        };

        setQueue(current => current.map(item =>
          batch.some(x => x.id === item.id) ? { ...item, state: 'uploading', error: undefined } : item
        ));

        const prepareResponse = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            weddingId: wedding.id,
            files: batch.map(({ file }) => ({
              name: file.name,
              size: file.size,
              type: file.type,
            })),
          }),
        });

        const prepared = await prepareResponse.json();
        if (!prepareResponse.ok) throw new Error(prepared.error || 'Could not prepare upload.');

        const uploadedIds: string[] = [];
        const uploads = prepared.uploads || [];

        await Promise.all(uploads.map(async (upload: { photoId: string; path: string; token: string }, index: number) => {
          const item = batch[index];
          const { error: uploadError } = await supabase.storage
            .from(prepared.bucket || 'wedding-photos')
            .uploadToSignedUrl(upload.path, upload.token, item.file);

          if (uploadError) {
            setQueue(current => current.map(x => x.id === item.id
              ? { ...x, state: 'failed', error: uploadError.message || 'Upload failed' }
              : x
            ));
            return;
          }

          uploadedIds.push(upload.photoId);
          completed += 1;
          setUploadComplete(completed);
          setQueue(current => current.map(x => x.id === item.id ? { ...x, state: 'uploaded' } : x));
        }));

        if (uploadedIds.length) {
          const completeResponse = await fetch('/api/upload/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ weddingId: wedding.id, photoIds: uploadedIds }),
          });
          const completeData = await completeResponse.json();
          if (!completeResponse.ok) throw new Error(completeData.error || 'Could not finalize uploaded photos.');
        }
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!window.confirm(`Delete ${photo.original_name}? This photo will be permanently removed.`)) return;
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete photo.');
      setPhotos(current => current.filter(item => item.id !== photo.id));
      setWedding(current => current ? { ...current, photo_count: result.photoCount ?? Math.max(0, current.photo_count - 1) } : current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete photo.');
    }
  }

  async function deleteWedding() {
    if (!wedding) return;
    if (!window.confirm(`Delete ${wedding.couple_name}? This will permanently delete the wedding and all uploaded photos.`)) return;
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch(`/api/weddings/${encodeURIComponent(wedding.slug)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete wedding.');
      window.location.href = '/dashboard';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete wedding.');
    }
  }

  function clearFinished() {
    setQueue(current => current.filter(item => item.state === 'waiting' || item.state === 'uploading'));
  }

  const statusLabel = wedding?.status === 'processing'
    ? 'AI processing'
    : wedding?.status === 'ready'
      ? 'Ready'
      : wedding?.status === 'uploading'
        ? 'Uploading'
        : 'Ready for upload';

  if (loading) return <main className="min-h-screen bg-[#F7F3ED] p-10 text-[#756e67]">Loading wedding…</main>;

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/80 backdrop-blur-md flex items-center justify-between px-5 md:px-10 sticky top-0 z-20">
        <Link href="/dashboard" className="tracking-[.2em] text-sm font-medium">
          SHAADIFY <span className="text-[#A69A8B]">FACE</span>
        </Link>
        {wedding && (
          <Link href={`/w/${wedding.slug}/search`} className="rounded-full bg-[#171514] text-white px-5 py-2.5 text-sm">
            Client preview
          </Link>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {wedding && (
          <>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Wedding workspace</p>
                <h1 className="serif text-5xl md:text-6xl mt-2">{wedding.couple_name}</h1>
                <p className="text-[#756e67] mt-2">
                  {wedding.photo_count.toLocaleString()} photos · {wedding.face_count.toLocaleString()} faces
                  {wedding.wedding_date ? ` · ${new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => navigator.clipboard?.writeText(location.origin + `/w/${wedding.slug}/search`)}
                  className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm"
                >
                  Copy client link
                </button>
                <Link href="/weddings/new" className="rounded-full bg-[#171514] text-white px-5 py-3 text-sm">
                  Add wedding
                </Link>
                <button
                  onClick={deleteWedding}
                  className="rounded-full border border-red-200 bg-white text-red-600 px-5 py-3 text-sm hover:bg-red-50"
                >
                  Delete wedding
                </button>
              </div>
            </div>

            <section className="mt-10">
              <div className="bg-white rounded-[28px] border border-black/5 p-5 md:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[.22em] text-[#A69A8B]">Client access & privacy</p>
                    <h2 className="serif text-3xl md:text-4xl mt-2">Control what clients can see</h2>
                    <p className="text-sm text-[#8a8179] mt-1">Changes apply immediately to the private client link.</p>
                  </div>
                  <div className="text-xs text-[#8a8179]">{savingAccess ? 'Saving…' : 'Auto-saved'}</div>
                </div>

                <div className="mt-7 divide-y divide-black/5">
                  {([
                    ['client_enabled', 'Client access', 'Allow this wedding link to be opened by clients.', wedding.client_enabled],
                    ['client_face_search', 'Face Search', 'Let guests upload a selfie to find photos they appear in.', wedding.client_face_search],
                    ['client_all_photos', 'Browse All Photos', 'Allow clients to browse the complete wedding gallery.', wedding.client_all_photos],
                    ['client_downloads', 'Downloads', 'Allow clients to download photos from the gallery.', wedding.client_downloads],
                    ['client_favourites', 'Favourites', 'Allow clients to mark and save favourite photos.', wedding.client_favourites],
                  ] as const).map(([key, title, description, enabled]) => (
                    <div key={key} className="flex items-center justify-between gap-5 py-5">
                      <div>
                        <div className="font-medium">{title}</div>
                        <div className="text-sm text-[#8a8179] mt-1">{description}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        disabled={savingAccess}
                        onClick={() => updateClientAccess(key, !enabled)}
                        className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${enabled ? 'bg-[#C9A875]' : 'bg-[#D8D3CC]'} disabled:opacity-60`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-[#F7F3ED] p-4 text-xs text-[#756e67]">
                  <strong>Private by default:</strong> your client link does not expose the photographer dashboard or biometric records. Face-search data stays server-side.
                </div>
              </div>
            </section>

            <section className="mt-10">
              <div className="bg-white rounded-[28px] border border-black/5 p-5 md:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[.22em] text-[#A69A8B]">Wedding gallery</p>
                    <h2 className="serif text-3xl md:text-4xl mt-2">Add your photos</h2>
                    <p className="text-sm text-[#8a8179] mt-1">
                      Drag your wedding images here or choose a folder from your computer.
                    </p>
                  </div>
                  <div className="text-sm text-[#756e67]">
                    {wedding.photo_count.toLocaleString()} photos already uploaded
                  </div>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />

                <div
                  onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragging(false);
                    if (!uploading && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                  }}
                  className={`mt-7 rounded-[24px] border-2 border-dashed transition-all p-8 md:p-14 text-center cursor-pointer ${dragging ? 'border-[#C9A875] bg-[#FBF6EC] scale-[1.005]' : 'border-black/10 bg-[#F7F3ED]/60 hover:bg-[#F7F3ED]'}`}
                  onClick={() => !uploading && inputRef.current?.click()}
                >
                  <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center text-2xl transition-transform ${dragging ? 'bg-[#C9A875] text-white scale-110' : 'bg-white'}`}>
                    ↑
                  </div>
                  <div className="serif text-3xl mt-5">
                    {dragging ? 'Drop your photos here' : 'Drop your wedding photos here'}
                  </div>
                  <p className="text-sm text-[#8a8179] mt-2">or click to browse your computer</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-5 text-[11px] text-[#8a8179]">
                    <span className="rounded-full bg-white px-3 py-1.5">JPG</span>
                    <span className="rounded-full bg-white px-3 py-1.5">PNG</span>
                    <span className="rounded-full bg-white px-3 py-1.5">WebP</span>
                    <span className="rounded-full bg-white px-3 py-1.5">Max 50 MB / photo</span>
                  </div>
                </div>

                {queue.length > 0 && (
                  <div className="mt-7">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{queueStats.total.toLocaleString()} photos in upload queue</div>
                        <div className="text-xs text-[#8a8179] mt-1">
                          {queueStats.waiting} waiting · {queueStats.uploaded} uploaded · {queueStats.failed} failed
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {queueStats.uploaded > 0 && !uploading && (
                          <button onClick={clearFinished} className="rounded-full border border-black/10 px-4 py-2 text-xs">
                            Clear finished
                          </button>
                        )}
                        {queueStats.waiting > 0 && (
                          <button
                            onClick={uploadQueue}
                            disabled={uploading}
                            className="rounded-full bg-[#171514] text-white px-5 py-2.5 text-sm disabled:opacity-50"
                          >
                            {uploading ? `Uploading ${uploadComplete}/${queueStats.waiting + queueStats.uploaded}…` : `Upload ${queueStats.waiting.toLocaleString()} photos`}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="h-2 rounded-full bg-[#F0ECE6] mt-5 overflow-hidden">
                      <div
                        className="h-full bg-[#C9A875] transition-all duration-300"
                        style={{ width: `${queue.length ? ((queueStats.uploaded + (uploading ? uploadComplete : 0)) / Math.max(queue.length, 1)) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="mt-5 max-h-72 overflow-y-auto rounded-2xl border border-black/5 divide-y divide-black/5">
                      {queue.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <div className="h-10 w-10 rounded-lg bg-[#F7F3ED] flex items-center justify-center text-xs text-[#8a8179]">IMG</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{item.file.name}</div>
                            <div className="text-[10px] text-[#8a8179] mt-0.5">
                              {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                              {item.error ? ` · ${item.error}` : ''}
                            </div>
                          </div>
                          <div className={`text-[10px] uppercase tracking-wider ${item.state === 'failed' ? 'text-red-600' : item.state === 'uploaded' ? 'text-emerald-600' : 'text-[#8a8179]'}`}>
                            {item.state}
                          </div>
                          {item.state === 'waiting' && !uploading && (
                            <button onClick={() => removeWaiting(item.id)} className="text-[#8a8179] hover:text-red-600 px-2" aria-label={`Remove ${item.file.name}`}>
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="grid lg:grid-cols-3 gap-5 mt-8">
              <div className="lg:col-span-2 bg-[#171514] text-white rounded-3xl p-7 md:p-8">
                <div className="flex justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#C9A875]">Processing status</div>
                    <div className="serif text-4xl mt-3">{statusLabel}</div>
                  </div>
                  <div className="serif text-4xl">{progress.percent}%</div>
                </div>
                <div className="h-2 bg-white/10 rounded-full mt-9 overflow-hidden">
                  <div className="h-full bg-[#C9A875] transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="grid grid-cols-3 mt-7 gap-5 text-sm">
                  <div><div className="text-2xl serif">{progress.total.toLocaleString()}</div><div className="text-white/45">Uploaded</div></div>
                  <div><div className="text-2xl serif">{progress.indexed.toLocaleString()}</div><div className="text-white/45">AI indexed</div></div>
                  <div><div className="text-2xl serif">{progress.failed.toLocaleString()}</div><div className="text-white/45">Failed</div></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-black/5 p-7">
                <div className="text-xs uppercase tracking-widest text-[#A69A8B]">Client link</div>
                <div className="serif text-3xl mt-4">Find My Photos</div>
                <p className="text-sm text-[#756e67] mt-2">A private client experience for this wedding.</p>
                <div className="mt-6 rounded-2xl bg-[#F7F3ED] p-5 text-sm break-all">/w/{wedding.slug}/search</div>
                <Link href={`/w/${wedding.slug}/search`} className="block text-center rounded-full bg-[#C9A875] py-3 mt-4">
                  Open client experience
                </Link>
              </div>
            </div>

            <section className="mt-10">
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
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="text-[10px] text-[#8a8179] capitalize">{photo.status}</div>
                          <button
                            onClick={() => deletePhoto(photo)}
                            className="text-[10px] text-red-600 hover:underline"
                            aria-label={`Delete ${photo.original_name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
