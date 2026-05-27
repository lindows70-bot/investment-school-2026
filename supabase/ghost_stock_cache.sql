-- ════════════════════════════════════════════════════════════
-- ghost_stock_cache — 유령 종목 분석 결과 캐시 테이블
-- 하루 1회 배치 갱신 전략:
--   API Route가 updated_at이 오늘인지 확인 → MISS 시 외부 API 호출 후 Upsert
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ghost_stock_cache (
  -- ── PK ──────────────────────────────────────────────────
  ticker                   TEXT PRIMARY KEY,          -- 종목 코드 (e.g. 'PLTR', '005930')

  -- ── 종목 기본 ────────────────────────────────────────────
  company_name             TEXT        NOT NULL DEFAULT '',
  lynch_type               TEXT        NOT NULL DEFAULT '',  -- 피터 린치 유형 (한국어)
  market                   TEXT        NOT NULL DEFAULT 'US', -- 'US' | 'KR'

  -- ── 기관 커버리지 (Analyst Coverage) ─────────────────────
  analyst_count            INTEGER     NOT NULL DEFAULT 0,   -- 커버하는 애널리스트 수
  analyst_change           INTEGER     NOT NULL DEFAULT 0,   -- 전분기 대비 증감
  inst_ownership           NUMERIC(5,1) NOT NULL DEFAULT 0,  -- 기관 보유 비중 (%)

  -- ── 내부자 거래 (Insider Trading, 최근 3개월) ────────────
  insider_buy_count        INTEGER     NOT NULL DEFAULT 0,
  insider_sell_count       INTEGER     NOT NULL DEFAULT 0,
  insider_buy_amt          TEXT        NOT NULL DEFAULT '$0',  -- 매수 금액 (표시용 문자열)
  insider_sell_amt         TEXT        NOT NULL DEFAULT '$0',  -- 매도 금액
  last_activity            TEXT        NOT NULL DEFAULT '',   -- 마지막 거래 설명
  last_activity_days       INTEGER     NOT NULL DEFAULT 0,    -- 마지막 거래 경과일

  -- ── Ghost Score & 등급 (연산 결과) ──────────────────────
  -- Ghost Score = 기관 소외 40pt + 내부자 매수 40pt + 기관 보유 낮음 20pt
  ghost_score              INTEGER     NOT NULL DEFAULT 0,
  ghost_grade              TEXT        NOT NULL DEFAULT 'radar',
  --   'diamond' | 'pearl' | 'radar' | 'hotspot' | 'crowded'

  -- ── 린치 AI 코멘트 ────────────────────────────────────────
  lynch_verdict            TEXT        NOT NULL DEFAULT '',
  analyst_comment          TEXT        NOT NULL DEFAULT '',
  insider_comment          TEXT        NOT NULL DEFAULT '',

  -- ── 캐시 타임스탬프 ──────────────────────────────────────
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ghost_cache_updated_at
  ON public.ghost_stock_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghost_cache_score
  ON public.ghost_stock_cache (ghost_score DESC);

CREATE INDEX IF NOT EXISTS idx_ghost_cache_grade
  ON public.ghost_stock_cache (ghost_grade);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.ghost_stock_cache ENABLE ROW LEVEL SECURITY;

-- 로그인한 모든 사용자: 읽기 허용
CREATE POLICY "authenticated_read_ghost_cache"
  ON public.ghost_stock_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- 서비스 롤(API Route)만 쓰기 허용
CREATE POLICY "service_role_write_ghost_cache"
  ON public.ghost_stock_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 코멘트 ───────────────────────────────────────────────────
COMMENT ON TABLE  public.ghost_stock_cache IS '유령 종목 추적기 — 하루 1회 배치 캐싱 (기관 커버리지 + 내부자 거래)';
COMMENT ON COLUMN public.ghost_stock_cache.ghost_score   IS 'Ghost Score: 기관 소외(40) + 내부자 매수(40) + 기관 보유 낮음(20) = 최대 100';
COMMENT ON COLUMN public.ghost_stock_cache.ghost_grade   IS 'diamond(<5 analysts+buy) | pearl(<10+buy) | radar(<20) | hotspot(<35) | crowded(35+)';
COMMENT ON COLUMN public.ghost_stock_cache.updated_at    IS '오늘 날짜 == 캐시 유효 / 이전 날짜 == 재수집 대상';
