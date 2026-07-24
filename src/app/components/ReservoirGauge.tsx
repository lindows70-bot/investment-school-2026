'use client'
// 🏞️ 저수지 수위계 — 여운봉 「저수지 투자법」(폭락이 무섭지 않은 사람들의 비밀) 결정론 구현.
// 지수 고점(최근 ~7년 최고 종가) 대비 낙폭으로 '가뭄 단계'를 판정: 미국 −20/−30/−40(배분 40/40/20),
// 코스피는 체급이 달라(IMF −75%·2008 −57%) −30/−45/−55(배분 30/40/30 — 뒤에 무게).
// 규칙: 지수 ETF만(개별주는 −90%·상폐 가능), 5년 이상 여유자금만, 생활비 금지. 판정·점수 미반영 교육 위젯.
import { useState, useEffect } from 'react'
import { TK } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3

interface Ladder { name: string; flag: string; ticker: string; steps: { dd: number; pct: number; label: string }[] }
const LADDERS: Ladder[] = [
  {
    name: 'S&P500', flag: '🇺🇸', ticker: '^GSPC',
    steps: [
      { dd: -20, pct: 40, label: '1차 가뭄 — 약세장(1928년 이후 27번, 27번 전부 회복)' },
      { dd: -30, pct: 40, label: '2차 가뭄 — 역사적 폭락권(블랙먼데이·2008·코로나)' },
      { dd: -40, pct: 20, label: '3차 가뭄 — 10~20년에 한 번(오일쇼크·닷컴·대공황)' },
    ],
  },
  {
    name: '코스피', flag: '🇰🇷', ticker: '^KS11',
    steps: [
      { dd: -30, pct: 30, label: '1차 가뭄 — 미국 기준 폭락권이지만 코스피는 시작점' },
      { dd: -45, pct: 40, label: '2차 가뭄 — 코로나급(−45%)' },
      { dd: -55, pct: 30, label: '3차 가뭄 — IMF(−75%)·2008(−57%)급' },
    ],
  },
]

interface Gauge { ticker: string; close: number; ath: number; ddPct: number; athDate: string }

export default function ReservoirGauge() {
  const [g, setG] = useState<Record<string, Gauge> | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    Promise.all(LADDERS.map(async l => {
      // 주봉(~7년 창)으로 장기 고점을, 일봉(~2년 창)으로 정밀 종가 고점·현재가를 — 병합해 둘의 최고 종가를 ATH로
      const [w, d] = await Promise.all(['W', 'D'].map(tf =>
        fetch(`/api/tech-chart?ticker=${encodeURIComponent(l.ticker)}&market=US&tf=${tf}`, { cache: 'no-store' }).then(r => r.json())))
      const wc: { date: string; close: number }[] = w?.candles ?? []
      const dc: { date: string; close: number }[] = d?.candles ?? []
      if (wc.length < 52 || dc.length < 30) throw new Error('no data')
      let ath = -Infinity, athDate = ''
      for (const b of [...wc, ...dc]) if (b.close > ath) { ath = b.close; athDate = b.date }
      const close = dc[dc.length - 1].close
      return [l.ticker, { ticker: l.ticker, close, ath, athDate, ddPct: Math.round((close / ath - 1) * 1000) / 10 }] as const
    })).then(es => setG(Object.fromEntries(es))).catch(() => setErr(true))
  }, [])

  const stageOf = (l: Ladder, dd: number) => l.steps.filter(s => dd <= s.dd).length

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '16px 18px' }}>
      <div style={{ color: TK.slate200, fontWeight: 900, fontSize: 15, marginBottom: 4 }}>🏞️ 저수지 수위계 — 지수 가뭄 단계</div>
      <div style={{ color: TK.sub3, fontSize: 11.5, lineHeight: 1.6, marginBottom: 12 }}>
        "여유자금을 저수지에 채워두고, 가뭄(지수 폭락)이 오면 3번에 나눠 물을 댄다"(여운봉 저수지 투자법).
        바닥은 맞추는 게 아니라 <b style={{ color: TK.sky400 }}>미리 정한 기준선에서 기계적으로 나눠 사는 것</b> — S&P500은 −20% 약세장 27번이 27번 전부 회복했지만, 평균 낙폭이 −33~35%라 한 번에 다 사면 안 됨.
      </div>
      {!g && !err && <div style={{ color: TK.sub, fontSize: 12.5 }}>지수 낙폭 계산 중…</div>}
      {err && <div style={{ color: TK.sub, fontSize: 12.5 }}>지수 데이터를 불러오지 못했습니다.</div>}
      {g && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {LADDERS.map(l => {
            const v = g[l.ticker]
            if (!v) return null
            const stage = stageOf(l, v.ddPct)
            const maxDd = l.steps[l.steps.length - 1].dd - 10
            const next = l.steps[stage]
            const col = stage === 0 ? TK.green400 : stage === 1 ? TK.amber400 : stage === 2 ? TK.orange400 : TK.red400
            return (
              <div key={l.ticker} style={{ background: TK.bg3, border: `1px solid ${col}44`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ color: TK.slate200, fontSize: 13.5 }}>{l.flag} {l.name}</b>
                  <b style={{ color: col, fontSize: 13.5 }}>{stage === 0 ? '가뭄 아님' : `${stage}차 가뭄 진행 중`}</b>
                  <span style={{ marginLeft: 'auto', color: col, fontWeight: 900, fontSize: 15 }}>{v.ddPct}%</span>
                </div>
                <div style={{ color: TK.sub3, fontSize: 10.5, margin: '2px 0 8px' }}>고점 {Math.round(v.ath).toLocaleString()}({v.athDate.slice(0, 7)}) → 현재 {Math.round(v.close).toLocaleString()} · 데이터 창 내 최고 종가 기준</div>
                {/* 수위 바: 0% ~ 최심 기준선+10% 축에 현재 낙폭과 기준선 3개 표시 */}
                <div style={{ position: 'relative', height: 22, background: TK.bg5, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, v.ddPct / maxDd * 100)}%`, background: `${col}33`, borderRight: `2px solid ${col}` }} />
                  {l.steps.map((s, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${s.dd / maxDd * 100}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${v.ddPct <= s.dd ? col : TK.sub}66` }}>
                      <span style={{ position: 'absolute', left: 3, top: 3, fontSize: 9, color: v.ddPct <= s.dd ? col : TK.sub3, fontWeight: 700 }}>{s.dd}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {l.steps.map((s, i) => {
                    const hit = v.ddPct <= s.dd
                    return (
                      <div key={i} style={{ fontSize: 10.5, color: hit ? col : TK.sub3, lineHeight: 1.5 }}>
                        {hit ? '✅' : '⬜'} <b>{s.dd}% 도달 시 저수지의 {s.pct}%</b> — {s.label}
                      </div>
                    )
                  })}
                </div>
                {next && (
                  <div style={{ marginTop: 6, fontSize: 11, color: TK.sub5 }}>
                    다음 기준선({next.dd}%)까지 <b style={{ color: TK.slate200 }}>{Math.round((next.dd - v.ddPct) * 10) / 10}%p</b> 남음
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: TK.sub5, lineHeight: 1.7, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
        ⚠️ <b style={{ color: TK.orange400 }}>이 방법이 깨지는 3가지</b> — ① <b>개별 종목 금지</b>: 지수는 전부 회복했지만 개별주는 −90%·상장폐지로 영영 안 돌아올 수 있음(지수 ETF만) ② <b>회복엔 시간</b>: 2008년 4년·닷컴 7년·니케이는 34년 — 5년 이상 안 쓸 여유자금만 ③ <b>생활비 투입 금지</b>: 바닥에서 산 돈을 6개월 뒤 꺼내면 최고의 매수가 최악의 매도로 변함. 매수 추천 아님 — 규칙 교육용.
      </div>
    </div>
  )
}
