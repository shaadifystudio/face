'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function Login() {
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await fetch('/api/studio/bootstrap', {
        method: 'POST',
        headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: data.user.user_metadata?.full_name || 'My Studio' }),
      });
      localStorage.setItem('shaadify_user', JSON.stringify({
        name: data.user.user_metadata?.full_name || 'Photographer',
        email: data.user.email || email,
      }));
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <div className="hero-photo hidden md:flex items-end p-12 text-white">
        <div>
          <div className="uppercase tracking-[.25em] text-xs text-[#E4CDA6]">Shaadify Face</div>
          <h1 className="serif text-6xl mt-3">Your wedding.<br /><i>Your moments.</i></h1>
        </div>
      </div>
      <div className="p-8 md:p-16 flex items-center">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="text-sm text-[#756e67]">← Back</Link>
          <div className="mt-12 tracking-[.22em] text-sm">SHAADIFY</div>
          <div className="tracking-[.48em] text-[8px] text-[#A69A8B]">FACE</div>
          <h2 className="serif text-5xl mt-8">Welcome back.</h2>
          <p className="mt-3 text-[#756e67]">Sign in to manage your weddings.</p>
          <div className="space-y-4 mt-8">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Work email" className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 outline-none focus:border-[#C9A875]" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" onKeyDown={e => e.key === 'Enter' && submit()} className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 outline-none focus:border-[#C9A875]" />
            {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{error}</div>}
            <button disabled={busy || !email || !password} onClick={submit} className="w-full rounded-full bg-[#171514] disabled:opacity-30 text-white py-4 font-semibold">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
          <p className="text-sm text-[#756e67] mt-5"><Link href="/forgot-password" className="underline">Forgot password?</Link></p>
          <p className="text-sm text-[#756e67] mt-3">New to Shaadify? <Link href="/signup" className="underline">Create your studio</Link></p>
        </div>
      </div>
    </main>
  );
}