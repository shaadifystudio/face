'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function submit() {
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError('');
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 700);
  }

  if (!ready) return <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center text-[#756e67]">Checking reset link…</main>;

  return (
    <main className="min-h-screen bg-[#F7F3ED] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-black/5 p-8 md:p-10">
        <Link href="/login" className="text-sm text-[#756e67]">← Sign in</Link>
        <div className="tracking-[.22em] text-sm mt-10">SHAADIFY <span className="text-[#A69A8B]">FACE</span></div>
        <h1 className="serif text-5xl mt-5">New password.</h1>
        <p className="text-sm text-[#756e67] mt-3">Choose a new password for your studio account.</p>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="New password" className="w-full rounded-xl border border-black/10 px-4 py-4 mt-7 outline-none focus:border-[#C9A875]" />
        <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" placeholder="Confirm password" className="w-full rounded-xl border border-black/10 px-4 py-4 mt-3 outline-none focus:border-[#C9A875]" />
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 mt-4">{error}</div>}
        {done && <div className="text-sm text-[#6f5c37] bg-[#FBF4E6] rounded-xl px-4 py-3 mt-4">Password updated. Taking you to the dashboard…</div>}
        <button disabled={!ready || !password || !confirm || done} onClick={submit} className="w-full rounded-full bg-[#171514] disabled:opacity-30 text-white py-4 mt-4">Update password</button>
      </div>
    </main>
  );
}