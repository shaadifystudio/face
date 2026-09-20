'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function ClientSearch() {
  const params = useParams<{ slug: string }>();
  const [file, setFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/70 flex items-center justify-between px-6">
        <Link href={`/w/${params.slug}`} className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        <span className="text-xs text-[#8a8179]">Private wedding gallery</span>
      </header>

      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="uppercase tracking-[.25em] text-xs text-[#A69A8B]">Find my photos</div>
        <h1 className="serif text-6xl mt-5">Find your moments.</h1>
        <p className="text-[#756e67] mt-4 leading-relaxed">Upload a selfie. Once face recognition is enabled, Shaadify will search this wedding for your photos.</p>

        <div className="mt-10 rounded-3xl bg-white border border-black/5 p-8">
          <label className="block rounded-2xl border-2 border-dashed border-[#C9A875]/50 p-10 cursor-pointer bg-[#F7F3ED]/60">
            <div className="serif text-3xl">{file ? file.name : 'Choose a selfie'}</div>
            <div className="text-sm text-[#8a8179] mt-2">JPG, PNG or WebP</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>

          <button disabled={!file} className="w-full mt-4 rounded-full bg-[#171514] disabled:opacity-30 text-white py-4">
            Face search is coming soon
          </button>

          <p className="text-xs text-[#8a8179] mt-5">
            Your selfie is not sent anywhere yet. This screen will connect to the biometric search service after the AI provider is configured.
          </p>
        </div>
      </div>
    </main>
  );
}