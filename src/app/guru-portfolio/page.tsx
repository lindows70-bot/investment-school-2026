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
const fmtSh = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M주` : `${Math.round(v / 1e3)}K주`

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
              <th title="⚠️ 거인의 실제 수익률이 아닙니다 — 13F 공시일 종가 대비 현재 종가의 등락률(그 스냅샷 이후 주가가 얼마나 움직였나). 거인의 진짜 매입단가는 13F에 없어 알 수 없습니다."
                style={{ textAlign: 'right', padding: '4px 6px', cursor: 'help', borderBottom: `1px dotted ${TK.sub4}` }}>공시 후</th>
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

      <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
        ⚠️ <b>13F는 분기 종료 후 최대 45일 뒤 공시</b>됩니다 — 거인들의 &lsquo;현재&rsquo;가 아니라 <b>과거 스냅샷</b>입니다(그 사이 이미 바뀌었을 수 있음).
        13F는 <b>미국 상장 롱 포지션만</b> 담습니다(공매도·해외주식·현금·채권 제외) — 버크셔의 애플·현금성 자산처럼 실제 자산의 일부만 보이는 점에 유의하세요.
        발행사명만 공시돼(티커·CUSIP은 유료 데이터) 종목명으로 표시하며, 유명 대형주만 티커·수익률을 매핑합니다(나머지 &lsquo;—&rsquo;).
        <b style={{ color: TK.amber400 }}>&lsquo;공시 후&rsquo;는 거인의 실제 수익률이 아닙니다</b> — 13F엔 매입단가가 없어 공시일({data?.asOf ?? '—'}) 종가 대비 <b>현재까지 주가 등락률</b>일 뿐입니다(버핏은 수십 년 전 훨씬 싼 값에 샀을 수 있음).
        <b>거인을 맹목적으로 복제하지 말고, 그들이 본 가치를 스스로 확인하는 훈련</b>으로 쓰세요. 매수·매도 권유 아님.
      </div>
    </div>
  )
}
