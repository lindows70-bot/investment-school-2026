'use client'
// 🪙 코인 랩 — 비트코인 독립 분석(사이클·심리·온체인·유동성 + 김치프리미엄 + 국면×리스크 처방)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts'
import type { CoinLabResult } from '@/app/api/coin-lab/route'
import AltcoinNetworkChart, { SupplyBar } from '@/app/components/AltcoinNetworkChart'
import DcaSimulator from '@/app/components/DcaSimulator'
import RegulatoryRadar from '@/app/components/RegulatoryRadar'
import BtcEtfFlows from '@/app/components/BtcEtfFlows'
import StablecoinRadar from '@/app/components/StablecoinRadar'
import AltSeasonIndex from '@/app/components/AltSeasonIndex'
import CryptoStocksPanel from '@/app/components/CryptoStocksPanel'
import BtcRainbowChart from '@/app/components/BtcRainbowChart'
import BtcCycleNavigator from '@/app/components/BtcCycleNavigator'
import CryptoFundingRadar from '@/app/components/CryptoFundingRadar'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const fmtUsd = (n: number | null) => n == null ? '—' : `$${Math.round(n).toLocaleString()}`
const fmtKrw = (n: number | null) => n == null ? '—' : `₩${Math.round(n).toLocaleString()}`

// 공포·탐욕 색
const fngColor = (v: number | null) => v == null ? TK.slate400 : v <= 25 ? TK.green500 : v <= 45 ? TK.lime400 : v <= 55 ? TK.amber400 : v <= 75 ? TK.orange400 : TK.red500
const fngKo = (v: number | null) => v == null ? '—' : v <= 25 ? '극공포' : v <= 45 ? '공포' : v <= 55 ? '중립' : v <= 75 ? '탐욕' : '극탐욕'

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 360px', minWidth: 300, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>{title}</span>
        {sub && <span style={{ color: TK.sub, fontSize: 10.5 }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

// 200주 이동평균(약 4년) — 역사적 강력 지지선. ⚠️ longChart 포인트는 실측 격주(14일) 간격이라
// 200주=100포인트. 간격을 자동 감지해 200주(1400일) 윈도우 포인트 수를 산출(주봉/격주 어느 쪽이 와도 정확).
function withMa200(points: { date: string; price: number }[]): { date: string; price: number; ma200: number | null }[] {
  const n = points.length
  if (n < 4) return points.map(p => ({ ...p, ma200: null }))
  const deltas: number[] = []
  for (let i = 1; i < n; i++) deltas.push((new Date(points[i].date).getTime() - new Date(points[i - 1].date).getTime()) / 86_400_000)
  deltas.sort((a, b) => a - b)
  const med = deltas[Math.floor(deltas.length / 2)] || 7
  const win = Math.max(2, Math.round(1400 / med))   // 200주 = 1400일
  let sum = 0
  // 초기 200주 미만 구간은 '있는 데이터만큼 평균'(expanding) → 선이 차트 처음부터 그려짐.
  // 200주가 쌓이면 정식 200주 고정 윈도우로 수렴(Yahoo BTC가 2014~라 그 이전은 원천 불가)
  return points.map((p, i) => {
    sum += p.price
    if (i >= win) sum -= points[i - win].price
    const count = Math.min(i + 1, win)
    return { ...p, ma200: Math.round(sum / count) }
  })
}

export default function CoinLab({ myCryptoPct }: { myCryptoPct?: number }) {
  const [d, setD] = useState<CoinLabResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'btc' | 'alt' | 'stable' | 'stocks'>('btc')   // 비트코인 ↔ 알트코인 ↔ 스테이블코인 ↔ 코인관련주식
  const [eduOpen, setEduOpen] = useState(false)            // 🎓 반감기란? 교육 아코디언

  useEffect(() => {
    let alive = true
    fetch('/api/coin-lab', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // 사이드바 딥링크(?cv=btc|alt|stable|stocks)로 초기 뷰 진입 — 암호화폐 하위 4메뉴
  useEffect(() => {
    const cv = new URLSearchParams(window.location.search).get('cv')
    if (cv === 'btc' || cv === 'alt' || cv === 'stable' || cv === 'stocks') setView(cv)
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub, fontSize: 12 }}>🪙 코인 랩 — 사이클·심리·온체인·유동성 데이터를 모으는 중…</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub, fontSize: 12 }}>코인 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>

  const toneColor = d.prescription.tone === 'accumulate' ? TK.green500 : d.prescription.tone === 'caution' ? TK.red500 : TK.amber400
  const overWeight = myCryptoPct != null && myCryptoPct > 5
  const longData = d.longChart ? withMa200(d.longChart.points) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(247,147,26,0.12),rgba(168,85,247,0.06))', border: '1px solid rgba(247,147,26,0.35)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🪙</span>
          <span style={{ color: TK.btcOrange, fontWeight: 800, fontSize: 16 }}>코인 랩</span>
          <span style={{ color: TK.sub, fontSize: 12 }}>이익(EPS)이 없는 자산 — 사이클·심리·네트워크·유동성으로 본다</span>
          {view === 'btc' && (
            <span style={{ marginLeft: 'auto', color: TK.slate300, fontFamily: 'monospace', fontSize: 13 }}>
              BTC {fmtUsd(d.price.usd)} {d.price.krw != null && <span style={{ color: TK.sub }}>· {fmtKrw(d.price.krw)}</span>}
            </span>
          )}
        </div>
        {/* ₿ 비트코인(디지털 금) ↔ 🔷 알트코인(네트워크 자산) — 성격이 다른 자산이라 분리 */}
        <div style={{ display: 'inline-flex', gap: 4, background: TK.bg3, padding: 4, borderRadius: 9, border: `1px solid ${BORDER}`, marginTop: 10 }}>
          {([['btc', '₿ 비트코인', TK.btcOrange], ['alt', '🔷 알트코인 (ETH·SOL·XRP)', '#627eea'], ['stable', '💵 스테이블코인', '#26a17b'], ['stocks', '🏢 코인 관련 주식', TK.amber500]] as const).map(([k, label, c]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              style={{ padding: '5px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                background: view === k ? TK.border : 'transparent', color: view === k ? c : TK.sub3 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 🛡️ 가드레일 — 항상 최상단(학생 보호) */}
      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: TK.red300, fontSize: 11.5, lineHeight: 1.7 }}>
        {d.guardrailNote}
        {myCryptoPct != null && (
          <div style={{ marginTop: 4, color: overWeight ? TK.red400 : TK.green300, fontWeight: 700 }}>
            {overWeight
              ? `🚨 현재 내 포트폴리오의 코인 비중 ${myCryptoPct}% — 권장 상한 5%를 초과했습니다. 비중 축소를 고려하세요.`
              : `✅ 현재 내 코인 비중 ${myCryptoPct}% — 권장 상한(5%) 이내입니다.`}
          </div>
        )}
      </div>

      {/* 🏛️ 규제 레이더 — 양쪽 뷰 공통(법안은 코인 전체에 영향) */}
      <RegulatoryRadar />

      {/* 🔷 알트코인 뷰 */}
      {view === 'alt' && <AltcoinNetworkChart />}

      {view === 'stable' && <StablecoinRadar />}

      {view === 'stocks' && <CryptoStocksPanel />}

      {view === 'btc' && (<>
      {/* 🎓 국면×리스크 처방 */}
      <div style={{ background: `${toneColor}12`, border: `1px solid ${toneColor}44`, borderRadius: 12, padding: '12px 15px' }}>
        <div style={{ color: toneColor, fontWeight: 800, fontSize: 12.5, marginBottom: 4 }}>🤖 자비스 크립토 처방 — {d.prescription.regime}</div>
        <div style={{ color: TK.sub15, fontSize: 12, lineHeight: 1.75 }}>{d.prescription.text}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* ① 반감기 사이클 나침반 */}
        <Panel title="① 반감기 사이클 나침반" sub={`4차 반감기(${d.cycle.halving}) 이후 ${d.cycle.daysSince}일차`}>
          <div style={{ color: TK.amber400, fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{d.cycle.phase}</div>
          <div style={{ position: 'relative', height: 9, background: TK.bg3, borderRadius: 5, overflow: 'hidden', border: `1px solid ${BORDER}`, margin: '8px 0' }}>
            <div style={{ width: `${d.cycle.cyclePct}%`, height: '100%', background: `linear-gradient(90deg,${TK.green500},${TK.amber400},${TK.red500})` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: TK.sub }}><span>반감기</span><span>다음 반감기(~4년)</span></div>
          <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6, marginTop: 8 }}>{d.cycle.phaseDesc}</div>
          {d.price.mayer != null && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TK.sub5 }}>
              📐 <b>메이어 멀티플 {d.price.mayer}</b> (가격÷200일 이평 {fmtUsd(d.price.ma200)}) — <span style={{ color: d.price.mayer > 2.4 ? TK.red500 : d.price.mayer < 1 ? TK.green500 : TK.amber400 }}>{d.price.mayer > 2.4 ? '과열(>2.4)' : d.price.mayer < 1 ? '저평가(<1.0)' : '중립'}</span>
              <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 2 }}>※ 유료 MVRV 대신 무료 계산 가능한 메이어 멀티플로 거품도 측정</div>
            </div>
          )}
        </Panel>

        {/* ② 공포·탐욕 + 도미넌스 */}
        <Panel title="② 공포·탐욕 + 도미넌스" sub="대중 심리 역이용">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: fngColor(d.sentiment.fng), fontWeight: 900, fontSize: 30, fontFamily: 'monospace', lineHeight: 1 }}>{d.sentiment.fng ?? '—'}</div>
              <div style={{ color: fngColor(d.sentiment.fng), fontWeight: 800, fontSize: 12 }}>{fngKo(d.sentiment.fng)}</div>
              <div style={{ color: TK.sub, fontSize: 9.5 }}>어제 {d.sentiment.fngYesterday ?? '—'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: `linear-gradient(90deg,${TK.green500},${TK.lime400},${TK.amber400},${TK.orange400},${TK.red500})` }}>
                {d.sentiment.fng != null && <div style={{ position: 'absolute', left: `calc(${d.sentiment.fng}% - 2px)`, top: -3, width: 4, height: 14, background: '#fff', borderRadius: 2 }} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: TK.sub, marginTop: 3 }}><span>0 극공포</span><span>극탐욕 100</span></div>
              <div style={{ marginTop: 8, fontSize: 11, color: TK.sub5, lineHeight: 1.5 }}>
                BTC 도미넌스 <b style={{ color: TK.btcOrange }}>{d.sentiment.btcDom ?? '—'}%</b> · ETH <b style={{ color: TK.blue400 }}>{d.sentiment.ethDom ?? '—'}%</b>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10.5, color: TK.sub8, lineHeight: 1.6 }}>{d.sentiment.altHint} · &ldquo;탐욕에 팔고 공포에 사라&rdquo;</div>
        </Panel>

        {/* ③ 시장 개요 */}
        <Panel title="③ 시장 개요" sub={`전체 시총 $${d.market.totalMcapUsdT ?? '—'}T · 스테이블 ${d.market.stablecoinPct ?? '—'}%(대기자금)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.market.top.slice(0, 6).map((c, i) => (
              <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                <span style={{ color: TK.sub, width: 14 }}>{i + 1}</span>
                <span style={{ color: TK.slate200, fontWeight: 700, width: 48 }}>{c.symbol}</span>
                <span style={{ color: TK.sub, fontFamily: 'monospace' }}>{c.price >= 1 ? `$${c.price.toLocaleString()}` : `$${c.price}`}</span>
                <span style={{ marginLeft: 'auto', color: (c.ch24 ?? 0) >= 0 ? TK.green500 : TK.red500, fontFamily: 'monospace' }}>{c.ch24 != null ? `${c.ch24 >= 0 ? '+' : ''}${c.ch24.toFixed(1)}%` : '—'}</span>
                <span style={{ color: TK.sub, fontSize: 9.5, width: 56, textAlign: 'right' }}>${c.mcapB}B</span>
              </div>
            ))}
          </div>
          {/* 🔓 비트코인 유통량 — 희석 리스크(반감기·2,100만 상한과 연결) */}
          {d.supply && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <SupplyBar pct={d.supply.pct} note="최대 발행량 대비 유통률" />
              <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 4, lineHeight: 1.5 }}>BTC {d.supply.circulatingM}M / 최대 {d.supply.maxM}M — 신규 공급은 반감기로 계속 줄어 결국 2,100만 개에서 멈춥니다(언락 덤핑 리스크 없음).</div>
            </div>
          )}
        </Panel>

      </div>

      {/* 🌊 알트시즌 인덱스 — BTC 도미넌스 기반 시장 국면(추가 fetch 0) */}
      <AltSeasonIndex btcDom={d.sentiment.btcDom} ethDom={d.sentiment.ethDom} />

      {/* 🔄 4년 사이클 내비게이터 — 반감기 4국면 현재 위치 + 과거 사이클 오버레이(반감기가=100) */}
      {d.cycleNav && <BtcCycleNavigator nav={d.cycleNav} />}

      {/* 📈 10년 장기 가격 × 반감기 사이클 */}
      {d.longChart && d.longChart.points.length > 20 && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>📈 비트코인 10년 차트 × 반감기 사이클</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>로그 스케일(반로그 ½decade 눈금) · 세로 점선 = 반감기 · <span style={{ color: TK.blue400 }}>파란선 = 200주 이동평균</span></span>
          </div>
          {/* 📐 로그 축 교육 — '왜 중간이 $50k가 아니라 $10k인가' 오해 방지 */}
          <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 8, padding: '7px 11px', marginBottom: 8, color: TK.sub5, fontSize: 10.5, lineHeight: 1.6 }}>
            📐 <b style={{ color: TK.blue300 }}>로그(log) 축</b> — 한 칸이 <b>10배</b>를 뜻합니다($1k→$10k와 $10k→$100k가 같은 거리라 중간값이 $50k가 아니라 <b>$10k</b>). 비트코인은 10년간 약 250배 움직여, 선형 축이면 2016~2020 구간이 바닥에 깔려 안 보입니다 — 그래서 <b>변동성 큰 장기 자산은 로그가 표준</b>(TheBlock·트레이딩뷰도 동일).
          </div>
          <div style={{ height: 460 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={longData} margin={{ top: 18, right: 14, left: 2, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: TK.sub2, fontSize: 9.5 }} tickFormatter={(s: string) => s.slice(0, 4)} minTickGap={48} axisLine={{ stroke: BORDER }} tickLine={false} />
                <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: TK.sub2, fontSize: 9.5 }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`} ticks={[300, 1000, 3000, 10000, 30000, 100000]} />
                <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.sub }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, n: any) => [`$${Number(v).toLocaleString()}`, n === 'ma200' ? '200주 이평' : 'BTC']} />
                {d.longChart.halvings.map(h => (
                  <ReferenceLine key={h.date} x={d.longChart.points.reduce((best, p) => Math.abs(new Date(p.date).getTime() - new Date(h.date).getTime()) < Math.abs(new Date(best).getTime() - new Date(h.date).getTime()) ? p.date : best, d.longChart.points[0].date)}
                    stroke={TK.btcOrange} strokeDasharray="4 3" strokeWidth={1.2}
                    label={{ value: `⛏️${h.date.slice(0, 4)}`, fill: TK.btcOrange, fontSize: 9.5, fontWeight: 700, position: 'insideTop' }} />
                ))}
                <Line type="monotone" dataKey="price" name="BTC" stroke={TK.btcOrange} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ma200" name="ma200" stroke={TK.blue400} strokeWidth={1.6} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* 🎓 반감기란? 교육 아코디언 */}
          <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0 4px', textAlign: 'left' }}>
            <span style={{ color: TK.btcOrange, fontWeight: 800, fontSize: 12 }}>🎓 비트코인 반감기(Halving)란?</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>왜 4년마다 시장이 요동치고, 왜 &lsquo;디지털 금&rsquo;이라 불리나</span>
            <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {eduOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {[
                ['① 21만 블록마다 채굴 보상 절반', '비트코인은 약 10분마다 한 블록이 생기고, 채굴자에게 새 BTC를 보상으로 줍니다. 이 보상이 21만 블록(약 4년)마다 정확히 절반으로 줄어듭니다 — 50→25→12.5→6.25→3.125 BTC. 즉 신규 공급(인플레이션)이 4년마다 반으로 꺾입니다.'],
                ['② 공급 충격 → 역사적 강세 패턴', '수요가 같아도 신규 공급이 절반이 되면 희소성이 커집니다. 과거 3번의 반감기(2012·2016·2020) 모두 이후 12~18개월에 걸쳐 큰 강세장이 왔습니다(위 차트의 세로 점선 직후 구간). 단, 과거가 미래를 보장하지는 않습니다.'],
                ['③ 희소성 경제학 — 디지털 금', '금이 가치 저장 수단인 이유는 매년 채굴량이 한정돼 희소하기 때문입니다. 비트코인은 총 발행량이 2,100만 개로 코드에 못박혀 있고, 반감기로 신규 공급이 계속 줄어 결국 0에 수렴합니다 — 그래서 인플레이션 헤지 &lsquo;디지털 금&rsquo;으로 불립니다.'],
              ].map(([t, b]) => (
                <div key={t} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ color: TK.slate200, fontWeight: 700, fontSize: 11.5, marginBottom: 3 }}>{t}</div>
                  <div style={{ color: TK.sub5, fontSize: 11, lineHeight: 1.65 }}>{b}</div>
                </div>
              ))}
              <div style={{ background: 'rgba(247,147,26,0.07)', border: '1px solid rgba(247,147,26,0.3)', borderRadius: 9, padding: '9px 12px', color: TK.sub15, fontSize: 11, lineHeight: 1.7 }}>
                🎓 <b style={{ color: TK.btcOrange }}>최일 쌤의 한마디</b> — 위 차트를 로그 스케일로 보면, 변동성에 가려 보이지 않던 &lsquo;반감기마다 한 계단 올라서는&rsquo; 장기 추세가 드러납니다. 단기 캔들에 휩쓸리지 말고, 지금이 4년 사이클의 어디인지(패널 ①)를 먼저 보세요.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🌈 비트코인 레인보우 차트 — 로그 회귀 9밴드 */}
      {d.rainbow && <BtcRainbowChart rainbow={d.rainbow} />}

      {/* 💧 적립식(DCA) 시뮬레이터 — 10년 주봉 재사용 */}
      {d.longChart && d.longChart.points.length > 20 && <DcaSimulator points={d.longChart.points} />}

      {/* 🏦 현물 ETF 순유입/유출 + 누적 거래량 — 제도권 자금(연료) */}
      <BtcEtfFlows />

      {/* 🪙 펀딩비·OI 과열 레이더 — 무기한 선물 레버리지 froth */}
      <CryptoFundingRadar />

      {/* ④ 네트워크 + ⑤ M2 — 2단 배치(풀폭 가로 늘어짐 해소) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* ④ 네트워크 건강 */}
        <Panel title="④ 네트워크 건강(온체인)" sub="비트코인 = 기업 아닌 네트워크">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: TK.slate200, fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{d.network.hashrateEH ?? '—'}</span>
            <span style={{ color: TK.sub, fontSize: 11 }}>EH/s 해시레이트</span>
            <span style={{ color: d.network.trend === 'up' ? TK.green500 : d.network.trend === 'down' ? TK.red500 : TK.slate400, fontSize: 12, fontWeight: 700 }}>
              {d.network.trend === 'up' ? '▲ 강화' : d.network.trend === 'down' ? '▼ 약화' : '— 유지'}
            </span>
          </div>
          {d.network.spark.length > 1 && (
            <div style={{ height: 110, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.network.spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TK.btcOrange} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={TK.btcOrange} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelFormatter={() => ''}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${Math.round(v)} EH/s`, '해시레이트']} />
                  <Area type="monotone" dataKey="v" stroke={TK.btcOrange} strokeWidth={1.8} fill="url(#hashGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6, marginTop: 8 }}>
            난이도 {d.network.difficultyT ?? '—'}T · 해시레이트는 네트워크 보안의 척도입니다. <b>가격이 빠져도 해시레이트가 오르면 &ldquo;네트워크는 더 튼튼해지는 중&rdquo;</b> — 코인의 펀더멘탈.
          </div>
        </Panel>

        {/* ⑤ 글로벌 유동성(M2) vs 비트코인 */}
        {d.macro.points.length >= 3 && (
          <Panel title="⑤ 글로벌 유동성(M2) vs 비트코인" sub="좌축 M2(파랑) · 우축 BTC(주황) · 약 3년">
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.macro.points} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: TK.sub2, fontSize: 9.5 }} tickFormatter={(m: string) => m.slice(2)} minTickGap={44} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis yAxisId="m2" tick={{ fill: TK.cyan400, fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={42} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}T`} />
                  <YAxis yAxisId="btc" orientation="right" tick={{ fill: TK.btcOrange, fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={40} tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`} />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, name: any) => name === '미국 M2 통화량' ? [`$${(v / 1000).toFixed(2)}T`, name] : [`$${Number(v).toLocaleString()}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="m2" name="미국 M2 통화량" dataKey="m2" stroke={TK.cyan400} strokeWidth={1.8} dot={false} connectNulls />
                  <Line yAxisId="btc" name="비트코인" dataKey="btc" stroke={TK.btcOrange} strokeWidth={2.2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6, marginTop: 6 }}>{d.macro.note}</div>
          </Panel>
        )}
      </div>

      {/* ⑥ 상관관계 히트맵 — BTC vs 나스닥·S&P500·금 */}
      {d.correlation && d.correlation.matrix.length > 0 && (() => {
        const { labels, matrix } = d.correlation!
        // 상관계수 색 — 높을수록 위험자산 동조(주황/빨강), 낮을수록 분산 효과(초록)
        const cell = (v: number | null, self: boolean) => {
          if (self) return { bg: TK.border, c: TK.slate500, t: '—' }
          if (v == null) return { bg: TK.bg3, c: TK.slate500, t: '—' }
          const a = Math.abs(v)
          const c = a >= 0.6 ? TK.red400 : a >= 0.35 ? TK.amber400 : TK.green400
          return { bg: `${c}1f`, c, t: v.toFixed(2) }
        }
        const series = d.correlation!.series ?? []
        // 비트코인 vs (나스닥/금) 정규화 오버레이 — 로그 스케일(5년 기하급수 대응), 한 줄 2개
        const dot = (c: string) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: c, marginRight: 4, verticalAlign: 'middle' }} />
        const Overlay = ({ other, dataKey, color, corr }: { other: string; dataKey: 'nasdaq' | 'gold'; color: string; corr: number | null }) => (
          <div style={{ flex: '1 1 320px', minWidth: 280, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{dot(TK.btcOrange)}<span style={{ color: TK.btcOrange }}>비트코인</span></span>
              <span style={{ color: TK.sub, fontSize: 11 }}>vs</span>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{dot(color)}<span style={{ color }}>{other}</span></span>
              {corr != null && <span style={{ marginLeft: 'auto', color: Math.abs(corr) >= 0.6 ? TK.red400 : Math.abs(corr) >= 0.35 ? TK.amber400 : TK.green400, fontWeight: 800, fontSize: 11, fontFamily: 'monospace' }}>상관 {corr.toFixed(2)}</span>}
            </div>
            <div style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 6, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: TK.sub2, fontSize: 8.5 }} tickFormatter={(s: string) => s.slice(0, 4)} minTickGap={44} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis scale="log" tick={{ fill: TK.sub2, fontSize: 8.5 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={34} tickFormatter={(v: number) => `${v}`} />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 10.5 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [`${v}`, n === 'btc' ? '비트코인' : other]} />
                  <Line type="monotone" dataKey="btc" name="btc" stroke={TK.btcOrange} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey={dataKey} name={dataKey} stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
        return (
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>⑥ 상관관계 히트맵 — 비트코인 vs 증시·금</span>
              <span style={{ color: TK.sub, fontSize: 10.5 }}>1.0=완전 동조 · {d.correlation!.window}</span>
            </div>
            {/* 히트맵(상단) */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11, fontFamily: 'monospace' }}>
                  <thead>
                    <tr>
                      <th />
                      {labels.map(l => <th key={l} style={{ color: TK.sub, fontWeight: 700, fontSize: 10, padding: '2px 6px', minWidth: 52 }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => (
                      <tr key={labels[i]}>
                        <td style={{ color: TK.sub, fontWeight: 700, fontSize: 10, padding: '2px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{labels[i]}</td>
                        {row.map((v, j) => { const s = cell(v, i === j); return <td key={j} style={{ background: s.bg, color: s.c, fontWeight: 800, textAlign: 'center', padding: '7px 6px', borderRadius: 6 }}>{s.t}</td> })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: TK.sub, flexWrap: 'wrap' }}>
                <span><span style={{ color: TK.red400 }}>■</span> 0.6↑ 강한 동조</span>
                <span><span style={{ color: TK.amber400 }}>■</span> 0.35~0.6 보통</span>
                <span><span style={{ color: TK.green400 }}>■</span> 0.35↓ 약함(분산)</span>
              </div>
            </div>
            {/* 비교 차트(한 줄 2개, 로그 스케일·100 기준) */}
            {series.length > 3 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Overlay other="나스닥" dataKey="nasdaq" color={TK.blue400} corr={matrix[0]?.[1] ?? null} />
                <Overlay other="금" dataKey="gold" color={TK.amber400} corr={matrix[0]?.[3] ?? null} />
              </div>
            )}
            <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6, marginTop: 8 }}>{d.correlation!.note} <span style={{ color: TK.sub }}>(비교 차트: 시작점 100 기준 정규화·로그 스케일 — 주황=비트코인)</span></div>
          </div>
        )
      })()}

      {/* ⑦ 김치 프리미엄 */}
      {d.price.kimchiPct != null && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>🇰🇷</span>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>김치 프리미엄</span>
          <span style={{ color: d.price.kimchiPct >= 3 ? TK.red500 : d.price.kimchiPct <= -1 ? TK.green500 : TK.amber400, fontWeight: 900, fontSize: 20, fontFamily: 'monospace' }}>
            {d.price.kimchiPct >= 0 ? '+' : ''}{d.price.kimchiPct}%
          </span>
          <span style={{ color: TK.sub8, fontSize: 11, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
            업비트(KRW) vs 글로벌(USD) 가격차. {d.price.kimchiPct >= 3 ? '국내 과열·투기 수요 신호(고플 때 신규 진입 주의).' : d.price.kimchiPct <= -1 ? '역프리미엄 — 국내 수요 위축.' : '정상 범위.'}
          </span>
        </div>
      )}

      <div style={{ color: TK.sub, fontSize: 10, lineHeight: 1.6 }}>
        ※ 데이터: CoinGecko·alternative.me(공포탐욕)·mempool.space(해시레이트)·업비트(KRW)·FRED(M2) — 전부 무료 공개 API · 1h 캐시 · 메이어 멀티플은 유료 MVRV의 무료 대체 지표 · 비트코인은 주식과 달리 EPS·PER이 없어 사이클·심리·네트워크로 분석합니다 · 교육용이며 투자 추천이 아닙니다.
      </div>
      </>)}
    </div>
  )
}
