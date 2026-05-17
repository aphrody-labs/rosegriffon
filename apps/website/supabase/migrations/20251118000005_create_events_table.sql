create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  location text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;

create policy "Allow public read access to events"
  on public.events for select
  using (true);

create policy "Allow admin all access to events"
  on public.events for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
