-- ════════════════════════════════════════════════════════════
-- stock_financial_quarters — 분기별 재무 데이터 캐시 테이블
--
-- 목적: 재고 vs 매출 데드크로스 추적 시스템
--   · 재고 증가율(inventory_yoy) > 매출 증가율(revenue_yoy) → DANGER
--   · 복합 PK: (ticker, quarter) — 한 종목·한 분기 = 1행
--   · 하루 1회 외부 API(FMP/DART) 갱신 전략
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stock_financial_quarters (

  -- ── 복합 기본키 ──────────────────────────────────────────
  ticker            TEXT        NOT NULL,   -- 종목 코드 (e.g. 'NVDA', '000660')
  quarter           TEXT        NOT NULL,   -- 분기 코드 (e.g. '25-Q1', '24-Q4')
  PRIMARY KEY (ticker, quarter),

  -- ── 종목 기본 정보 ────────────────────────────────────────
  company_name      TEXT        NOT NULL DEFAULT '',
  market            TEXT        NOT NULL DEFAULT 'US',   -- 'US' | 'KR'
  currency          TEXT        NOT NULL DEFAULT 'USD',  -- 'USD' | 'KRW'
  unit_label        TEXT        NOT NULL DEFAULT 'M$',   -- 'M$' | '억원' (표시용)

  -- ── 분기 재무 수치 ────────────────────────────────────────
  fiscal_date       DATE,                                -- 분기 종료일
  revenue           NUMERIC(20, 0) NOT NULL DEFAULT 0,  -- 매출액
  inventory         NUMERIC(20, 0) NOT NULL DEFAULT 0,  -- 재고자산

  -- ── YoY 성장률 (%) ──────────────────────────────────────
  revenue_yoy       NUMERIC(8, 2),   -- 매출 YoY % (NULL = 전년 동기 데이터 없음)
  inventory_yoy     NUMERIC(8, 2),   -- 재고 YoY %

  -- ── 데드크로스 시그널 (서버 계산 결과 캐시) ──────────────
  -- 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'
  signal            TEXT        NOT NULL DEFAULT 'UNKNOWN',
  -- inventory_yoy - revenue_yoy (양수 = 위험 방향)
  gap               NUMERIC(8, 2),

  -- ── 메타데이터 ───────────────────────────────────────────
  data_source       TEXT        NOT NULL DEFAULT 'stub', -- 'fmp' | 'dart' | 'stub'
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sfq_ticker
  ON public.stock_financial_quarters (ticker);

CREATE INDEX IF NOT EXISTS idx_sfq_signal
  ON public.stock_financial_quarters (signal, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sfq_updated
  ON public.stock_financial_quarters (updated_at DESC);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.stock_financial_quarters ENABLE ROW LEVEL SECURITY;

-- 로그인한 모든 사용자: 읽기 허용 (대시보드 데이터 조회)
CREATE POLICY "authenticated_read_financial_quarters"
  ON public.stock_financial_quarters
  FOR SELECT
  TO authenticated
  USING (true);

-- 서비스 롤(API Route)만 쓰기 허용
CREATE POLICY "service_role_write_financial_quarters"
  ON public.stock_financial_quarters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 코멘트 ───────────────────────────────────────────────────
COMMENT ON TABLE  public.stock_financial_quarters IS '분기별 재무 캐시 — 재고 vs 매출 데드크로스 추적용';
COMMENT ON COLUMN public.stock_financial_quarters.quarter      IS '분기 코드: YY-Q{1-4} 형식 (예: 25-Q1)';
COMMENT ON COLUMN public.stock_financial_quarters.revenue_yoy  IS '매출 YoY 증가율(%) — 전년 동기 대비';
COMMENT ON COLUMN public.stock_financial_quarters.inventory_yoy IS '재고 YoY 증가율(%) — 전년 동기 대비';
COMMENT ON COLUMN public.stock_financial_quarters.signal       IS 'DANGER: 재고>매출 / WARNING: 격차 5% 이내 / HEALTHY: 매출>재고+5%';
COMMENT ON COLUMN public.stock_financial_quarters.gap          IS 'inventory_yoy - revenue_yoy (양수 = 위험 방향)';
COMMENT ON COLUMN public.stock_financial_quarters.data_source  IS 'fmp(미국 FMP API) | dart(한국 DART) | stub(가상 데이터)';
