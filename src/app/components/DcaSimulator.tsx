'use client'
// 💧 적립식(DCA) 시뮬레이터 — "타이밍 말고 꾸준함" 증명. 10년 주봉 가격으로 정기 매수 vs 일시불 비교
import { useState, useMemo } from 'react'

const CARD = '#161b25', BORDER = '#1e293b'
const fmtMan = (won: number) => won >= 1e8 ? `${Math.round(won / 1e7) / 10}억` : `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`

export default function DcaSimulator({ points }: { points: { date: string; price: number }[] }) {
  const [amount, setAmount] = useState(5)        // 매 회 만원
  const [years, setYears] = useState(3)          // 적립 기간

  const r = useMemo(() => {
    if (points.length < 4) return null
    const cutoff = points[points.length - 1].date.slice(0, 4)
    const startYear = Number(cutoff) - years
    const pts = points.filter(p => Number(p.date.slice(0, 4)) >= startYear)
    if (pts.length < 4) return null
    const buys = pts.length
    const coinsPerUnit = pts.reduce((s, p) => s + 1 / p.price, 0)   // 단위금액당 누적 수량
    const latest = pts[pts.length - 1].price
    const dcaMult = (latest * coinsPerUnit) / buys                  // 현재가치/투자원금(단위 무관)
    const avgCostUsd = buys / coinsPerUnit                          // 가중 평균 매입가($)
    const lumpMult = latest / pts[0].price                         // 일시불(시작 시점 한 번에)
    const investedWon = amount * 1e4 * buys
    return {
      buys, investedWon, currentWon: investedWon * dcaMult,
      dcaRet: Math.round((dcaMult - 1) * 1000) / 10,
      lumpRet: Math.round((lumpMult - 1) * 1000) / 10,
      avgCostUsd: Math.round(avgCostUsd), startYr: pts[0].date.slice(0, 7),
    }
  }, [points, amount, years])

  if (!r) return null
  const win = r.dcaRet >= 0

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>💧 적립식(DCA) 시뮬레이터</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>타이밍 말고 꾸준함 — &lsquo;저점 매수&rsquo; 환상을 깨는 도구</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>정기</span>
          <input value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1))}
            style={{ width: 48, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 7px', color: '#e2e8f0', fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }} />
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>만원씩</span>
        </span>
      </div>
      {/* 기간 토글 */}
      <div style={{ display: 'inline-flex', gap: 4, background: '#0f1117', padding: 4, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 10 }}>
        {[1, 3, 5, 10].map(y => (
          <button key={y} type="button" onClick={() => setYears(y)}
            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, background: years === y ? '#1e293b' : 'transparent', color: years === y ? '#22c55e' : '#8599ae' }}>{y}년</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ color: '#8a9aaa', fontSize: 10 }}>투자 원금 ({r.buys}회 적립)</div>
          <div style={{ color: '#cbd5e1', fontWeight: 800, fontSize: 16, fontFamily: 'monospace' }}>{fmtMan(r.investedWon)}원</div>
        </div>
        <div style={{ flex: '1 1 150px', background: win ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${win ? '#22c55e44' : '#ef444444'}`, borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ color: '#8a9aaa', fontSize: 10 }}>현재 평가액</div>
          <div style={{ color: win ? '#4ade80' : '#f87171', fontWeight: 900, fontSize: 16, fontFamily: 'monospace' }}>{fmtMan(r.currentWon)}원 <span style={{ fontSize: 12 }}>({r.dcaRet >= 0 ? '+' : ''}{r.dcaRet}%)</span></div>
        </div>
        <div style={{ flex: '1 1 150px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ color: '#8a9aaa', fontSize: 10 }}>평균 매입가 ($)</div>
          <div style={{ color: '#cbd5e1', fontWeight: 800, fontSize: 16, fontFamily: 'monospace' }}>${r.avgCostUsd.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 9, padding: '9px 12px', color: '#dbe3ec', fontSize: 11, lineHeight: 1.7 }}>
        🎓 <b style={{ color: '#4ade80' }}>적립 vs 일시불</b> — {r.startYr}부터 정기 적립 시 <b>{r.dcaRet >= 0 ? '+' : ''}{r.dcaRet}%</b>, 같은 돈을 시작 시점에 한 번에 넣었다면 <b>{r.lumpRet >= 0 ? '+' : ''}{r.lumpRet}%</b>.{' '}
        {r.lumpRet > r.dcaRet + 5
          ? <>이 구간은 <b>일시불이 더 높습니다 — 시작점이 마침 저점이었기 때문</b>입니다. 하지만 &lsquo;그때가 바닥&rsquo;이란 건 <b>사후에만</b> 압니다. 적립은 저점을 못 맞혀도 변동성을 평균 매입가로 흡수해 <b>타이밍 리스크와 심리적 부담을 없애</b> 줍니다 — 꾸준함의 진짜 가치는 &lsquo;최고 수익&rsquo;이 아니라 &lsquo;실패하지 않는 지속&rsquo;에 있습니다.</>
          : r.dcaRet > r.lumpRet + 5
          ? <>이 구간은 <b>적립이 일시불보다도 높았습니다</b> — 고점 부근에서 시작했어도 하락 때 더 많이 사들여(평균 매입가 ${r.avgCostUsd.toLocaleString()}) 변동성을 오히려 수익으로 바꿨습니다. 타이밍을 못 맞혀도 꾸준함이 이깁니다.</>
          : <>둘이 비슷합니다. 핵심은 수익률 우열이 아니라, 적립은 <b>저점을 못 맞혀도 변동성을 평균가로 흡수</b>해 타이밍 리스크와 심리적 부담을 없앤다는 점입니다.</>}
      </div>
      <div style={{ color: '#8a9aaa', fontSize: 9.5, marginTop: 5 }}>※ 10년 주봉(약 2주 간격) 종가 기준 · 수수료·세금 미반영 · 과거 성과가 미래를 보장하지 않음 · 교육용.</div>
    </div>
  )
}
