-- 💰 현금 잔고(예수금·CMA·파킹통장) — Supabase SQL Editor에서 1회 실행
--    앱이 알아낼 원천이 없는 유일한 자산이라 학생이 직접 입력(Zero-Input 원칙의 명시적 예외).
--    사용자당 1행(upsert) · 통화별 금액 · RLS 본인만.
create table if not exists public.user_cash (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  krw         numeric(18,2) not null default 0,   -- 원화 예수금·CMA·파킹통장 합계
  usd         numeric(18,2) not null default 0,   -- 달러 예수금 합계
  memo        varchar(120),                        -- 선택 메모(예: "증권사 예수금+파킹")
  updated_at  timestamptz not null default now()
);
alter table public.user_cash enable row level security;
create policy "own cash select" on public.user_cash for select using (auth.uid() = user_id);
create policy "own cash insert" on public.user_cash for insert with check (auth.uid() = user_id);
create policy "own cash update" on public.user_cash for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cash delete" on public.user_cash for delete using (auth.uid() = user_id);
