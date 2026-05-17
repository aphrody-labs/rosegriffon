create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.settings enable row level security;

create policy "Allow public read access to settings"
  on public.settings for select
  using (true);

create policy "Allow admin update access to settings"
  on public.settings for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create table if not exists public.email_templates (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  subject text not null,
  body_html text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.email_templates enable row level security;

create policy "Allow admin all access to email_templates"
  on public.email_templates for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
