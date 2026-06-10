-- ════════════════════════════════════════════════════════════════════════
-- 🕵️ CEO의 장바구니 (Insider's Receipt) — insider_signals (게으른 캐싱 저장소)
--
--  비밀병기 5단계. 학생이 종목 상세를 열면 SEC EDGAR Form 4(내부자 공시)를
--  수집·파싱하여 최근 90일 '장내매수(코드 P)'만 추려 이 테이블에 캐싱.
--  내부자 데이터는 느리게 변하므로 24h 신선도로 재사용(게으른 캐싱).
--
--  ⚠️ 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 1회 실행.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.insider_signals (
  ticker      text        not null primary key,   -- 종목 티커 (대문자 정규화)
  cluster     boolean     not null default false,  -- 서로 다른 내부자 ≥2명 매수(고확신)
  buyer_count int         not null default 0,       -- 매수 내부자 수
  total_value numeric     not null default 0,        -- 장내매수 총액 (USD)
  payload     jsonb       not null,                  -- 전체 신호 {buys[], status, ...}
  as_of       timestamptz not null default now()     -- 수집 시각 (24h 신선도 판정)
);

-- ── RLS: 공개 읽기 / 쓰기는 service_role만 ───────────────────────────────────
alter table public.insider_signals enable row level security;

drop policy if exists "insider_signals_read" on public.insider_signals;
create policy "insider_signals_read"
  on public.insider_signals for select
  using (true);
-- INSERT/UPDATE는 서버액션의 service_role 키로만 (RLS 우회) → 별도 정책 불필요.
