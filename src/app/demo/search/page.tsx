'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DemoSearch() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 border-b border-black/5 bg-white/80 flex items-center justify-between px-6 md:px-10">
        <Link href="/demo" className="tracking-[.2em] text-sm">SHAADIFY <span className="text-[#A69A8B]">FACE</span></Link>
        <span className="text-xs rounded-full bg-[#FBF4E6] px-3 py-2 text-[#6f5c37]">Demo mode</span>
      </header>

      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="uppercase tracking-[.25em] text-xs text-[#A69A8B]">Nikhil & Simran</p>
        <h1 className="serif text-6xl mt-5">Find your moments.</h1>
        <p className="text-[#756e67] mt-4">See the client-side experience before biometric search is connected.</p>

        <div className="mt-10 rounded-3xl bg-white border border-black/5 p-8">
          <label className="block rounded-2xl border-2 border-dashed border-[#C9A875]/50 p-10 cursor-pointer bg-[#F7F3ED]/60">
            <div className="serif text-3xl">{file ? file.name : 'Choose a selfie'}</div>
            <div className="text-sm text-[#8a8179] mt-2">JPG, PNG or WebP</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>

          <button disabled={!file} className="w-full mt-4 rounded-full bg-[#171514] disabled:opacity-30 text-white py-4">
            Demo search
          </button>

          <div className="mt-5 rounded-2xl bg-[#FBF4E6] px-4 py-3 text-xs text-[#6f5c37]">
            Demo mode does not perform face recognition or generate fake matches. The uploaded selfie stays in your browser.
          </div>
        </div>
      </div>
    </main>
  );
}