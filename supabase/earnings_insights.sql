-- ════════════════════════════════════════════════════════════════════════
-- 🤖 Jarvis 어닝콜 애널리스트 — earnings_insights (게으른 캐싱 저장소)
--
--  비밀병기 4단계. 학생이 종목 상세를 열면 Jarvis가 자동 분석 → 이 테이블에 캐싱.
--  이후 동일 (ticker, quarter) 조회는 AI/스크래핑 없이 DB에서 즉시 반환.
--
--  ⚠️ 적용 방법: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 1회 실행.
--     (이 프로젝트는 psql/supabase-cli 없이 SQL Editor로 DDL을 적용하는 컨벤션)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.earnings_insights (
  ticker        text        not null,                 -- 종목 티커 (대문자 정규화)
  quarter       text        not null,                 -- 보고 분기 라벨 (예: '2026 Q1')
  summary_text  text        not null,                 -- JSON: { growthStory, managementTone, guidance }
  sentiment_score int       not null default 50,      -- 0~100 (높을수록 긍정/낙관)
  created_at    timestamptz not null default now(),   -- 분석 생성 시각
  primary key (ticker, quarter)                        -- 복합 PK (게으른 캐싱 키)
);

-- 조회 성능 (티커 단건 조회)
create index if not exists earnings_insights_ticker_idx
  on public.earnings_insights (ticker);

-- ── RLS: 인사이트는 공개 읽기 / 쓰기는 service_role만 ──────────────────────
alter table public.earnings_insights enable row level security;

-- 로그인한 모든 학생이 읽을 수 있음 (공개 인사이트)
drop policy if exists "earnings_insights_read" on public.earnings_insights;
create policy "earnings_insights_read"
  on public.earnings_insights for select
  using (true);

-- INSERT/UPDATE는 서버액션의 service_role 키로만 수행 (RLS 우회) → 별도 정책 불필요.
-- 일반 anon/authenticated 쓰기는 정책 부재로 자동 차단됨.
