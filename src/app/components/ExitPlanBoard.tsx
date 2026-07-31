'use client'
// 🚪 출구 플랜 보드 — 보유 종목별 매도 계획(매수 플랜 카드의 거울)
// 두 참고선(🛎️ 이익 보호선=샹들리에 · 🛡️ 최후 방어선=구름 하단) + 매도 압력 신호 + 결정론 행동 한 줄.
// ⛔ 매도 지시 아님(참고선·교육) · 저점 매도 강요 금지 · 자동매매 없음.
import { useState, useEffect } from 'react'
import { TK } from '@/lib/theme'
import type { ExitPlanItem } from '@/lib/exitPlan'

interface Api { asOf: string; items: ExitPlanItem[]; skipped: string[] }

const fmtP = (v: number, mkt: 'KR' | 'US') =>
  mkt === 'KR' ? `₩${Math.round(v).toLocaleString()}` : `$${v.toFixed(2)}`

export default function ExitPlanBoard() {
  const [data, setData] = useState<Api | null>(null)
  const [open, setOpen] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/exit-plan').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.items) setData(j); else setErr(true) })
      .catch(() => setErr(true))
  }, [])

  if (err || (data && data.items.length === 0)) return null
  if (!data) return (
    <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: 12, background: TK.slate900, border: `1px solid ${TK.border}`, fontSize: 11, color: TK.sub2 }}>
      🚪 출구 플랜 계산 중…
    </div>
  )

  const alerted = data.items.filter(i => i.signals.length > 0)

  const Line = ({ icon, label, line, distPct, broken, mkt, tip }: {
    icon: string; label: string; line: number | null; distPct: number | null; broken: boolean; mkt: 'KR' | 'US'; tip: string
  }) => line == null ? null : (
    <span title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, whiteSpace: 'nowrap' }}>
      <span>{icon}</span>
      <span style={{ color: TK.sub2 }}>{label}</span>
      <b style={{ color: TK.slate200, fontFamily: 'monospace' }}>{fmtP(line, mkt)}</b>
      <b style={{ color: broken ? TK.red400 : TK.green400, fontFamily: 'monospace' }}>
        {broken ? `이탈(${distPct}%)` : `+${distPct}% 위`}
      </b>
    </span>
  )

  return (
    <div style={{ margin: '14px 0', borderRadius: 12, background: TK.slate900, border: `1px solid ${TK.border}`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 15 }}>🚪</span>
        <b style={{ fontSize: 12.5, color: TK.slate100 }}>출구 플랜 — 보유 종목 매도 계획</b>
        {alerted.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 800, color: TK.amber400, background: '#78350f33', border: `1px solid ${TK.amber400}55`, borderRadius: 6, padding: '2px 7px' }}>
            매도 압력 신호 {alerted.length}종목
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: TK.sub2 }}>{data.asOf} · {open ? '접기 ▴' : '펼치기 ▾'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.6, padding: '0 4px' }}>
            매수엔 플랜(1%룰·분할)이 있듯 매도에도 계획이 필요합니다. 종목마다 두 참고선 —
            <b style={{ color: TK.slate300 }}> 🛎️ 이익 보호선</b>(22봉 고점−3×ATR·샹들리에 — 번 것을 지키는 선)과
            <b style={{ color: TK.slate300 }}> 🛡️ 최후 방어선</b>(일목 구름 하단 — 깨지면 장기 구조 붕괴)을 기준으로 대응합니다.
          </div>

          {data.items.map(it => {
            const lightC = it.light === 'green' ? TK.green400 : it.light === 'red' ? TK.red400 : TK.amber400
            const pnlC = it.pnlPct >= 0 ? TK.green400 : TK.red400
            return (
              <div key={it.ticker} style={{ borderRadius: 10, background: TK.slate950, border: `1px solid ${it.signals.length >= 2 ? `${TK.amber400}66` : TK.border}`, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 12, color: TK.slate100 }}>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'} {it.name}</b>
                  <span style={{ fontSize: 10, color: TK.sub, fontFamily: 'monospace', fontWeight: 700 }}>{it.ticker}</span>
                  <b style={{ fontSize: 11, color: pnlC, fontFamily: 'monospace' }}>{it.pnlPct >= 0 ? '+' : ''}{it.pnlPct}%</b>
                  <span style={{ fontSize: 9.5, color: lightC, border: `1px solid ${lightC}55`, borderRadius: 5, padding: '1px 6px' }}>
                    {it.light === 'green' ? '구조 양호' : it.light === 'red' ? '구조 붕괴' : it.defBroken ? '구조 약화' : '구조 중립'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: TK.sub2, fontFamily: 'monospace' }}>종가 {fmtP(it.price, it.market)}</span>
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                  <Line icon="🛎️" label="이익 보호선" line={it.protLine} distPct={it.protDistPct} broken={it.protBroken} mkt={it.market}
                    tip="샹들리에 스탑(22봉 최고가 − 3×ATR22, 표준 파라미터). 수익 중일 때 '번 것을 지키는' 트레일링 참고선 — 이탈하면 분할 익절 검토." />
                  <Line icon="🛡️" label="최후 방어선" line={it.defLine} distPct={it.defDistPct} broken={it.defBroken} mkt={it.market}
                    tip="일목 구름 하단. 여기까지 깨지면 장기 추세 구조가 무너진 것 — 반등 시 비중 축소를 검토하는 선." />
                </div>

                {it.signals.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                    {it.signals.map((s, i) => (
                      <span key={i} title={s.detail} style={{ fontSize: 9.5, fontWeight: 700, color: TK.amber400, background: '#78350f22', border: `1px solid ${TK.amber400}44`, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {s.icon} {s.label}
                      </span>
                    ))}
                    {it.fund === 'BUY' && (
                      <span title="Jarvis 펀더멘탈 진단은 매수 기회 — 기술 신호는 단기 경계 참고(펀더 멀쩡한 하락에 저점 매도 주의)"
                        style={{ fontSize: 9.5, fontWeight: 700, color: TK.green400, background: '#14532d22', border: `1px solid ${TK.green400}44`, borderRadius: 5, padding: '2px 6px' }}>
                        🟢 펀더 매수기회
                      </span>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 7, fontSize: 11, color: TK.slate300, lineHeight: 1.55 }}>
                  <b style={{ color: it.signals.length >= 2 ? TK.amber400 : TK.sub }}>→ </b>{it.action}
                </div>
              </div>
            )
          })}

          <div style={{ fontSize: 9.5, color: TK.sub2, lineHeight: 1.6, padding: '2px 4px' }}>
            ⛔ 매도 지시가 아니라 참고선·신호 집계입니다(자동매매 없음). 참고선은 매일 갱신되는 트레일링 값이며,
            펀더멘탈이 멀쩡한 하락은 변동성일 수 있습니다 — 무서워서 파는 건 손실 확정(영구손실 vs 변동성 구분).
            {data.skipped.length > 0 && ` · 데이터 부족 생략: ${data.skipped.join(', ')}`}
          </div>
        </div>
      )}
    </div>
  )
}
