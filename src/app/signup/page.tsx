'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      if (!data.session) {
        setError('Account created. Check your email to confirm the account, then sign in.');
        setBusy(false);
        return;
      }

      await fetch('/api/studio/bootstrap', {
        method: 'POST',
        headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: name || 'My Studio' }),
      });
      localStorage.setItem('shaadify_user', JSON.stringify({
        name: name || 'Photographer',
        email,
      }));
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <div className="hero-photo hidden md:flex items-end p-12 text-white">
        <div>
          <div className="uppercase tracking-[.25em] text-xs text-[#E4CDA6]">Shaadify Face</div>
          <h1 className="serif text-6xl mt-3">Beautiful delivery,<br /><i>without the work.</i></h1>
        </div>
      </div>
      <div className="p-8 md:p-16 flex items-center">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="text-sm text-[#756e67]">← Back</Link>
          <div className="mt-12">
            <div className="tracking-[.22em] text-sm">SHAADIFY</div>
            <div className="tracking-[.48em] text-[8px] text-[#A69A8B]">FACE</div>
            <h2 className="serif text-5xl mt-8">Create your studio.</h2>
            <p className="mt-3 text-[#756e67]">Your first wedding is just a few clicks away.</p>
            <div className="space-y-4 mt-8">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 outline-none focus:border-[#C9A875]" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Work email" type="email" className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 outline-none focus:border-[#C9A875]" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (8+ characters)" type="password" className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 outline-none focus:border-[#C9A875]" />
              {error && <div className="text-sm text-[#6f5c37] bg-[#FBF4E6] rounded-xl px-4 py-3">{error}</div>}
              <button disabled={busy || !email || password.length < 8} onClick={submit} className="w-full rounded-full bg-[#171514] disabled:opacity-30 text-white py-4 font-semibold">
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </div>
            <p className="text-sm text-[#756e67] mt-6">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>
            <p className="text-xs text-[#8a8179] mt-5">By continuing you agree to the Shaadify Face terms and privacy policy.</p>
          </div>
        </div>
      </div>
    </main>
  );
}