import Link from 'next/link';

export default function Billing() {
  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <header className="h-20 bg-white/80 border-b border-black/5 flex items-center px-6">
        <Link href="/dashboard">← Dashboard</Link>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">Billing</p>
        <h1 className="serif text-6xl mt-2">Plans & billing.</h1>
        <div className="bg-white rounded-3xl border border-black/5 p-8 mt-10">
          <div className="text-xs uppercase tracking-widest text-[#A69A8B]">Current status</div>
          <div className="serif text-4xl mt-3">Free / development</div>
          <p className="text-sm text-[#756e67] mt-3">Payments are not connected yet. No charges are being made.</p>
        </div>
      </div>
    </main>
  );
}