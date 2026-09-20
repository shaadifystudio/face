'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setMessage('If an account exists for this email, you will receive a password reset link.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-black/5 p-8 md:p-10">
        <Link href="/login" className="text-sm text-[#756e67]">← Back to sign in</Link>
        <div className="tracking-[.22em] text-sm mt-10">SHAADIFY <span className="text-[#A69A8B]">FACE</span></div>
        <h1 className="serif text-5xl mt-5">Reset password.</h1>
        <p className="text-sm text-[#756e67] mt-3">Enter your studio email and we’ll send you a secure reset link.</p>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Work email" className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 mt-7 outline-none focus:border-[#C9A875]" />
        {message && <div className="text-sm text-[#6f5c37] bg-[#FBF4E6] rounded-xl px-4 py-3 mt-4">{message}</div>}
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 mt-4">{error}</div>}
        <button disabled={busy || !email} onClick={submit} className="w-full rounded-full bg-[#171514] disabled:opacity-30 text-white py-4 mt-4">
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </div>
    </main>
  );
}