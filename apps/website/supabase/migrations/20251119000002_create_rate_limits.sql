create table if not exists public.rate_limits (
  key text not null,
  count integer default 1,
  last_request timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint rate_limits_pkey primary key (key)
);

-- Enable RLS (though this table is mostly for internal use, good practice)
alter table public.rate_limits enable row level security;

-- Policies (Service role only usually, but maybe authenticated users for their own limits?)
-- For now, let's allow service role full access and maybe public insert if we do client-side checks (not recommended).
-- Better: Only server-side logic accesses this, so RLS can be restrictive or we use service role client.

create policy "Service role has full access"
  on public.rate_limits for all
  to service_role
  using (true)
  with check (true);
