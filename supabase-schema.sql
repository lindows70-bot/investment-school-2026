-- ================================================
-- 투자학교 포트폴리오 Supabase 스키마
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. profiles 테이블 (auth.users 확장)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 2. holdings 테이블 (보유 종목)
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  ticker text not null,
  asset_type text not null check (asset_type in ('stock', 'crypto')),
  quantity numeric(20, 8) not null check (quantity > 0),
  purchase_price numeric(20, 4) not null check (purchase_price > 0),
  purchase_date date not null,
  current_price numeric(20, 4),
  peter_lynch_category text check (
    peter_lynch_category in (
      'slow_grower', 'stalwart', 'fast_grower',
      'cyclical', 'turnaround', 'asset_play'
    )
  ),
  created_at timestamptz not null default now()
);

alter table public.holdings enable row level security;

create policy "Users can manage own holdings"
  on public.holdings for all
  using (auth.uid() = user_id);

create policy "Admins can view all holdings"
  on public.holdings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 3. 신규 사용자 가입 시 자동으로 profile 생성하는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. 관리자 계정 설정 (가입 후 아래 쿼리로 관리자 지정)
-- update public.profiles set is_admin = true where email = 'admin@example.com';
