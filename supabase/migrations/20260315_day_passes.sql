-- Day Pass: single-session access for per-session pricing
-- Platform takes ₹100 (2hr) / ₹150 (4hr). Venue sets their price separately.

create table if not exists public.day_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null,
  amount_paise integer not null default 10000, -- ₹100 default
  payment_id uuid references public.payments(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'used', 'expired', 'cancelled')),
  access_code text not null default substr(md5(gen_random_uuid()::text), 1, 8),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz
);

-- Indexes
create index if not exists idx_day_passes_user_id on public.day_passes(user_id);
create index if not exists idx_day_passes_event_id on public.day_passes(event_id);
create index if not exists idx_day_passes_status on public.day_passes(status);
create index if not exists idx_day_passes_access_code on public.day_passes(access_code);

-- RLS
alter table public.day_passes enable row level security;

-- Users can read their own day passes
create policy "Users can read own day passes"
  on public.day_passes for select
  using (auth.uid() = user_id);

-- Users can insert their own day passes
create policy "Users can insert own day passes"
  on public.day_passes for insert
  with check (auth.uid() = user_id);

-- Service role / admin can do anything (via Edge Functions)
create policy "Service role full access to day passes"
  on public.day_passes for all
  using (auth.role() = 'service_role');

comment on table public.day_passes is 'Single-session access passes. Users pay per session without monthly subscription. Status: pending → active (on payment verify) → used (on check-in) → expired (24hr TTL).';
