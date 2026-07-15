'use client'

/**
 * 🏫 SchoolIndexDashboard — 투자학교 전용 13F 인덱스 (School Insider Flow) · 2단계 UI
 *
 * 새벽 Cron(/api/cron/school-index)이 적재한 두 스냅샷 테이블의 '최신 base_date'를 읽어 3대 위젯으로:
 *  ① 학교 자산배분 파이(섹터) ② Top Picks 랭킹 테이블 ③ 스마트 머니 흐름(매집/축소)
 *
 * RLS("authenticated read")로 로그인 학생 모두 조회. 로딩=스켈레톤 / 빈데이터=폴백 / 에러=graceful.
 * 다크 테마(C 토큰) · Recharts PieChart · 모든 데이터 TS 인터페이스.
 */

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TK } from '@/lib/theme'

// ── 데이터 타입 ───────────────────────────────────────────────────────────────
interface StockSnapshot {
  ticker:        string
  stock_name:    string | null
  gics_sector:   string | null
  avg_weight:    number
  student_count: number
  weight_change: number
}
interface SectorSnapshot {
  gics_sector: string
  avg_weight:  number
}
interface PieDatum { name: string; value: number; color: string; residual?: boolean }

const C = {
  card: TK.bg7, card2: TK.bg5, border: TK.line1,
  gold: TK.amber500, green: TK.green400, red: TK.red400, blue: TK.blue400, cyan: TK.cyan400, purple: TK.violet400,
  text: TK.slate100, textSub: TK.slate400, textLow: TK.sub3,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const SECTOR_COLORS = [TK.cyan400, TK.blue400, TK.violet400, TK.green400, TK.amber500, TK.pink400, TK.orange400, TK.emerald400, TK.indigo400, TK.red400]

// 한국식 등락 색: 상승=빨강▲ / 하락=파랑▼
const upColor = TK.red400, downColor = TK.blue400
const fmtChg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

export default function SchoolIndexDashboard() {
  const [stocks, setStocks] = useState<StockSnapshot[] | null>(null)
  const [sectors, setSectors] = useState<SectorSnapshot[] | null>(null)
  const [baseDate, setBaseDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // 서비스롤 API로 서빙(RLS 무관) — 익명 집계 데이터
        const r = await fetch('/api/school-index', { cache: 'no-store' })
        const j = await r.json() as { baseDate: string | null; stocks: StockSnapshot[]; sectors: SectorSnapshot[] }
        if (!alive) return
        setBaseDate(j.baseDate ?? '')
        setStocks(j.stocks ?? [])
        setSectors(j.sectors ?? [])
      } catch { if (alive) { setStocks([]); setSectors([]) } }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const Card = (child: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontFamily: FONT, ...style }}>{child}</div>
  )
  const Title = (emoji: string, title: string, sub?: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>{title}</span>
      {sub && <span style={{ fontSize: 10.5, color: C.textLow }}>{sub}</span>}
    </div>
  )

  // ── 로딩 스켈레톤 ──
  if (loading) {
    const sk = (h: number) => <div style={{ height: h, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${C.border}55, transparent)`, animation: 'siShimmer 1.3s infinite' }} />
    </div>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <style>{`@keyframes siShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16 }}>{sk(300)}{sk(300)}</div>
        {sk(140)}
      </div>
    )
  }

  // ── 폴백(빈 데이터) ──
  const hasData = (stocks && stocks.length > 0) || (sectors && sectors.length > 0)
  if (!hasData) {
    return Card(
      <div style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 38 }}>🏫</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>아직 집계된 인덱스 데이터가 없습니다</div>
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, maxWidth: 460 }}>
          투자학교 13F 인덱스는 <b>매일 새벽 학생들의 보유 종목을 동일가중으로 집계</b>해 만들어집니다. 집계가 한 번 실행되면 학교의 집단지성 포트폴리오가 여기에 나타납니다.
        </div>
      </div>,
      { border: `1px dashed ${C.border}` }
    )
  }

  // ── 파이 데이터 (섹터 + 비주식 잔여) ──
  const secList = [...(sectors ?? [])].sort((a, b) => b.avg_weight - a.avg_weight)
  const secSum = secList.reduce((s, r) => s + r.avg_weight, 0)
  const pieData: PieDatum[] = secList.map((r, i) => ({ name: r.gics_sector === 'ETC' || r.gics_sector === '기타' ? '기타' : r.gics_sector, value: r.avg_weight, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
  const residual = Math.round((100 - secSum) * 100) / 100
  if (residual > 0.5) pieData.push({ name: '현금성·ETF·코인 등', value: residual, color: C.textLow, residual: true })

  // ── Top Picks (avg_weight 내림차순) — ETC는 순위에서 제외하고 맨 아래 배치 ──
  const top = [...(stocks ?? [])].sort((a, b) => b.avg_weight - a.avg_weight)
  const realPicks = top.filter(s => s.ticker !== 'ETC')
  const etcRow = top.find(s => s.ticker === 'ETC')
  const orderedPicks = etcRow ? [...realPicks, etcRow] : realPicks

  // ── 스마트 머니 흐름 (ETC 제외, weight_change 기준) ──
  const movable = (stocks ?? []).filter(s => s.ticker !== 'ETC')
  const accumulate = [...movable].filter(s => s.weight_change > 0).sort((a, b) => b.weight_change - a.weight_change).slice(0, 2)
  const reduce_ = [...movable].filter(s => s.weight_change < 0).sort((a, b) => a.weight_change - b.weight_change).slice(0, 2)
  const noFlow = accumulate.length === 0 && reduce_.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', borderRadius: 14, background: `linear-gradient(135deg,${TK.bg0},${TK.bg5})`, border: `1px solid ${C.cyan}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🏫</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>투자학교 13F 인덱스</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>School Insider Flow</span>
          {baseDate && <span style={{ fontSize: 11, color: C.textLow, marginLeft: 'auto' }}>· {baseDate} 기준</span>}
        </div>
        <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 5 }}>학생 전원의 집단지성을 <b>동일가중</b>으로 결합한 익명 인덱스 — 자산가 왜곡 없이 &lsquo;학교가 진짜 믿는 종목&rsquo;을 보여줍니다.</div>
      </div>

      {/* 위젯 1·2 (2단) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 16 }} className="si-grid">
        {/* 위젯 1: 섹터 파이 */}
        {Card(<>
          {Title('🥧', '학교 자산배분 현황', '섹터별 평균 비중')}
          <div style={{ height: 252 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={92} paddingAngle={1.5} stroke={TK.bg0} strokeWidth={1.5} isAnimationActive={false}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: TK.gray800, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#e5e7eb' }} labelStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((v: any, n: any) => [`${Number(v).toFixed(2)}%`, n]) as any}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* 범례 (잔여 슬라이스 포함 전체) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
            {pieData.map((d, i) => (
              <span key={i} style={{ fontSize: 10.5, color: C.textSub, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                {d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name} <b style={{ color: C.text, fontFamily: 'monospace' }}>{d.value.toFixed(1)}%</b>
              </span>
            ))}
          </div>
        </>)}

        {/* 위젯 2: Top Picks 테이블 */}
        {Card(<>
          {Title('🏆', '투자학교 Top Picks', `공동보유 ${top.filter(s => s.ticker !== 'ETC').length}종목 · 동일가중 랭킹`)}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 380 }}>
              <thead>
                <tr style={{ color: C.textLow, fontSize: 10.5 }}>
                  <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 4px 8px', width: 28 }}>#</th>
                  <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 4px 8px' }}>종목</th>
                  <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 4px 8px' }}>학교 평균비중</th>
                  <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 4px 8px' }}>보유</th>
                  <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 4px 8px' }}>변동</th>
                </tr>
              </thead>
              <tbody>
                {orderedPicks.map((s) => {
                  const isEtc = s.ticker === 'ETC'
                  const rank = isEtc ? 0 : realPicks.indexOf(s) + 1
                  const chg = s.weight_change
                  const chgColor = chg > 0 ? upColor : chg < 0 ? downColor : C.textLow
                  return (
                    <tr key={s.ticker} style={{ borderTop: `1px solid ${C.border}`, opacity: isEtc ? 0.72 : 1 }}>
                      <td style={{ textAlign: 'left', color: rank > 0 && rank <= 3 ? C.gold : C.textLow, padding: '9px 4px', fontWeight: 800, fontFamily: 'monospace' }}>{isEtc ? '—' : rank}</td>
                      <td style={{ textAlign: 'left', padding: '9px 4px' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: isEtc ? C.textSub : C.text }}>{(s.stock_name || s.ticker).slice(0, 14)}</span>
                        {!isEtc && <span style={{ fontSize: 9.5, color: C.textLow, marginLeft: 5, fontFamily: 'monospace' }}>{s.ticker}</span>}
                      </td>
                      <td style={{ textAlign: 'right', padding: '9px 4px', fontFamily: 'monospace', fontWeight: 800, color: s.avg_weight >= 10 ? C.cyan : C.text }}>{s.avg_weight.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', padding: '9px 4px', fontFamily: 'monospace', color: C.textSub }}>{s.student_count}명</td>
                      <td style={{ textAlign: 'right', padding: '9px 4px', fontFamily: 'monospace', fontWeight: 700, color: chgColor }}>
                        {chg === 0 ? '—' : `${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {/* 위젯 3: 스마트 머니 흐름 */}
      {Card(<>
        {Title('💸', '이번 주 스마트 머니 흐름', '비중 변동 상위 — 학교가 모으거나 줄인 종목')}
        {noFlow ? (
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.65, padding: '6px 2px' }}>
            📈 전일/전주 대비 변동은 스냅샷이 2일 이상 쌓이면 나타납니다. 오늘은 첫 기준선이 적립된 상태예요.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="si-flow">
            {/* 매집 */}
            <div style={{ padding: '12px 14px', borderRadius: 12, background: `${upColor}0d`, border: `1px solid ${upColor}33` }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: upColor, marginBottom: 9 }}>🔺 매집 (비중 확대)</div>
              {accumulate.length === 0 ? <div style={{ fontSize: 11, color: C.textLow }}>—</div> : accumulate.map(s => (
                <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{(s.stock_name || s.ticker).slice(0, 12)} <span style={{ fontSize: 9.5, color: C.textLow }}>{s.ticker}</span></span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: upColor }}>▲ {fmtChg(s.weight_change)}%p</span>
                </div>
              ))}
            </div>
            {/* 축소 */}
            <div style={{ padding: '12px 14px', borderRadius: 12, background: `${downColor}0d`, border: `1px solid ${downColor}33` }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: downColor, marginBottom: 9 }}>🔻 축소 (비중 감소)</div>
              {reduce_.length === 0 ? <div style={{ fontSize: 11, color: C.textLow }}>—</div> : reduce_.map(s => (
                <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{(s.stock_name || s.ticker).slice(0, 12)} <span style={{ fontSize: 9.5, color: C.textLow }}>{s.ticker}</span></span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: downColor }}>▼ {fmtChg(s.weight_change)}%p</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}

      <div style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6, padding: '0 4px' }}>
        🏫 동일가중(개인별 포트 비중 평균) · 2명 이상 공동보유만 노출(단독보유는 ETC로 익명화) · 매일 새벽 자동 집계 · 교육용 참고이며 투자 추천이 아닙니다.
      </div>

      <style>{`@media(max-width:760px){.si-grid{grid-template-columns:1fr!important}.si-flow{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
