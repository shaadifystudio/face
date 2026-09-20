create extension if not exists pgcrypto;

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  slug text not null unique,
  couple_name text not null,
  wedding_date date,
  status text not null default 'created' check (status in ('created','uploading','processing','ready','failed')),
  photo_count integer not null default 0,
  face_count integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  storage_path text not null,
  original_name text,
  bytes bigint,
  mime_type text,
  status text not null default 'queued' check (status in ('queued','processing','indexed','failed')),
  created_at timestamptz not null default now()
);
create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  provider_face_id text,
  bbox jsonb,
  embedding jsonb,
  created_at timestamptz not null default now()
);
create index if not exists photos_wedding_idx on public.photos(wedding_id);
create index if not exists faces_wedding_idx on public.face_embeddings(wedding_id);
insert into storage.buckets (id, name, public) values ('wedding-photos', 'wedding-photos', false) on conflict (id) do nothing;
alter table public.studios enable row level security;
alter table public.weddings enable row level security;
alter table public.photos enable row level security;
alter table public.face_embeddings enable row level security;
create policy "studio owners read own studios" on public.studios for select using (owner_id = auth.uid());
create policy "studio owners create studios" on public.studios for insert with check (owner_id = auth.uid());
create policy "studio owners manage weddings" on public.weddings for all using (studio_id in (select id from public.studios where owner_id = auth.uid())) with check (studio_id in (select id from public.studios where owner_id = auth.uid()));
-- Biometric mappings remain server-only; no browser policy is granted.