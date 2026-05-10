-- ================================================================
-- 관심종목 테이블 (watchlist)
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ================================================================

create table if not exists public.watchlist (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  ticker      text        not null,
  name        text        not null,
  market      text        not null check (market in ('US','KR','CRYPTO')),
  memo        text,
  added_at    timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.watchlist enable row level security;

drop policy if exists "users_own_watchlist" on public.watchlist;
create policy "users_own_watchlist"
  on public.watchlist for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists watchlist_user_id_idx on public.watchlist(user_id);
