'use client'
// 📉 공매도 레이더 — 보유 US 종목 공매도 잔고·커버일수·유통비중(Yahoo 실데이터) + KR 3대 지표 교육(무료 소스 부재 정직 고지)
import { useState, useEffect } from 'react'
import type { ShortInterestResult, ShortEntry } from '@/app/api/short-interest/route'
import type { KrShortResult, KrShortSignal } from '@/app/api/kr-short/route'

const KR_SIG: Record<KrShortSignal, { ko: string; color: string; tip: string }> = {
  heavy: { ko: '🔴 숏 과다', color: '#f87171', tip: '순보유잔고가 상장주식 3% 이상 — 하락 베팅이 크게 누적(악재 취약, 호재 시 숏스퀴즈 연료)' },
  rising: { ko: '🟠 숏 증가', color: '#fb923c', tip: '잔고가 20거래일 새 +20% 이상 급증 — 세력이 하락 베팅을 강화 중' },
  covering: { ko: '🔵 숏커버링', color: '#60a5fa', tip: '잔고가 20거래일 새 −20% 이상 급감 — 공매도 세력이 되사서 갚는 중(상승 압력 가능)' },
  spike: { ko: '🟡 당일 집중', color: '#fbbf24', tip: '오늘 거래의 10% 이상이 공매도 — 단기 하락 베팅 집중일' },
  calm: { ko: '🟢 평온', color: '#4ade80', tip: '공매도 압력이 낮은 상태' },
}
const fmtKrQty = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억주` : n >= 1e4 ? `${(n / 1e4).toFixed(0)}만주` : `${n.toLocaleString()}주`)

const CARD = '#12151c', BORDER = '#252a36'
const SIG: Record<ShortEntry['signal'], { ko: string; color: string; tip: string }> = {
  heavy: { ko: '🔴 숏 과다', color: '#f87171', tip: '유통주식 10%+ 공매도 — 하락 베팅이 매우 큼(악재 취약, 단 스퀴즈 연료이기도)' },
  squeeze: { ko: '🟣 스퀴즈 잠재', color: '#a855f7', tip: '유통 5%+ & 커버 5일+ — 호재 시 숏커버링(되사기)이 급등을 증폭할 수 있는 구조' },
  rising: { ko: '🟠 숏 증가', color: '#fb923c', tip: '전월 대비 공매도 잔고 +15% 이상 급증 — 세력의 하락 베팅 강화' },
  calm: { ko: '🟢 평온', color: '#4ade80', tip: '공매도 압력이 낮은 상태' },
}
const fmtShares = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억주` : n >= 1e4 ? `${(n / 1e4).toFixed(0)}만주` : `${n}주`)

// 60일 공매도 비중 미니 스파크라인
function RatioSpark({ series }: { series: { ratio: number }[] }) {
  if (series.length < 2) return null
  const w = 110, h = 26
  const vals = series.map(s => s.ratio)
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 3 - ((v - mn) / rg) * (h - 6)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#f87171" strokeWidth="1.5" />
      <circle cx={w} cy={h - 3 - ((vals[vals.length - 1] - mn) / rg) * (h - 6)} r="2.2" fill="#f87171" />
    </svg>
  )
}

export default function ShortInterestRadar() {
  const [d, setD] = useState<ShortInterestResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'noauth' | 'err'>('loading')
  const [kr, setKr] = useState<KrShortResult | null>(null)
  const [krMkt, setKrMkt] = useState<'KOSPI' | 'KOSDAQ'>('KOSPI')

  useEffect(() => {
    fetch('/api/short-interest', { cache: 'no-store' })
      .then(r => (r.status === 401 ? (setState('noauth'), null) : r.json()))
      .then(x => { if (x?.entries) { setD(x); setState('ok') } })
      .catch(() => setState('err'))
    fetch('/api/kr-short', { cache: 'no-store' }).then(r => r.json()).then(x => { if (x?.marketTop) setKr(x) }).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── 미국 보유종목 공매도 잔고 (실데이터) ── */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📉 내 미국 종목 공매도 잔고 — 세력의 하락 베팅</div>
        <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 2, marginBottom: 10 }}>
          공매도 잔고 = 빌려서 판 뒤 아직 안 갚은 물량(하락 베팅 누적). 미국은 FINRA 격주 공시(Yahoo 반영) — <b style={{ color: '#cdd6e3' }}>커버일수</b>(잔고÷일평균거래량)가 클수록 숏커버링 시 급등 연료.
        </div>

        {state === 'loading' && <div style={{ color: '#8a9aaa', fontSize: 12 }}>보유 종목 공매도 데이터를 수집 중…</div>}
        {state === 'noauth' && <div style={{ color: '#8a9aaa', fontSize: 12 }}>로그인하면 내 보유 미국 종목의 공매도 잔고를 보여드립니다.</div>}
        {state === 'err' && <div style={{ color: '#8a9aaa', fontSize: 12 }}>데이터를 불러오지 못했습니다.</div>}
        {state === 'ok' && d && d.entries.length === 0 && <div style={{ color: '#8a9aaa', fontSize: 12 }}>보유 중인 미국 개별주식이 없습니다(공매도 공시는 미국 종목만 무료 제공).</div>}

        {state === 'ok' && d && d.entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: '#7f93a8', fontSize: 10, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>종목</th>
                  <th style={{ padding: '4px 6px' }}>공매도 잔고</th>
                  <th style={{ padding: '4px 6px' }}>전월비</th>
                  <th style={{ padding: '4px 6px' }}>유통주식 대비</th>
                  <th style={{ padding: '4px 6px' }}>커버일수</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>신호</th>
                </tr>
              </thead>
              <tbody>
                {d.entries.map(e => {
                  const s = SIG[e.signal]
                  return (
                    <tr key={e.ticker} style={{ borderTop: `1px solid ${BORDER}` }} title={s.tip}>
                      <td style={{ padding: '6px 6px', color: '#e2e8f0', fontWeight: 700 }}>{e.ticker} <span style={{ color: '#7f93a8', fontSize: 10 }}>{e.asOfDate ?? ''}</span></td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: '#cdd6e3', fontFamily: 'monospace' }}>{fmtShares(e.sharesShort)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: (e.momChgPct ?? 0) > 15 ? '#fb923c' : (e.momChgPct ?? 0) < -15 ? '#60a5fa' : '#9aa7b5' }}>{e.momChgPct != null ? `${e.momChgPct > 0 ? '+' : ''}${e.momChgPct}%` : '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: (e.pctFloat ?? 0) >= 10 ? '#f87171' : (e.pctFloat ?? 0) >= 5 ? '#fbbf24' : '#9aa7b5', fontWeight: 700 }}>{e.pctFloat != null ? `${e.pctFloat}%` : '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: (e.shortRatio ?? 0) >= 5 ? '#a855f7' : '#9aa7b5' }}>{e.shortRatio != null ? `${e.shortRatio}일` : '—'}</td>
                      <td style={{ padding: '6px 6px' }}><span style={{ color: s.color, fontWeight: 800, fontSize: 10.5 }}>{s.ko}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
              신호 기준(결정론): 🔴 유통 10%↑ · 🟣 유통 5%↑+커버 5일↑ · 🟠 전월비 +15%↑ · 행 위에 마우스를 올리면 해석 표시. 공매도 잔고↑ = 하락 압력이지만, 호재 시 <b style={{ color: '#a855f7' }}>숏커버링 급등</b>의 연료이기도 합니다(양방향).
            </div>
          </div>
        )}
      </div>

      {/* ── 🇰🇷 한국 보유종목 공매도 (KRX 로그인 러너 실데이터) ── */}
      {kr && kr.holdings.length > 0 && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🇰🇷 한국 보유종목 공매도 — 거래 비중·순보유잔고</span>
            <span style={{ background: 'rgba(212,175,122,0.12)', color: '#d4af7a', border: '1px solid rgba(212,175,122,0.35)', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>📅 기준 {kr.date}</span>
          </div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 2, marginBottom: 8 }}>
            KRX 공매도 통계(공식·로그인 수집). <b style={{ color: '#cdd6e3' }}>비중</b>=당일 거래 중 공매도 비율(1~2% 평시, 10%+ 급증 경계) · <b style={{ color: '#cdd6e3' }}>잔고</b>=안 갚고 쌓인 누적 물량(T+2 공시).
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: '#7f93a8', fontSize: 10, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>종목</th>
                  <th style={{ padding: '4px 6px' }}>공매도 잔고</th>
                  <th style={{ padding: '4px 6px' }}>잔고 20일 변화</th>
                  <th style={{ padding: '4px 6px' }}>상장주식 대비</th>
                  <th style={{ padding: '4px 6px' }}>당일 거래 비중</th>
                  <th style={{ textAlign: 'left', padding: '4px 10px' }}>60일 비중 추이</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>신호</th>
                </tr>
              </thead>
              <tbody>
                {[...kr.holdings].sort((a, b) => (b.balance?.pct ?? 0) - (a.balance?.pct ?? 0)).map(h => {
                  const last = h.series[h.series.length - 1]
                  const chg = h.balance?.chg20d ?? null
                  const s = KR_SIG[h.signal ?? 'calm']
                  return (
                    <tr key={h.ticker} style={{ borderTop: `1px solid ${BORDER}` }} title={s.tip}>
                      <td style={{ padding: '6px 6px', color: '#e2e8f0', fontWeight: 700 }}>{h.name} <span style={{ color: '#7f93a8', fontSize: 9.5 }}>{h.ticker}</span></td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#cdd6e3' }}>{h.balance ? fmtKrQty(h.balance.qty) : '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: chg == null ? '#9aa7b5' : chg >= 20 ? '#fb923c' : chg <= -20 ? '#60a5fa' : '#9aa7b5' }}>{chg != null ? `${chg > 0 ? '+' : ''}${chg}%` : '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: (h.balance?.pct ?? 0) >= 3 ? '#f87171' : (h.balance?.pct ?? 0) >= 1 ? '#fbbf24' : '#9aa7b5' }}>{h.balance ? `${h.balance.pct}%` : '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: (last?.ratio ?? 0) >= 10 ? '#f87171' : (last?.ratio ?? 0) >= 5 ? '#fbbf24' : '#9aa7b5' }}>{last ? `${last.ratio}%` : '—'}</td>
                      <td style={{ padding: '4px 10px' }}><RatioSpark series={h.series} /></td>
                      <td style={{ padding: '6px 6px' }}><span style={{ color: s.color, fontWeight: 800, fontSize: 10.5, whiteSpace: 'nowrap' }}>{s.ko}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 6 }}>신호(결정론): 🔴잔고 3%↑ · 🟠잔고 20일 +20%↑ · 🔵잔고 20일 −20%↓(숏커버링 진행 = 상승 압력 가능) · 🟡당일 비중 10%↑ · 행에 마우스 올리면 해석. 미국판과 동일한 양방향 프레임.</div>
        </div>
      )}

      {/* ── 🇰🇷 시장 공매도 비중 Top (과열 종목) ── */}
      {kr && kr.marketTop.length > 0 && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🔥 오늘 시장 공매도 비중 Top — 세력이 하락에 베팅한 종목</span>
            {(['KOSPI', 'KOSDAQ'] as const).map(m => (
              <button key={m} onClick={() => setKrMkt(m)} style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: krMkt === m ? '#f8717122' : '#161b25', color: krMkt === m ? '#f87171' : '#8a9aaa', border: `1px solid ${krMkt === m ? '#f8717166' : '#1e293b'}` }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
            {kr.marketTop.filter(r => r.market === krMkt).slice(0, 12).map((r, i) => (
              <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ color: '#7f93a8', fontSize: 10, width: 16 }}>{i + 1}</span>
                <span style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ color: r.ratio >= 20 ? '#f87171' : '#fbbf24', fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{r.ratio}%</span>
              </div>
            ))}
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8 }}>당일 거래량 중 공매도 비율(공매도 1만주↑ 종목만). 비중 10%+ = 하락 베팅 집중 — 보유 종목이 여기 뜨면 수급·뉴스 점검. 매매 지시 아님.</div>
        </div>
      )}

      {/* ── 한국 공매도 3대 지표 — 교육 + 정직한 데이터 한계 ── */}
      <div style={{ background: 'rgba(212,175,122,0.06)', border: '1px solid rgba(212,175,122,0.33)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ color: '#d4af7a', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>🎓 한국 공매도 3대 지표 — 읽는 법</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
          {[
            ['① 공매도 거래 비중', '당일 확인', '하루 거래량 중 공매도 비율. 평소 1~2% → 10%+ 급증이면 세력이 하락을 강하게 베팅 중(단기 주가와 가장 밀접).', '#f87171'],
            ['② 공매도 순보유잔고', 'T+2 확인', '되갚지 않고 쌓인 누적 물량. 지속 증가=하락 압력, 호재와 함께 급감=숏커버링 폭등 가능.', '#fbbf24'],
            ['③ 대차잔고', '당일 확인', '공매도용으로 빌려간 주식(선행 지표). 대차잔고+공매도잔고 동시 증가 = 하락 위험 신호.', '#60a5fa'],
          ].map(([t, when, desc, c]) => (
            <div key={t as string} style={{ background: '#0f1117', borderRadius: 9, borderLeft: `3px solid ${c}`, padding: '9px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: c as string, fontWeight: 800, fontSize: 12 }}>{t}</span>
                <span style={{ color: '#7f93a8', fontSize: 9.5 }}>{when}</span>
              </div>
              <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.55, marginTop: 3 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.6 }}>
          ⓘ 데이터 경로: 🇺🇸 미국 = FINRA 격주 공시(자동) / 🇰🇷 한국 = KRX 공매도 통계(공식, 선생님 PC 수집기가 매일 장 마감 후 적재 — KRX가 로그인을 요구해 서버 직접 수집 불가). 한국 데이터 기준일이 하루 이상 오래됐다면 수집기 실행을 확인하세요.
        </div>
      </div>
    </div>
  )
}
