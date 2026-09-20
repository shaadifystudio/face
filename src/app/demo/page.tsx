'use client';

import Link from 'next/link';
import { useState } from 'react';

const demoPhotos = [
  { name: 'DSC_1042.jpg', status: 'uploaded' },
  { name: 'DSC_1048.jpg', status: 'uploaded' },
  { name: 'DSC_1071.jpg', status: 'uploaded' },
  { name: 'DSC_1093.jpg', status: 'uploaded' },
  { name: 'DSC_1120.jpg', status: 'uploaded' },
  { name: 'DSC_1147.jpg', status: 'uploaded' },
];

export default function Demo() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(location.origin + '/demo/search');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/80 flex items-center justify-between px-6 md:px-10">
        <Link href="/" className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        <div className="flex items-center gap-3">
          <span className="text-xs rounded-full bg-[#FBF4E6] px-3 py-2 text-[#6f5c37]">Demo mode</span>
          <Link href="/login" className="text-sm underline">Sign in</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Demo studio</p>
          <h1 className="serif text-6xl mt-2">Nikhil & Simran</h1>
          <p className="text-[#756e67] mt-2">Wedding workspace · Demo data</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-10">
          <div className="lg:col-span-2 bg-[#171514] text-white rounded-3xl p-8">
            <div className="text-xs uppercase tracking-widest text-[#C9A875]">Setup status</div>
            <div className="serif text-4xl mt-3">Ready for AI</div>
            <p className="text-white/55 mt-3 max-w-xl">The Shaadify workflow is ready for a face-recognition provider. Rekognition is not required for this demo.</p>
            <div className="h-2 bg-white/10 rounded-full mt-8 overflow-hidden"><div className="h-full bg-[#C9A875] w-[100%]" /></div>
            <div className="grid grid-cols-3 gap-5 mt-8">
              <div><div className="serif text-2xl">6</div><div className="text-xs text-white/45">Demo photos</div></div>
              <div><div className="serif text-2xl">Private</div><div className="text-xs text-white/45">Storage design</div></div>
              <div><div className="serif text-2xl">No AWS</div><div className="text-xs text-white/45">Required here</div></div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-black/5 p-7">
            <div className="text-xs uppercase tracking-widest text-[#A69A8B]">Client experience</div>
            <div className="serif text-3xl mt-4">Find My Photos</div>
            <p className="text-sm text-[#756e67] mt-2">Preview the client-facing selfie search screen.</p>
            <Link href="/demo/search" className="block text-center rounded-full bg-[#171514] text-white py-3 mt-7">Open client view</Link>
            <button onClick={copyLink} className="w-full rounded-full border border-black/10 py-3 mt-3 text-sm">{copied ? 'Copied ✓' : 'Copy client link'}</button>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex justify-between items-center">
            <h2 className="serif text-3xl">Uploaded photos</h2>
            <span className="text-xs text-[#8a8179]">Demo data only</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-5">
            {demoPhotos.map(photo => (
              <div key={photo.name} className="bg-white rounded-2xl border border-black/5 p-4">
                <div className="aspect-[4/5] rounded-xl bg-[#DED8CF] flex items-end p-3">
                  <span className="text-[10px] bg-white/80 rounded-full px-2 py-1">{photo.status}</span>
                </div>
                <div className="text-xs truncate mt-3">{photo.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}