'use client'

/**
 * LynchGhostStockPanel v3 — 월가의 유령 종목 추적기 (발견 사이클 지도)
 *
 * ◆ 2026-08-02 전면 재설계(사용자 피드백: "매수 추천처럼 보이고 복잡하다")
 *   - 점수 링·게이지 카드 → **발견 사이클 지도**(유령→진주→주목→핫플→총공세 5단계에 종목 칩 배치)
 *   - 상세(커버리지·내부자·린치 한마디)는 칩 클릭 시에만
 *   - '린치 분석 제외 자산' 카드 13개 → 완전 제거(푸터 한 줄로만)
 *   - Ghost 점수는 상세에서만 작게(품질 점수로 오독 방지)
 *
 * ◆ 데이터 파이프라인(불변): GET /api/lynch/ghost-stock
 *   내부자: SEC EDGAR(US)·DART(KR) 90일 장내매수 · 커버리지: Yahoo 애널리스트 수(US)·네이버 리포트 건수(KR 3개월)
 */

import { useState, useEffect } from 'react'
import { Ghost, RefreshCw, AlertTriangle } from 'lucide-react'
import { TK } from '@/lib/theme'

// ────────────────────────────────────────────────────────────
// 타입 (API 계약 — 기존과 동일)
// ────────────────────────────────────────────────────────────
type GhostGrade = 'diamond' | 'pearl' | 'radar' | 'hotspot' | 'crowded'

interface GhostRecord {
  ticker: string; name: string; lynchType: string; market: 'US' | 'KR'
  analystCount: number; analystChange: number; instOwnership: number
  insiderBuys: number; insiderSells: number
  insiderBuyAmt: string; insiderSellAmt: string
  lastActivity: string; lastActivityDays: number
  ghostGrade: GhostGrade; ghostScore: number
  lynchVerdict: string; analystComment: string; insiderComment: string
}

interface ApiCacheRow {
  ticker: string; company_name: string; lynch_type: string; market: string
  analyst_count: number; analyst_change: number; inst_ownership: number
  insider_buy_count: number; insider_sell_count: number
  insider_buy_amt: string; insider_sell_amt: string
  last_activity: string; last_activity_days: number
  ghost_score: number; ghost_grade: string
  lynch_verdict: string; analyst_comment: string; insider_comment: string
  updated_at: string
}

interface ApiResponse {
  records: ApiCacheRow[]
  discovery?: ApiCacheRow[]
  excluded?: { ticker: string }[]
  source: string
  error?: string
}

function mapApiRow(row: ApiCacheRow): GhostRecord {
  return {
    ticker: row.ticker, name: row.company_name, lynchType: row.lynch_type || '미분류',
    market: (row.market as 'US' | 'KR') ?? 'US',
    analystCount: row.analyst_count ?? 0, analystChange: row.analyst_change ?? 0,
    instOwnership: Number(row.inst_ownership) ?? 0,
    insiderBuys: row.insider_buy_count ?? 0, insiderSells: row.insider_sell_count ?? 0,
    insiderBuyAmt: row.insider_buy_amt ?? '$0', insiderSellAmt: row.insider_sell_amt ?? '—',
    lastActivity: row.last_activity ?? '데이터 없음', lastActivityDays: row.last_activity_days ?? 0,
    ghostGrade: (row.ghost_grade as GhostGrade) ?? 'radar', ghostScore: row.ghost_score ?? 0,
    lynchVerdict: row.lynch_verdict ?? '', analystComment: row.analyst_comment ?? '', insiderComment: row.insider_comment ?? '',
  }
}

// ────────────────────────────────────────────────────────────
// 단계 메타 — 발견 사이클 5단계(왼쪽=시장이 모름 · 오른쪽=다 앎)
// ────────────────────────────────────────────────────────────
const C = {
  border: TK.sub6, textHi: TK.slate100, textMid: TK.slate400, textLow: TK.sub2,
  green: TK.green400, amber: TK.amber400, blue: TK.blue400, red: TK.red400,
}

const STAGES: { key: GhostGrade; icon: string; label: string; sub: string; color: string }[] = [
  { key: 'diamond', icon: '💎', label: '유령',   sub: '사각지대',  color: TK.amber400 },
  { key: 'pearl',   icon: '🌱', label: '진주',   sub: '소형 커버', color: TK.green400 },
  { key: 'radar',   icon: '🔭', label: '주목',   sub: '중형 커버', color: TK.blue400 },
  { key: 'hotspot', icon: '📢', label: '핫플',   sub: '고커버',    color: TK.orange400 },
  { key: 'crowded', icon: '🔒', label: '총공세', sub: '초과열',    color: TK.red400 },
]
const STAGE_META = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<GhostGrade, typeof STAGES[number]>

const covText = (r: GhostRecord) => r.market === 'KR' ? `리포트 ${r.analystCount}건(3개월)` : `애널리스트 ${r.analystCount}명`

// ────────────────────────────────────────────────────────────
// 종목 칩 · 상세 카드
// ────────────────────────────────────────────────────────────
function StockChip({ r, selected, onClick }: { r: GhostRecord; selected: boolean; onClick: () => void }) {
  const m = STAGE_META[r.ghostGrade]
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8,
      background: selected ? `${m.color}22` : TK.slate950,
      border: `1px solid ${selected ? m.color : C.border}`,
      cursor: 'pointer', fontSize: 11, color: C.textHi, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 9, color: C.textLow }}>{r.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
      {r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name}
      {r.insiderBuys > 0 && <span title={`임원 장내매수 ${r.insiderBuys}건(${r.insiderBuyAmt})`} style={{ fontSize: 10 }}>🔥</span>}
    </button>
  )
}

function DetailCard({ r, held, onClose }: { r: GhostRecord; held: boolean; onClose: () => void }) {
  const m = STAGE_META[r.ghostGrade]
  return (
    <div style={{ marginTop: 10, borderRadius: 12, background: TK.slate950, border: `1px solid ${m.color}55`, padding: '13px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13, color: C.textHi }}>{r.market === 'KR' ? '🇰🇷' : '🇺🇸'} {r.name}</b>
        <span style={{ fontSize: 10, color: C.textLow, fontFamily: 'monospace', fontWeight: 700 }}>{r.ticker}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: m.color, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '2px 8px' }}>
          {m.icon} {m.label} · {m.sub}
        </span>
        {!held && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#2dd4bf', background: 'rgba(45,212,191,0.1)', borderRadius: 5, padding: '2px 7px' }}>미보유 발굴</span>}
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.textLow, cursor: 'pointer', fontSize: 13 }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 9, fontSize: 11 }}>
        <span><span style={{ color: C.textLow }}>🏦 커버리지 </span><b style={{ color: C.textHi }}>{covText(r)}</b></span>
        <span>
          <span style={{ color: C.textLow }}>👤 내부자(90일) </span>
          <b style={{ color: r.insiderBuys > 0 ? C.green : C.textMid }}>
            {r.insiderBuys > 0 ? `장내매수 ${r.insiderBuys}건 (${r.insiderBuyAmt})` : '장내매수 없음'}
          </b>
          {r.insiderBuys > 0 && r.lastActivityDays > 0 && <span style={{ color: C.textLow }}> · {r.lastActivityDays}일 전</span>}
        </span>
        <span title="관측 점수 — 품질이 아니라 '시장이 아직 모르는 정도'(소외 40 + 내부자 40 + 기관보유 낮음 20)">
          <span style={{ color: C.textLow }}>👻 관측 점수 </span><b style={{ color: C.textMid }}>{r.ghostScore}</b>
        </span>
      </div>

      <div style={{ marginTop: 9, padding: '8px 11px', borderRadius: 8, background: `${m.color}11`, fontSize: 11, color: TK.slate300, lineHeight: 1.6 }}>
        🔭 {r.lynchVerdict.replace(/^"|"$/g, '')}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: C.textLow, lineHeight: 1.55 }}>{r.insiderComment}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 패널
// ────────────────────────────────────────────────────────────
export default function LynchGhostStockPanel() {
  const [records, setRecords] = useState<GhostRecord[]>([])
  const [discovery, setDiscovery] = useState<GhostRecord[]>([])
  const [excludedCount, setExcludedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)   // ticker
  const [lastFetch, setLastFetch] = useState('')

  const fetchData = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/lynch/ghost-stock', { cache: 'no-store' })
      const body = await res.json() as ApiResponse
      if (!res.ok) { setError(body.error ?? `API 오류 (${res.status})`); return }
      setRecords((body.records ?? []).map(mapApiRow))
      setDiscovery((body.discovery ?? []).map(mapApiRow))
      setExcludedCount((body.excluded ?? []).length)
      setLastFetch(new Date().toLocaleTimeString('ko-KR'))
    } catch (e) {
      setError('네트워크 오류: ' + (e as Error).message)
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const sel = records.find(r => r.ticker === selected) ?? discovery.find(r => r.ticker === selected) ?? null
  const selHeld = !!records.find(r => r.ticker === selected)

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더: 목적 한 줄 ── */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ghost size={18} color={C.amber} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>유령 종목 추적기 — 시장이 내 종목을 얼마나 아는가</div>
            <div style={{ fontSize: 11, color: C.textLow, marginTop: 2, lineHeight: 1.5 }}>
              <b style={{ color: C.amber }}>매수 추천이 아닙니다</b> — 종목의 &lsquo;발견 단계&rsquo;를 보는 관측 렌즈입니다.
              품질 판단은 <b style={{ color: C.textMid }}>종합 매수 판정(6축)</b>, 타이밍은 <b style={{ color: C.textMid }}>타점 신호등</b>의 몫.
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: TK.slate950, border: `1px solid ${C.border}`, color: C.textLow, fontSize: 10, cursor: 'pointer' }}>
            <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {lastFetch || '로딩'}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 20px 18px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: `1px solid ${C.red}44`, fontSize: 11, color: C.red }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {loading && !error && (
          <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 11, color: C.textLow }}>
            👻 커버리지·내부자 공시를 수집하는 중… (첫 로드는 10~20초)
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 11, color: C.textLow }}>
            자산 관리에서 개별 주식을 추가하면 발견 사이클 분석이 시작됩니다.
          </div>
        )}

        {/* ── 발견 사이클 지도 (내 보유) ── */}
        {!loading && !error && records.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.textHi, marginBottom: 8 }}>
              🗺️ 발견 사이클 지도 <span style={{ fontSize: 10, color: C.textLow, fontWeight: 600 }}>— 내 보유 {records.length}종 · 칩을 누르면 상세</span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', overflowX: 'auto', paddingBottom: 4 }}>
              {STAGES.map(st => {
                const list = records.filter(r => r.ghostGrade === st.key)
                return (
                  <div key={st.key} style={{ flex: '1 1 0', minWidth: 118, borderRadius: 10, background: TK.slate900, border: `1px solid ${list.length ? `${st.color}44` : C.border}`, padding: '9px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: st.color }}>{st.icon} {st.label} <span style={{ fontSize: 9, color: C.textLow, fontWeight: 600 }}>{st.sub}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 7 }}>
                      {list.length === 0
                        ? <span style={{ fontSize: 10, color: TK.sub6 }}>—</span>
                        : list.map(r => <StockChip key={r.ticker} r={r} selected={selected === r.ticker} onClick={() => setSelected(selected === r.ticker ? null : r.ticker)} />)}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: C.textLow }}>
              <span>← 시장이 모름 — 먼저 조사할 가치(정보 우위 여지)</span>
              <span>시장이 다 앎 — 나쁜 게 아니라 &lsquo;먼저&rsquo;의 이점이 없음 →</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 9.5, color: C.textLow }}>
              🔥 = 최근 90일 임원이 자기 돈으로 산 종목(EDGAR·DART 공시) — 린치가 가장 좋아한 신호
            </div>

            {sel && selHeld && <DetailCard r={sel} held onClose={() => setSelected(null)} />}
          </>
        )}

        {/* ── 🔍 미보유 발굴 후보 ── */}
        {!loading && !error && discovery.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.textHi }}>
              🔍 발굴 후보 <span style={{ fontSize: 10, color: C.textLow, fontWeight: 600 }}>— 중소형 위성 풀(100종) 스캔 · 내 보유 제외 · <b style={{ color: C.amber }}>매수 신호 아님, 조사 후보</b></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {discovery.map(r => {
                const m = STAGE_META[r.ghostGrade]
                return (
                  <button key={r.ticker} onClick={() => setSelected(selected === r.ticker ? null : r.ticker)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                    background: selected === r.ticker ? `${m.color}22` : TK.slate900,
                    border: `1px solid ${selected === r.ticker ? m.color : C.border}`,
                    cursor: 'pointer', fontSize: 11, color: C.textHi, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    <span style={{ color: m.color, fontSize: 10 }}>{m.icon}</span>
                    {r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name}
                    <span style={{ fontSize: 9.5, color: C.textLow, fontWeight: 600 }}>{covText(r)}</span>
                    {r.insiderBuys > 0 && <span style={{ fontSize: 10 }}>🔥</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 6, fontSize: 9.5, color: C.textLow }}>
              담기 전 반드시 종목 리서치의 <b style={{ color: C.textMid }}>종합 매수 판정(6축)</b>과 재무를 직접 확인하세요 — 소외는 &lsquo;기회 후보&rsquo;이지 &lsquo;좋은 회사&rsquo;라는 뜻이 아닙니다.
            </div>

            {sel && !selHeld && <DetailCard r={sel} held={false} onClose={() => setSelected(null)} />}
          </div>
        )}

        {/* ── 푸터 한 줄 ── */}
        {!loading && !error && (
          <div style={{ marginTop: 14, paddingTop: 9, borderTop: `1px solid ${C.border}`, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
            내부자: SEC EDGAR(US)·DART(KR) 90일 장내매수(매도 미추적) · 커버리지: Yahoo 애널리스트 수(US)·네이버 리포트 건수(KR 3개월) · 하루 1회 갱신
            {excludedCount > 0 && ` · ETF·코인·원자재 ${excludedCount}개는 기업 분석 대상이 아니라 표시하지 않습니다`}
          </div>
        )}
      </div>
    </div>
  )
}
