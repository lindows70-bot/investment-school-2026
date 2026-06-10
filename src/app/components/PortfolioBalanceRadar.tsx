'use client'

/**
 * PortfolioBalanceRadar — ⚖️ 피터 린치 포트폴리오 황금비율 로드맵 (비밀병기 1단계)
 *
 * 학생 개인의 6대 분류 비중을 레이더 차트로 시각화하고,
 * 피터 린치의 이상적 권장 비율과 비교하여 자동 진단 코멘트를 생성한다.
 *
 * 제1원칙: DB의 lynch_category(정통 6대 분류) + purchase_price 실데이터만 사용.
 *          getAssetType() SSOT로 ETF·코인·원자재 제외.
 */

import { useMemo } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { getAssetType } from '@/lib/assetClassifier'

// ── 타입 (기존 DB 스키마 기준) ────────────────────────────────────────────────
interface Investment {
  ticker:          string
  name:            string
  market?:         string
  currency?:       string
  purchase_price:  number
  quantity:        number
  lynch_category:  string | null
}

interface Props {
  investments: Investment[]
  usdKrw?:     number   // USD→KRW 환율 (기본 1350) — 통화 통일 합산용
}

// ── 피터 린치의 이상적 포트폴리오 권장 비중 (%) ────────────────────────────────
const IDEAL_RATIOS = {
  stalwart:    35,   // 대형 우량주 — 안전판·하방 경직성
  fast_grower: 30,   // 빠른 성장주 — 알파 창출의 핵심
  cyclical:    20,   // 경기 순환주 — 사이클 타이밍 투자
  turnaround:  10,   // 회생주 — 하이리스크 하이리턴
  asset_play:  5,    // 자산 보유주 — 숨겨진 가치
  slow_grower: 0,    // 저성장주 — 린치는 보통 비권장
}

const CATEGORY_LABELS: Record<string, string> = {
  stalwart:    '대형 우량주',
  fast_grower: '빠른 성장주',
  cyclical:    '경기 순환주',
  turnaround:  '회생주',
  asset_play:  '자산 보유주',
  slow_grower: '저성장주',
}

// 카테고리별 색상 (하단 범례·종목 칩과 통일)
const CATEGORY_COLORS: Record<string, string> = {
  stalwart:    '#60a5fa',
  fast_grower: '#34d399',
  cyclical:    '#fb923c',
  turnaround:  '#f87171',
  asset_play:  '#c084fc',
  slow_grower: '#a8b5c2',
}

interface CatStock { ticker: string; name: string; value: number; weight: number }
type ByCategory = Record<string, CatStock[]>
const emptyByCat = (): ByCategory =>
  ({ stalwart: [], fast_grower: [], cyclical: [], turnaround: [], asset_play: [], slow_grower: [] })

export default function PortfolioBalanceRadar({ investments, usdKrw = 1350 }: Props) {
  // ── 차트 데이터 (내 비중 vs 권장 비중) ──────────────────────────────────────
  const { chartData, totalStockValue, stockCount, byCategory } = useMemo(() => {
    // ① 개별 주식만 + 분류된 종목만 (SSOT 필터)
    const stocks = investments.filter(inv =>
      getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') === 'STOCK'
      && inv.lynch_category
    )

    // ★ 통화 통일: USD 종목은 환율로 KRW 환산 후 합산 (통화 무관 합산 버그 수정)
    const toKrw = (inv: Investment) =>
      inv.purchase_price * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)

    const total = stocks.reduce((s, inv) => s + toKrw(inv), 0)
    if (total === 0) return { chartData: [], totalStockValue: 0, stockCount: stocks.length, byCategory: emptyByCat() }

    // ② 카테고리별 투자금액 합산 + 종목 목록 (KRW 환산값)
    const sums: Record<string, number> = {
      stalwart: 0, fast_grower: 0, cyclical: 0, turnaround: 0, asset_play: 0, slow_grower: 0,
    }
    const byCat = emptyByCat()
    stocks.forEach(inv => {
      const cat = inv.lynch_category as string
      const v = toKrw(inv)
      if (sums[cat] !== undefined) sums[cat] += v
      if (byCat[cat]) byCat[cat].push({ ticker: inv.ticker, name: inv.name ?? inv.ticker, value: v, weight: 0 })
    })
    // 종목별 포트폴리오 비중(%) 계산 + 비중 큰 순 정렬
    Object.values(byCat).forEach(arr => {
      arr.forEach(s => { s.weight = parseFloat(((s.value / total) * 100).toFixed(1)) })
      arr.sort((a, b) => b.value - a.value)
    })

    // ③ 레이더 데이터 배열
    const data = (Object.keys(IDEAL_RATIOS) as (keyof typeof IDEAL_RATIOS)[]).map(key => ({
      subject:    CATEGORY_LABELS[key],
      myRatio:    parseFloat(((sums[key] / total) * 100).toFixed(1)),
      idealRatio: IDEAL_RATIOS[key],
      fullMark:   100,
    }))

    return { chartData: data, totalStockValue: total, stockCount: stocks.length, byCategory: byCat }
  }, [investments, usdKrw])

  // ── 자동 진단 코멘트 ───────────────────────────────────────────────────────
  const insight = useMemo(() => {
    if (chartData.length === 0) return null
    const sorted = [...chartData].sort((a, b) => b.myRatio - a.myRatio)
    const top = sorted[0]

    if (top.subject === '빠른 성장주' && top.myRatio > 50)
      return { icon: '💡', color: '#fbbf24', text: '빠른 성장주 비중이 매우 높습니다. 공격적 알파 창출엔 좋지만 하락장 방어력이 약할 수 있으니, 대형 우량주 비중 확대를 고려해 보세요.' }
    if (top.subject === '경기 순환주' && top.myRatio > 40)
      return { icon: '⚠️', color: '#fb923c', text: '경기 순환주 비중이 높습니다. 산업 사이클 고점에서 매도 타이밍을 놓치지 않도록 각별한 주의가 필요합니다.' }
    if (top.subject === '저성장주' && top.myRatio > 20)
      return { icon: '🐢', color: '#a8b5c2', text: '저성장주 비중이 꽤 높습니다. 고배당 목적이 아니라면 포트폴리오 전체의 성장 활력이 떨어질 수 있습니다.' }
    if (top.subject === '회생주' && top.myRatio > 25)
      return { icon: '🔥', color: '#f87171', text: '회생주 비중이 높습니다. 하이리스크 구간이므로 흑자전환 여부와 재무 건전성을 반드시 확인하세요.' }
    return { icon: '✅', color: '#4ade80', text: '훌륭합니다! 린치의 권장 비율과 유사한 안정적인 밸런스를 유지하고 있습니다.' }
  }, [chartData])

  const C = {
    card: '#111827', border: '#1f2937', text: '#f1f5f9', sub: '#94a3b8', low: '#8599ae',
  }

  // ── 빈 상태 ────────────────────────────────────────────────────────────────
  if (chartData.length === 0) {
    return (
      <div style={{
        background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14,
        padding: '48px 24px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 36 }}>⚖️</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
          밸런스를 측정할 개별 주식이 없습니다
        </div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
          {stockCount > 0
            ? '보유 종목의 린치 분류가 아직 완료되지 않았습니다. 잠시 후 다시 확인해주세요.'
            : '자산관리 탭에서 개별 주식을 추가하면 포트폴리오 황금비율 진단이 시작됩니다.'}
        </div>
      </div>
    )
  }

  // ── KPI: 가장 쏠린 카테고리 ────────────────────────────────────────────────
  const topCat = [...chartData].sort((a, b) => b.myRatio - a.myRatio)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 ── */}
      <div style={{
        padding: '16px 20px', borderRadius: 14,
        background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
        border: '1px solid rgba(16,185,129,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>⚖️</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>
            피터 린치 포트폴리오 황금비율 로드맵
          </span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700 }}>
            SECRET
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.low }}>
          내 6대 분류 비중을 린치의 이상적 비율과 비교 · 투자원금 {(totalStockValue >= 1e8 ? `₩${(totalStockValue/1e8).toFixed(1)}억` : `₩${Math.round(totalStockValue/1e4).toLocaleString('ko-KR')}만`)} 기준
        </div>
      </div>

      {/* ── 레이더 + 비중 테이블 2단 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        {/* 레이더 차트 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 8px' }}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <PolarGrid stroke="#7a8fa3" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#a8b5c2', fontSize: 11 }} />
                {/* ★ domain [0,100] 고정: 100% 몰빵 종목도 꼭짓점이 차트 밖으로 잘리지 않음 */}
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  itemStyle={{ color: '#e5e7eb' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((v: any) => `${v}%`) as any}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Radar name="린치 권장 비중 (%)" dataKey="idealRatio"
                  stroke="#8a96a8" fill="#8a96a8" fillOpacity={0.3} isAnimationActive={false} />
                <Radar name="내 포트폴리오 (%)" dataKey="myRatio"
                  stroke="#10b981" fill="#10b981" fillOpacity={0.55} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 비중 비교 테이블 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 2 }}>
            카테고리별 비중 (내 vs 권장)
          </div>
          {chartData.map(d => {
            const diff = parseFloat((d.myRatio - d.idealRatio).toFixed(1))
            const over = diff > 5, under = diff < -5
            const barColor = over ? '#f87171' : under ? '#60a5fa' : '#10b981'
            return (
              <div key={d.subject}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: C.text }}>{d.subject}</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    <span style={{ color: barColor, fontWeight: 700 }}>{d.myRatio}%</span>
                    <span style={{ color: C.low }}> / {d.idealRatio}%</span>
                  </span>
                </div>
                {/* 비중 바: 0~100% 스케일 (권장 회색 마커 + 내 비중 컬러) */}
                <div style={{ position: 'relative', height: 6, background: '#1e293b', borderRadius: 999, overflow: 'visible' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${Math.min(100, d.myRatio)}%`, background: barColor, borderRadius: 999,
                    transition: 'width 0.5s ease' }} />
                  {/* 권장 비중 마커 */}
                  <div style={{ position: 'absolute', top: -2, height: 10, width: 2,
                    left: `${Math.min(100, d.idealRatio)}%`, background: '#a8b5c2' }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 4, fontSize: 9, color: C.low, display: 'flex', gap: 10 }}>
            <span><span style={{ color: '#f87171' }}>■</span> 과다(+5%p)</span>
            <span><span style={{ color: '#60a5fa' }}>■</span> 부족(-5%p)</span>
            <span><span style={{ color: '#a8b5c2' }}>|</span> 권장선</span>
          </div>
        </div>
      </div>

      {/* ── 자동 진단 코멘트 ── */}
      {insight && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: `${insight.color}10`, border: `1px solid ${insight.color}44`,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{insight.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: insight.color, marginBottom: 4 }}>
              밸런스 자동 진단 — 최대 비중: {topCat.subject} ({topCat.myRatio}%)
            </div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
              {insight.text}
            </div>
          </div>
        </div>
      )}

      {/* ── 린치 권장 비율 설명 ── */}
      <div style={{
        padding: '12px 16px', borderRadius: 10, background: '#0d1420', border: `1px solid ${C.border}`,
        fontSize: 10, color: C.low, lineHeight: 1.7,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8,
      }}>
        <div><strong style={{ color: '#60a5fa' }}>대형우량주 35%</strong> — 안전판·하방 경직성</div>
        <div><strong style={{ color: '#34d399' }}>빠른성장주 30%</strong> — 알파 창출 핵심</div>
        <div><strong style={{ color: '#fb923c' }}>경기순환주 20%</strong> — 사이클 타이밍</div>
        <div><strong style={{ color: '#f87171' }}>회생주 10%</strong> — 하이리스크 하이리턴</div>
        <div><strong style={{ color: '#c084fc' }}>자산보유주 5%</strong> — 숨겨진 가치</div>
        <div><strong style={{ color: '#a8b5c2' }}>저성장주 0%</strong> — 고배당 외 비권장</div>
      </div>

      {/* ── 6대 분류별 내 보유 종목 (어떤 종목이 어디에 속하는지) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>
          📋 6대 분류별 내 보유 종목
        </div>
        <div style={{ fontSize: 10, color: C.low, marginBottom: 12 }}>
          각 분류에 속한 내 종목과 포트폴리오 내 비중(%) — 어디가 비었는지 한눈에
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {(Object.keys(IDEAL_RATIOS) as (keyof typeof IDEAL_RATIOS)[]).map(key => {
            const list = byCategory[key] ?? []
            const color = CATEGORY_COLORS[key]
            const catRatio = chartData.find(d => d.subject === CATEGORY_LABELS[key])?.myRatio ?? 0
            return (
              <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                paddingTop: 9, borderTop: `1px solid ${C.border}` }}>
                <div style={{ minWidth: 82, flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color }}>{CATEGORY_LABELS[key]}</div>
                  <div style={{ fontSize: 9.5, color: C.low, fontFamily: 'monospace' }}>
                    {catRatio}% · {list.length}종목
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
                  {list.length === 0
                    ? <span style={{ fontSize: 11, color: C.low }}>— 보유 종목 없음</span>
                    : list.map(s => (
                      <span key={s.ticker} style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 20,
                        background: `${color}14`, border: `1px solid ${color}33`, color: C.text,
                        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                      }}>
                        {s.name}
                        <span style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>{s.weight}%</span>
                      </span>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
