-- Create profiles table for nudio usage tracking
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'free',
  credits_balance integer not null default 0,
  free_credits_used integer not null default 0,
  free_period_start date not null default (date_trunc('month', now())::date),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_email on public.profiles(email);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();
