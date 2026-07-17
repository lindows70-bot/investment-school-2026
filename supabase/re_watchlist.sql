-- 관심 단지(부동산 워치리스트) — Supabase SQL Editor에서 1회 실행
create table if not exists public.re_watchlist (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lawd varchar(5) not null,
  apt varchar(120) not null,          -- RTMS 그룹 키('법정동 단지명')
  area int,                            -- 관심 전용면적(㎡ 반올림, null=대표 면적)
  created_at timestamptz not null default now(),
  unique (user_id, lawd, apt)
);
create index if not exists idx_re_watchlist_user on public.re_watchlist (user_id);
alter table public.re_watchlist enable row level security;
create policy "own re_watchlist select" on public.re_watchlist for select using (auth.uid() = user_id);
create policy "own re_watchlist insert" on public.re_watchlist for insert with check (auth.uid() = user_id);
create policy "own re_watchlist delete" on public.re_watchlist for delete using (auth.uid() = user_id);
