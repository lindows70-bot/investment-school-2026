'use client'

/**
 * LynchGhostStockPanel v4 — 🔥 내부자 매수 레이더
 *
 * ◆ 2026-08-02 재재설계(사용자: "이 화면으로 뭘 하라는 건지 모르겠다 — 명확하지 않으면 없애자")
 *   솔직한 판단: 이 화면에서 학생이 행동할 수 있는 정보는 하나 — **임원이 자기 돈으로 산 종목**.
 *   '발견 사이클' 개념은 지적으로 맞아도 할 일을 주지 못한다 → 주인공을 뒤집는다.
 *   ① 임원 매수 발생(내 보유) = 헤드라인  ② 발굴 풀의 임원 매수 = 1순위 조사 후보
 *   ③ 나머지는 전부 축소(관찰 칩) · Ghost 점수 UI 제거 · 발견 지도 제거.
 *
 * ◆ 데이터 파이프라인(불변): GET /api/lynch/ghost-stock
 *   내부자: SEC EDGAR(US)·DART(KR) 90일 장내매수(코드 P — 스톡옵션·보상 지급 제외)
 *   커버리지: Yahoo 애널리스트 수(US)·네이버 리포트 건수(KR 3개월) — '얼마나 알려진 종목인가' 맥락
 */

import { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { TK } from '@/lib/theme'

// ── 타입 (API 계약 — 기존과 동일) ──────────────────────────────
type GhostGrade = 'diamond' | 'pearl' | 'radar' | 'hotspot' | 'crowded'

interface GhostRecord {
  ticker: string; name: string; market: 'US' | 'KR'
  analystCount: number
  insiderBuys: number; insiderBuyAmt: string
  lastActivity: string; lastActivityDays: number
  ghostGrade: GhostGrade
  lynchVerdict: string; insiderComment: string
}

interface ApiCacheRow {
  ticker: string; company_name: string; market: string
  analyst_count: number; insider_buy_count: number; insider_buy_amt: string
  last_activity: string; last_activity_days: number
  ghost_grade: string; lynch_verdict: string; insider_comment: string
}

interface ApiResponse {
  records: ApiCacheRow[]
  discovery?: ApiCacheRow[]
  excluded?: { ticker: string }[]
  error?: string
}

function mapApiRow(row: ApiCacheRow): GhostRecord {
  return {
    ticker: row.ticker, name: row.company_name,
    market: (row.market as 'US' | 'KR') ?? 'US',
    analystCount: row.analyst_count ?? 0,
    insiderBuys: row.insider_buy_count ?? 0, insiderBuyAmt: row.insider_buy_amt ?? '',
    lastActivity: row.last_activity ?? '', lastActivityDays: row.last_activity_days ?? 0,
    ghostGrade: (row.ghost_grade as GhostGrade) ?? 'radar',
    lynchVerdict: row.lynch_verdict ?? '', insiderComment: row.insider_comment ?? '',
  }
}

const C = {
  border: TK.sub6, textHi: TK.slate100, textMid: TK.slate400, textLow: TK.sub2,
  green: TK.green400, amber: TK.amber400, red: TK.red400,
}

const covText = (r: GhostRecord) => r.market === 'KR' ? `리포트 ${r.analystCount}건` : `애널리스트 ${r.analystCount}명`
/** 커버리지 맥락을 학생 언어로 — 같은 임원 매수라도 덜 알려진 종목일수록 신호 가치가 크다(린치) */
const knownTag = (g: GhostGrade): { txt: string; color: string } =>
  g === 'diamond' || g === 'pearl' ? { txt: '아직 덜 알려진 종목 — 신호 가치 ↑', color: TK.green400 }
  : g === 'radar' ? { txt: '중간쯤 알려진 종목', color: TK.blue400 }
  : { txt: '이미 다 아는 종목 — 참고만', color: TK.sub2 }

// ── 🔥 임원 매수 히어로 행 ────────────────────────────────────
function BuyRow({ r, held }: { r: GhostRecord; held: boolean }) {
  const tag = knownTag(r.ghostGrade)
  const cluster = r.lastActivity.includes('클러스터') || r.lastActivity.includes('고확신')
  return (
    <div style={{ borderRadius: 12, background: TK.slate950, border: `1px solid ${C.amber}44`, padding: '12px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15 }}>🔥</span>
        <b style={{ fontSize: 13.5, color: C.textHi }}>{r.market === 'KR' ? '🇰🇷' : '🇺🇸'} {r.name}</b>
        <span style={{ fontSize: 10, color: C.textLow, fontFamily: 'monospace', fontWeight: 700 }}>{r.ticker}</span>
        {held
          ? <span style={{ fontSize: 9.5, fontWeight: 700, color: TK.purple400, background: 'rgba(192,132,252,0.1)', borderRadius: 5, padding: '2px 7px' }}>보유중</span>
          : <span style={{ fontSize: 9.5, fontWeight: 700, color: '#2dd4bf', background: 'rgba(45,212,191,0.1)', borderRadius: 5, padding: '2px 7px' }}>미보유 발굴</span>}
        {cluster && (
          <span title="서로 다른 내부자 2명 이상이 각자 자기 돈으로 매수 — 한 명의 우연이 아니라는 뜻(고확신 신호)"
            style={{ fontSize: 9.5, fontWeight: 800, color: C.amber, border: `1px solid ${C.amber}55`, borderRadius: 5, padding: '2px 7px' }}>
            👥 2명 이상 매수 · 고확신
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textLow }}>
          {r.lastActivityDays > 0 ? `${r.lastActivityDays}일 전 공시` : ''}
        </span>
      </div>

      <div style={{ marginTop: 7, fontSize: 12.5, color: TK.slate200, lineHeight: 1.6 }}>
        임원이 자기 돈 <b style={{ color: C.amber, fontSize: 13.5 }}>{r.insiderBuyAmt}</b>으로
        자사주를 <b style={{ color: C.textHi }}>{r.insiderBuys}건</b> 사들였습니다(최근 90일 공시 기준).
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 7, fontSize: 10.5 }}>
        <span style={{ color: tag.color, fontWeight: 700 }}>🏦 {covText(r)} — {tag.txt}</span>
      </div>

      <div style={{ marginTop: 7, fontSize: 10.5, color: C.textLow, lineHeight: 1.55 }}>
        → {held
          ? '보유 판단에 긍정 참고 신호입니다. 추가 매수까지 가려면 종합 매수 판정(6축)과 타점 신호등을 먼저 확인하세요.'
          : '린치식 1순위 조사 후보(소외 + 내부자 매수). 담기 전 반드시 재무·종합 매수 판정(6축)을 직접 확인하세요.'}
      </div>
    </div>
  )
}

// ── 관찰 칩(임원 매수 없는 종목 — 축소 표시) ───────────────────
function QuietChip({ r, selected, onClick }: { r: GhostRecord; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8,
      background: selected ? TK.slate900 : 'transparent',
      border: `1px solid ${selected ? C.textLow : C.border}`,
      cursor: 'pointer', fontSize: 10.5, color: C.textMid, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {r.market === 'KR' ? '🇰🇷' : '🇺🇸'} {r.name.length > 15 ? r.name.slice(0, 14) + '…' : r.name}
      <span style={{ fontSize: 9, color: C.textLow }}>{covText(r)}</span>
    </button>
  )
}

// ── 메인 패널 ────────────────────────────────────────────────
export default function LynchGhostStockPanel() {
  const [records, setRecords] = useState<GhostRecord[]>([])
  const [discovery, setDiscovery] = useState<GhostRecord[]>([])
  const [excludedCount, setExcludedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
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

  // 🔥 임원 매수 발생 vs 조용한 종목 분리 — 매수 발생이 이 화면의 전부
  const heldBuys = records.filter(r => r.insiderBuys > 0).sort((a, b) => a.lastActivityDays - b.lastActivityDays)
  const heldQuiet = records.filter(r => r.insiderBuys === 0).sort((a, b) => a.analystCount - b.analystCount)
  const discBuys = discovery.filter(r => r.insiderBuys > 0).sort((a, b) => a.lastActivityDays - b.lastActivityDays)
  const discQuiet = discovery.filter(r => r.insiderBuys === 0).sort((a, b) => a.analystCount - b.analystCount)
  const sel = [...records, ...discovery].find(r => r.ticker === selected) ?? null

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 ── */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>
            🔥
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>내부자 매수 레이더 — 임원이 &lsquo;자기 돈&rsquo;으로 산 종목</div>
            <div style={{ fontSize: 11, color: C.textLow, marginTop: 2, lineHeight: 1.5 }}>
              &ldquo;내부자가 파는 이유는 수만 가지지만, <b style={{ color: TK.slate300 }}>사는 이유는 단 하나 — 오를 것 같아서</b>&rdquo; (피터 린치) ·
              SEC·DART 공시의 <b style={{ color: TK.slate300 }}>장내매수만</b> 집계(스톡옵션·보상 지급 제외) · <b style={{ color: C.amber }}>매수 추천 아님</b>
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
            🔥 SEC·DART 내부자 공시를 수집하는 중… (첫 로드는 10~20초)
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── ① 내 보유 — 임원 매수 발생 ── */}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.textHi, marginBottom: 8 }}>
              ① 내 보유 종목 중 임원 매수 발생
              {heldBuys.length > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.amber, fontWeight: 800 }}>{heldBuys.length}종목</span>}
            </div>
            {heldBuys.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {heldBuys.map(r => <BuyRow key={r.ticker} r={r} held />)}
              </div>
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: TK.slate900, fontSize: 11, color: C.textLow }}>
                최근 90일, 내 보유 종목에 임원 장내매수 공시가 없습니다.
              </div>
            )}

            {/* ── ② 발굴 — 미보유 중 임원 매수 ── */}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.textHi, margin: '18px 0 8px' }}>
              ② 발굴 — 미보유 중소형에서 임원 매수 발생
              <span style={{ marginLeft: 6, fontSize: 10, color: C.textLow, fontWeight: 600 }}>(위성 풀 100종 스캔 · 소외 + 내부자 매수 = 린치식 1순위 조사 조합)</span>
            </div>
            {discBuys.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {discBuys.map(r => <BuyRow key={r.ticker} r={r} held={false} />)}
              </div>
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: TK.slate900, fontSize: 11, color: C.textLow, lineHeight: 1.6 }}>
                지금 시장에선 발굴 풀(중소형 100종)에도 임원 매수가 없습니다 — <b style={{ color: TK.slate300 }}>하락장엔 임원들도 지갑을 닫습니다. 그것 자체가 정보입니다.</b>
                임원 매수가 다시 나타나면 여기에 자동으로 뜹니다(하루 1회 갱신).
              </div>
            )}

            {/* ── ③ 조용한 종목(임원 매수 없음) — 축소 관찰 칩 ── */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
                ③ 임원 매수 없는 종목 <span style={{ fontSize: 9.5, color: C.textLow, fontWeight: 600 }}>— 할 일 없음 · 참고로 &lsquo;얼마나 알려진 종목인가&rsquo;만 표시(칩 클릭 시 한 줄 해설)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {heldQuiet.map(r => <QuietChip key={r.ticker} r={r} selected={selected === r.ticker} onClick={() => setSelected(selected === r.ticker ? null : r.ticker)} />)}
                {discQuiet.map(r => <QuietChip key={`d-${r.ticker}`} r={r} selected={selected === r.ticker} onClick={() => setSelected(selected === r.ticker ? null : r.ticker)} />)}
              </div>
              {sel && sel.insiderBuys === 0 && (
                <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 9, background: TK.slate950, border: `1px solid ${C.border}`, fontSize: 10.5, color: C.textMid, lineHeight: 1.6 }}>
                  <b style={{ color: C.textHi }}>{sel.market === 'KR' ? '🇰🇷' : '🇺🇸'} {sel.name}</b>
                  <span style={{ color: C.textLow }}> · {covText(sel)} · {knownTag(sel.ghostGrade).txt}</span>
                  <div style={{ marginTop: 4, color: C.textLow }}>🔭 {sel.lynchVerdict.replace(/^"|"$/g, '')}</div>
                </div>
              )}
            </div>

            {/* ── 푸터 ── */}
            <div style={{ marginTop: 14, paddingTop: 9, borderTop: `1px solid ${C.border}`, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
              내부자: SEC EDGAR(US)·DART(KR) 90일 장내매수(매도 미추적) · 커버리지: Yahoo 애널리스트 수(US)·네이버 리포트 건수(KR 3개월) · 하루 1회 갱신
              {excludedCount > 0 && ` · ETF·코인·원자재 ${excludedCount}개는 기업 분석 대상이 아니라 표시하지 않습니다`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
