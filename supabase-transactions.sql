-- ================================================================
-- 거래 내역 테이블 (transactions)
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ================================================================

create table if not exists public.transactions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  investment_id    uuid        references public.investments(id) on delete set null,
  ticker           text        not null,
  name             text        not null,
  market           text        not null check (market in ('US','KR','CRYPTO')),
  currency         text        not null check (currency in ('USD','KRW')),
  type             text        not null check (type in ('buy','sell')),
  price            numeric     not null check (price > 0),
  quantity         numeric     not null check (quantity > 0),
  total_amount     numeric     not null,          -- price × quantity
  fee              numeric     not null default 0,
  realized_pnl     numeric,                       -- 매도 시 실현손익 (null = 매수)
  avg_cost_basis   numeric,                       -- 매도 시점의 평단가 (기록용)
  memo             text,
  transaction_date date        not null,
  created_at       timestamptz not null default now()
);

-- Row Level Security
alter table public.transactions enable row level security;

drop policy if exists "users_own_transactions" on public.transactions;
create policy "users_own_transactions"
  on public.transactions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 교사는 전체 조회 가능
drop policy if exists "teacher_read_all_transactions" on public.transactions;
create policy "teacher_read_all_transactions"
  on public.transactions for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- 인덱스
create index if not exists transactions_user_id_idx  on public.transactions(user_id);
create index if not exists transactions_date_idx      on public.transactions(transaction_date desc);
create index if not exists transactions_ticker_idx    on public.transactions(ticker);
create index if not exists transactions_type_idx      on public.transactions(type);
