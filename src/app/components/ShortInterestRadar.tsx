'use client'
// 📉 공매도 레이더 — 보유 US 종목 공매도 잔고·커버일수·유통비중(Yahoo 실데이터) + KR 3대 지표 교육(무료 소스 부재 정직 고지)
import { useState, useEffect } from 'react'
import type { ShortInterestResult, ShortEntry } from '@/app/api/short-interest/route'

const CARD = '#12151c', BORDER = '#252a36'
const SIG: Record<ShortEntry['signal'], { ko: string; color: string; tip: string }> = {
  heavy: { ko: '🔴 숏 과다', color: '#f87171', tip: '유통주식 10%+ 공매도 — 하락 베팅이 매우 큼(악재 취약, 단 스퀴즈 연료이기도)' },
  squeeze: { ko: '🟣 스퀴즈 잠재', color: '#a855f7', tip: '유통 5%+ & 커버 5일+ — 호재 시 숏커버링(되사기)이 급등을 증폭할 수 있는 구조' },
  rising: { ko: '🟠 숏 증가', color: '#fb923c', tip: '전월 대비 공매도 잔고 +15% 이상 급증 — 세력의 하락 베팅 강화' },
  calm: { ko: '🟢 평온', color: '#4ade80', tip: '공매도 압력이 낮은 상태' },
}
const fmtShares = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억주` : n >= 1e4 ? `${(n / 1e4).toFixed(0)}만주` : `${n}주`)

export default function ShortInterestRadar() {
  const [d, setD] = useState<ShortInterestResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'noauth' | 'err'>('loading')

  useEffect(() => {
    fetch('/api/short-interest', { cache: 'no-store' })
      .then(r => (r.status === 401 ? (setState('noauth'), null) : r.json()))
      .then(x => { if (x?.entries) { setD(x); setState('ok') } })
      .catch(() => setState('err'))
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
          ⚠️ <b style={{ color: '#cdd6e3' }}>정직 고지</b>: 한국 종목별 공매도 수치는 현재 무료·무인증 API가 없습니다(네이버 공매도 탭 폐지·KRX 정보데이터시스템 로그인 게이트 — 실측 확인). 한국 종목은 <b style={{ color: '#cdd6e3' }}>KRX 정보데이터시스템(data.krx.co.kr) → 통계 → 공매도 통계</b> 또는 증권사 MTS의 &lsquo;공매도 추이&rsquo; 메뉴에서 직접 확인하세요. 미국 종목은 위 표에서 자동 제공됩니다.
        </div>
      </div>
    </div>
  )
}
