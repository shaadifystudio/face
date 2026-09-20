'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function Settings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    s.auth.getUser().then(({ data }) => {
      if (!data.user) {
        location.href = '/login';
        return;
      }
      setName(data.user.user_metadata?.full_name || '');
      setEmail(data.user.email || '');
    });
  }, []);

  async function save() {
    const s = createSupabaseBrowserClient();
    const { error } = await s.auth.updateUser({ data: { full_name: name } });
    if (!error) setSaved(true);
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 bg-white/80 border-b border-black/5 flex items-center px-6">
        <Link href="/dashboard">← Dashboard</Link>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Studio settings</p>
        <h1 className="serif text-6xl mt-2">Settings.</h1>

        <div className="bg-white rounded-3xl border border-black/5 p-8 mt-10">
          <h2 className="serif text-3xl">Profile</h2>
          <label className="block text-sm mt-7">
            Name
            <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-2 rounded-xl border border-black/10 px-4 py-4" />
          </label>
          <label className="block text-sm mt-5">
            Email
            <input value={email} disabled className="w-full mt-2 rounded-xl border border-black/10 px-4 py-4 bg-[#F7F3ED]" />
          </label>
          <button onClick={save} className="mt-6 rounded-full bg-[#171514] text-white px-6 py-3">Save profile</button>
          {saved && <span className="ml-4 text-sm text-[#6f5c37]">Saved ✓</span>}
        </div>

        <div className="bg-white rounded-3xl border border-black/5 p-8 mt-5">
          <h2 className="serif text-3xl">Security</h2>
          <p className="text-sm text-[#756e67] mt-2">Use the secure email flow to reset your password.</p>
          <Link href="/forgot-password" className="inline-block mt-5 rounded-full border border-black/10 px-5 py-3 text-sm">Reset password</Link>
        </div>
      </div>
    </main>
  );
}