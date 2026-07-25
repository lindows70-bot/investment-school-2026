'use client'
// 🐳 거인의 포트폴리오 — 전설적 투자자 9인의 13F 전체 보유 리스트(거인→종목 역방향 뷰). 기본 워런 버핏(버크셔).
import { useEffect, useState } from 'react'
import type { GuruPortfolioResult, GuruPosition } from '@/app/api/guru-portfolio/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const BUFFETT = '0001067983'

const ACT: Record<GuruPosition['action'], { ko: string; c: string; bg: string }> = {
  new:  { ko: '신규', c: TK.blue400,  bg: 'rgba(96,165,250,0.12)' },
  add:  { ko: '매집', c: TK.green400, bg: 'rgba(74,222,128,0.12)' },
  hold: { ko: '유지', c: TK.sub4,     bg: 'rgba(148,163,184,0.10)' },
  trim: { ko: '축소', c: TK.amber400, bg: 'rgba(251,191,36,0.12)' },
}
const fmtB = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`

export default function GuruPortfolioPage() {
  const [cik, setCik] = useState(BUFFETT)
  const [data, setData] = useState<GuruPortfolioResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    setData(null); setErr(false)
    fetch(`/api/guru-portfolio?cik=${cik}`).then(r => r.ok ? r.json() : Promise.reject()).then((d: GuruPortfolioResult) => {
      setData(d)                       // 에러여도 유지(셀렉터·메시지 표시용)
      if (d.status !== 'ok') setErr(true)
    }).catch(() => setErr(true))
  }, [cik])

  const funds = data?.funds ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>🐳 거인의 포트폴리오</div>
        <div style={{ fontSize: 12, color: TK.sub4, marginTop: 4, lineHeight: 1.6 }}>
          전설적 투자자들이 <b style={{ color: TK.slate200 }}>실제로 무엇을 들고 있는지</b>를 SEC 13F 공시로 봅니다.
          피터 린치: &ldquo;거인을 <b>복제</b>하지 말고, 거인이 <b>왜</b> 샀는지를 생각하라.&rdquo;
        </div>
      </div>

      {/* 거인 셀렉터 — 이번 캐시에 로드 안 된 거인(SEC 일시 지연)은 비활성화 */}
      {funds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {funds.map(f => {
            const on = cik === f.cik
            const off = !f.available && !on
            return (
              <button key={f.cik} disabled={off} onClick={() => setCik(f.cik)}
                title={off ? 'SEC 13F 일시 지연 — 잠시 후 다시 시도하면 활성화됩니다' : ''}
                style={{
                  padding: '6px 12px', borderRadius: 8, cursor: off ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700,
                  border: `1px solid ${on ? TK.amber400 : TK.border}`,
                  background: on ? `${TK.amber400}18` : 'transparent',
                  color: on ? TK.amber400 : off ? TK.sub2 : TK.sub4,
                  opacity: off ? 0.45 : 1,
                }}>{f.mgr}{off ? ' ⏳' : ''}</button>
            )
          })}
        </div>
      )}

      {err && (
        <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5, lineHeight: 1.6 }}>
          {data?.message ?? '13F 데이터를 불러오지 못했습니다'} — 위에서 <b style={{ color: TK.amber400 }}>다른 거인</b>을 선택해 보세요(⏳ 표시는 일시 지연).
        </div>
      )}
      {!data && !err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>🐳 SEC 13F 공시를 파싱하는 중… (첫 로드는 수십 초 걸릴 수 있어요)</div>}

      {data?.status === 'ok' && (
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: TK.slate100 }}>{data.mgr}</span>
            <span style={{ fontSize: 12.5, color: TK.sub4 }}>{data.fund}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: TK.sub4 }}>
              신고 총액 <b style={{ color: TK.slate200 }}>{fmtB(data.total)}</b> · {data.count}종목 · {data.asOf} 공시
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ color: TK.sub4, fontSize: 10.5 }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', width: 28 }}>#</th>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>종목(발행사)</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>비중</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>평가액</th>
              <th title="13F 공시일 종가 대비 현재 종가의 등락률 — 그 스냅샷 이후 주가가 얼마나 움직였나(거인의 실제 수익률 아님)."
                style={{ textAlign: 'right', padding: '4px 6px', cursor: 'help', borderBottom: `1px dotted ${TK.sub4}` }}>공시 후</th>
              <th title="🧮 추정 수익률 — 최근 약 2년(8분기) 13F를 역산해 '매집한 분기의 평균가'로 추정 평단을 구하고 현재가와 비교(사설 사이트와 동일 기법). 2년 이전부터 보유(애플·코카콜라 등)는 그 시절 매입가를 알 수 없어 '장기보유'로 표시."
                style={{ textAlign: 'right', padding: '4px 6px', cursor: 'help', borderBottom: `1px dotted ${TK.amber400}` }}>추정 수익</th>
              <th style={{ textAlign: 'center', padding: '4px 6px' }}>전분기</th>
            </tr></thead>
            <tbody>
              {data.positions.map((p, i) => (
                <tr key={p.name} style={{ borderTop: `1px solid ${TK.border}` }}>
                  <td style={{ padding: '6px 6px', color: TK.sub4, fontFamily: 'monospace' }}>{i + 1}</td>
                  <td style={{ padding: '6px 6px', color: TK.slate200, fontWeight: 700 }}>
                    {p.name}{p.ticker && <span style={{ color: TK.sub4, fontWeight: 600, fontSize: 10.5, marginLeft: 5 }}>{p.ticker}</span>}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: TK.slate200, fontWeight: 800 }}>{p.pctPort}%</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: TK.sub5 }}>{fmtB(p.value)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: p.retSinceFiling == null ? TK.sub2 : p.retSinceFiling >= 0 ? TK.green400 : TK.red400 }}>
                    {p.retSinceFiling == null ? '—' : `${p.retSinceFiling >= 0 ? '+' : ''}${p.retSinceFiling}%`}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 800 }}>
                    {p.estReturn != null ? (
                      <span title={p.estAvgPrice != null ? `추정 평단 $${p.estAvgPrice} (최근 매집분 역산)` : ''} style={{ color: p.estReturn >= 0 ? TK.green400 : TK.red400, cursor: 'help' }}>
                        {p.estReturn >= 0 ? '+' : ''}{p.estReturn}%
                      </span>
                    ) : p.longHeld ? (
                      <span title="2년 이전부터 보유 — 그 시절 매입가를 알 수 없어 추정 불가. 정밀 평단은 아래 전문 사이트에서." style={{ color: TK.sub3, fontWeight: 600, fontSize: 10, cursor: 'help' }}>장기보유</span>
                    ) : <span style={{ color: TK.sub2 }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                    <span title={p.deltaPct != null ? `전분기 대비 주식수 ${p.deltaPct > 0 ? '+' : ''}${p.deltaPct}%` : '이번 분기 신규 편입'}
                      style={{ fontSize: 10, fontWeight: 800, color: ACT[p.action].c, background: ACT[p.action].bg, borderRadius: 6, padding: '2px 7px', cursor: 'help' }}>
                      {ACT[p.action].ko}{p.deltaPct != null && (p.action === 'add' || p.action === 'trim') ? ` ${p.deltaPct > 0 ? '+' : ''}${p.deltaPct}%` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 🔗 정밀 평단(장기보유 포함 전 종목)은 전문 사이트로 — 우리보다 긴 13F 이력 보유 */}
      {data?.status === 'ok' && (
        <div style={{ ...CARD, background: TK.bg2, padding: '10px 14px', fontSize: 11.5, color: TK.sub5, lineHeight: 1.6 }}>
          🔗 <b style={{ color: TK.slate200 }}>장기보유 종목(애플·코카콜라 등)의 정밀 추정 평단</b>은 우리보다 긴 13F 이력을 가진 전문 사이트에서 확인하세요 —{' '}
          {data.cik === BUFFETT ? (<>
            <a href="https://stockcircle.com/portfolio/warren-buffett" target="_blank" rel="noopener noreferrer" style={{ color: TK.blue400 }}>Stockcircle</a>{' · '}
            <a href="https://www.gurufocus.com/guru/warren+buffett/current-portfolio/portfolio" target="_blank" rel="noopener noreferrer" style={{ color: TK.blue400 }}>GuruFocus</a>{' · '}
            <a href="https://whalewisdom.com/filer/berkshire-hathaway-inc" target="_blank" rel="noopener noreferrer" style={{ color: TK.blue400 }}>WhaleWisdom</a>
          </>) : (<>
            <a href="https://whalewisdom.com/" target="_blank" rel="noopener noreferrer" style={{ color: TK.blue400 }}>WhaleWisdom</a>{' · '}
            <a href="https://www.gurufocus.com/guru/list" target="_blank" rel="noopener noreferrer" style={{ color: TK.blue400 }}>GuruFocus</a>
          </>)}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
        ⚠️ <b>13F는 분기 종료 후 최대 45일 뒤 공시</b>됩니다 — 거인들의 &lsquo;현재&rsquo;가 아니라 <b>과거 스냅샷</b>입니다(그 사이 이미 바뀌었을 수 있음).
        13F는 <b>미국 상장 롱 포지션만</b> 담습니다(공매도·해외주식·현금·채권 제외) — 버크셔의 현금성 자산·일본 상사·비상장 자회사는 안 보입니다.
        <b style={{ color: TK.amber400 }}>두 수익률 모두 &lsquo;참고 추정치&rsquo;입니다</b> — <b>공시 후</b>는 공시일({data?.asOf ?? '—'}) 종가 대비 현재 등락(거인 실제수익 아님), <b>추정 수익</b>은 최근 약 2년 13F 매집분을 그 분기 평균가로 역산한 값(장외·특수계약 단가와 다를 수 있고, 2년 이전 매입은 &lsquo;장기보유&rsquo;로 추정 불가). 유명 대형주만 매핑됩니다.
        <b>거인을 맹목적으로 복제하지 말고, 그들이 본 가치를 스스로 확인하는 훈련</b>으로 쓰세요. 매수·매도 권유 아님.
      </div>
    </div>
  )
}
