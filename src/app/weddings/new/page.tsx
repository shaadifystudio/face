'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type UploadItem = { id: string; file: File; progress: number; status: 'waiting'|'uploading'|'uploaded'|'failed'; error?: string };

export default function NewWedding(){
  const [couple,setCouple]=useState(''); const [date,setDate]=useState(''); const [items,setItems]=useState<UploadItem[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const inputRef=useRef<HTMLInputElement>(null); const r=useRouter();
  const selectFiles=(files: FileList|null)=>{ if(!files) return; setItems(Array.from(files).filter(f=>f.type.startsWith('image/')).map(file=>({id:crypto.randomUUID(),file,progress:0,status:'waiting'}))); };
  const createAndUpload=async()=>{
    if(!couple || !items.length) return; setBusy(true); setMessage('Creating wedding…');
    try {
      const supabase=createSupabaseBrowserClient();
      const sessionResult=await supabase.auth.getSession();
      const accessToken=sessionResult.data.session?.access_token;
      if(!accessToken) throw new Error('Please sign in before uploading.');
      const create=await fetch('/api/weddings',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${accessToken}`},body:JSON.stringify({coupleName:couple,weddingDate:date})});
      const created=await create.json(); if(!create.ok) throw new Error(created.error||'Could not create wedding.');
      const weddingId=created.wedding.id;
      const chunkSize=50;
      for(let start=0; start<items.length; start+=chunkSize){
        const batch=items.slice(start,start+chunkSize);
        const prep=await fetch('/api/upload',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${accessToken}`},body:JSON.stringify({weddingId,files:batch.map(x=>({name:x.file.name,size:x.file.size,type:x.file.type}))})});
        const prepared=await prep.json(); if(!prep.ok) throw new Error(prepared.error||'Could not prepare uploads.');
        for(let i=0;i<prepared.uploads.length;i++){
          const u=prepared.uploads[i];
          const item=batch[i];
          if(!item) continue;
          setItems(prev=>prev.map(x=>x.id===item.id?{...x,status:'uploading'}:x));
          const {error}=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(u.path,u.token,item.file);
          if(error){setItems(prev=>prev.map(x=>x.id===item.id?{...x,status:'failed',error:error.message}:x)); throw error;}
          setItems(prev=>prev.map(x=>x.id===item.id?{...x,status:'uploaded',progress:100}:x));
        }
        const photoIds=prepared.uploads.map((u:{photoId:string})=>u.photoId);
        const done=await fetch('/api/upload/complete',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${accessToken}`},body:JSON.stringify({weddingId,photoIds})});
        const result=await done.json(); if(!done.ok) throw new Error(result.error||'Could not queue processing.');
      }
      setMessage('Upload complete. Your photos are safely stored. Face recognition is not connected yet, so no AI processing is running.');
      r.push(`/w/${created.wedding.slug}?weddingId=${weddingId}`);
    } catch(e){ setMessage(e instanceof Error?e.message:'Something went wrong.'); setBusy(false); }
  };
  return <main className="min-h-screen bg-[#F7F3ED]"><header className="h-20 bg-white/70 border-b border-black/5 flex items-center px-6"><Link href="/dashboard" className="text-sm text-[#756e67]">← Dashboard</Link></header><div className="max-w-3xl mx-auto px-6 py-16"><p className="text-xs uppercase tracking-[.25em] text-[#A69A8B]">New wedding</p><h1 className="serif text-6xl mt-3">Create a beautiful gallery.</h1><div className="bg-white rounded-3xl border border-black/5 p-7 md:p-10 mt-10 space-y-7"><div><label className="text-sm">Couple name</label><input value={couple} onChange={e=>setCouple(e.target.value)} placeholder="Nikhil & Simran" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-4 outline-none focus:border-[#C9A875]"/></div><div><label className="text-sm">Wedding date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-4 outline-none focus:border-[#C9A875]"/></div><div><label className="text-sm">Wedding photos</label><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>selectFiles(e.target.files)}/><button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 w-full border-2 border-dashed border-[#C9A875]/50 rounded-2xl p-10 text-center bg-[#F7F3ED]/60"><div className="serif text-3xl">Select your photos</div><div className="text-sm text-[#8a8179] mt-2">JPEG, JPG, PNG or WebP · up to 50 MB each</div></button>{items.length>0&&<div className="mt-4 text-sm text-[#756e67]">{items.length.toLocaleString()} photos selected · {items.filter(x=>x.status==='uploaded').length} uploaded</div>}</div>{message&&<div className="rounded-xl bg-[#F7F3ED] px-4 py-3 text-sm">{message}</div>}<button disabled={!couple||!items.length||busy} onClick={createAndUpload} className="w-full rounded-full bg-[#171514] disabled:opacity-30 text-white py-4 font-semibold">{busy?'Uploading & queueing AI…':'Create wedding & upload photos'}</button></div></div></main>
}