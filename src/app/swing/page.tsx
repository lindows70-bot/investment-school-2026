'use client'
// 🎯 스윙 타점 — 1~2주 단기 매매. **대부분의 날은 비어 있는 화면**이다(647종 스캔에 1건).
//   그래서 목록이 아니라 "오늘 자리가 있나/없나"를 먼저 답하고, 없으면 그 이유를 말한다.
//   ⛔ 자동매매 없음 · ⛔ 목표 수익률 약속 없음 — edge 는 전부 '시장 대비'다.
import { useEffect, useState } from 'react'
import type { SwingRadar, SwingItem } from '@/lib/swingRadar'
import { SWING_TRACKS, positionSize, SWING_RISK_PCT, type SwingRegime } from '@/lib/swingSetup'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
const REGIME_KO: Record<SwingRegime, string> = { up: '상승', down: '하락', flat: '중립' }
const REGIME_C: Record<SwingRegime, string> = { up: TK.green400, down: TK.orange400, flat: TK.sub3 }

export default function SwingPage() {
  const [d, setD] = useState<SwingRadar | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [equity, setEquity] = useState(10_000_000)

  useEffect(() => {
    let alive = true
    fetch('/api/swing-radar', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setErr(j.note ?? j.error); else setD(j) })
      .catch(() => { if (alive) setErr('스윙 레이더를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SP.md }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,#101a14,${TK.bg1})`, border: `1px solid ${TK.green400}33`, borderRadius: RAD.md, padding: '16px 18px' }}>
        <div style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>🎯 스윙 타점 — 1~2주 짧게 먹고 나오기</div>
        <div style={{ fontSize: FS.tiny, color: TK.sub, marginTop: 4, lineHeight: 1.6 }}>
          중장기 원칙은 그대로 두고, <b style={{ color: TK.green400 }}>국면이 맞을 때만</b> 짧게 들어가는 별도 트랙입니다.
          우리 백테스트(KR40+US40·5년)가 <b>살아남는다고 확인한 두 가지</b>만 씁니다 —
          <b> 눌림목을 기다리는 형태는 세 번 재서 세 번 다 손해</b>라 넣지 않았습니다.
        </div>
      </div>

      {err && (
        <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {err}</div>
      )}
      {!d && !err && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>스윙 자리를 훑는 중…</div>
      )}

      {d && (
        <>
          {/* 🚦 국면 신호등 — 이 화면의 첫 질문에 답한다 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, marginBottom: 8 }}>🚦 지금 어느 기법의 자리인가</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: SP.sm }}>
              {Object.values(SWING_TRACKS).map(t => {
                const st = d.tracks.find(x => x.key === t.key)
                const idx = t.market === 'KR' ? d.indexRegime.KR : d.indexRegime.US
                const on = st?.on ?? false
                return (
                  <div key={t.key} style={{ background: on ? `${TK.green400}12` : TK.bg3, border: `1px solid ${on ? `${TK.green400}55` : BORDER}`, borderRadius: RAD.sm, padding: '11px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: FS.body }}>{t.icon}</span>
                      <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>{t.label}</b>
                      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{t.market === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'} · {REGIME_KO[t.regime]}장</span>
                      <span style={{ marginLeft: 'auto', fontSize: FS.micro, fontWeight: 800, color: on ? TK.green400 : TK.sub3 }}>{on ? '자리 있음' : '대기'}</span>
                    </div>
                    <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 5, lineHeight: 1.55 }}>{t.note}</div>
                    <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: 5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      시장 대비 <b style={{ color: TK.green400 }}>+{t.edgePp}%p</b> · 승률 {t.winRate}% · 표본 {t.sample}건 · 보유 {t.holdLabel}
                    </div>
                    <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: 4 }}>
                      지금 지수: <b style={{ color: idx ? REGIME_C[idx] : TK.sub3 }}>{idx ? `${REGIME_KO[idx]}장` : '확인 못 함'}</b>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 🎯 오늘의 자리 — 없는 게 기본이다 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>🎯 오늘의 자리</span>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{d.scanned}종 스캔 · 캔들 확보 {d.okCount}종</span>
            </div>

            {d.items.length === 0 ? (
              // ⚠️ 빈 화면이 이 기능의 기본값이다 — "없다"를 사실로 말하고 이유를 붙인다(억지로 채우면 유튜브가 된다)
              <div style={{ background: TK.bg3, border: `1px dashed ${BORDER}`, borderRadius: RAD.sm, padding: '16px 14px' }}>
                <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate300 }}>오늘은 자리가 없습니다</div>
                <div style={{ fontSize: FS.tiny, color: TK.sub2, marginTop: 6, lineHeight: 1.7 }}>
                  이건 고장이 아니라 <b>정상</b>입니다. 진입 조건이 &ldquo;오늘 처음 그 선을 되찾는 날&rdquo;이라 종목당 몇 달에 한 번 나옵니다
                  (백테스트에서도 5년·80종에 419건 — <b>종목당 연 1회꼴</b>).
                  <b> 기다리는 것이 이 기법의 일부</b>입니다.
                </div>
                <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {d.tracks.map(t => (
                    <div key={t.key} style={{ fontSize: FS.micro, color: TK.sub3 }}>
                      {SWING_TRACKS[t.key].icon} <b style={{ color: TK.sub2 }}>{SWING_TRACKS[t.key].label}</b> — {t.why}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
                {d.items.map(it => <SwingCard key={`${it.track}:${it.ticker}`} it={it} equity={equity} />)}
              </div>
            )}
          </div>

          {/* 💰 포지션 계산기 — 자리가 없는 날에도 쓰는 유일한 도구라 상시 노출 */}
          <div style={{ background: CARD, border: `1px solid ${TK.indigo400}33`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>💰 얼마나 살까 — 잃을 금액부터 정합니다</div>
            <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 4, lineHeight: 1.6 }}>
              수량을 먼저 정하지 않습니다. <b>한 번에 잃어도 되는 금액</b>(자산의 {SWING_RISK_PCT}%)을 정하고,
              손절까지의 거리로 나눠 수량을 역산합니다 — <b>손절폭이 넓은 종목은 자동으로 적게 사게</b> 됩니다.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>내 투자금</span>
              <input type="number" value={equity} onChange={e => setEquity(Math.max(0, Number(e.target.value) || 0))}
                style={{ background: TK.bg0, border: `1px solid ${BORDER}`, borderRadius: RAD.xs, padding: '6px 10px', color: TK.slate100, fontSize: FS.tiny, width: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>원 · 한 번에 잃을 금액 <b style={{ color: TK.orange400 }}>{Math.round(equity * SWING_RISK_PCT / 100).toLocaleString()}원</b></span>
            </div>
          </div>

          {/* 캐비엇 */}
          <div style={{ fontSize: FS.micro, color: TK.sub4, lineHeight: 1.75 }}>
            ⚠️ 위 <b>+%p는 &lsquo;시장 대비&rsquo;</b>입니다 — 같은 기간 시장이 0.8% 오를 때 그보다 그만큼 더 났다는 뜻이지,
            5~20% 수익을 뜻하지 않습니다. 승률·표본은 <b>그 표본·그 국면의 기록</b>이며 다음 거래를 보장하지 않습니다.
            <b> 세금·수수료·슬리피지는 반영돼 있지 않습니다</b>(단기매매에서 이 비용이 성적을 크게 깎습니다).
            ⛔ 체결·주문은 하지 않습니다 · ⛔ 손실 종목에 추가 매수(물타기)를 권하지 않습니다 · 교육용이며 투자 추천이 아닙니다.
          </div>
        </>
      )}
    </div>
  )
}

function SwingCard({ it, equity }: { it: SwingItem; equity: number }) {
  const t = SWING_TRACKS[it.track]
  const ps = positionSize(equity, it.price, it.stop)
  const cur = it.market === 'KR' ? '₩' : '$'
  const fmt = (n: number) => it.market === 'KR' ? Math.round(n).toLocaleString() : n.toFixed(2)
  return (
    <div style={{ background: TK.bg3, border: `1px solid ${TK.green400}44`, borderRadius: RAD.sm, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.tiny }}>{it.flag}</span>
        <b style={{ fontSize: FS.body, color: TK.slate100 }}>{it.name}</b>
        <span style={{ fontSize: FS.micro, color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{it.ticker}</span>
        {it.sector && <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{it.sector}</span>}
        <span style={{ marginLeft: 'auto', fontSize: FS.micro, fontWeight: 800, color: TK.green400 }}>{t.icon} {t.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 10 }}>
        <Cell label="지금 가격" value={`${cur}${fmt(it.price)}`} />
        <Cell label="손절선" value={`${cur}${fmt(it.stop)}`} sub={`−${it.stopPct}%`} c={TK.orange400} />
        <Cell label="보유 기간" value={t.holdLabel} sub={`${t.holdBars}거래일`} />
        <Cell label="이 기법 성적" value={`+${t.edgePp}%p`} sub={`승률 ${t.winRate}% · ${t.sample}건`} c={TK.green400} />
      </div>

      {ps && (
        <div style={{ marginTop: 9, background: TK.bg0, borderRadius: RAD.xs, padding: '8px 11px', fontSize: FS.micro, color: TK.sub2, lineHeight: 1.6 }}>
          💰 투자금 {equity.toLocaleString()}원 기준 — <b style={{ color: TK.slate200 }}>{ps.qty.toLocaleString()}주</b>
          <span style={{ color: TK.sub3 }}> (약 {ps.positionValue.toLocaleString()}{it.market === 'KR' ? '원' : '달러'} · 손절 시 손실 {ps.riskAmount.toLocaleString()}원 = 투자금의 {SWING_RISK_PCT}%)</span>
        </div>
      )}

      <ul style={{ margin: '9px 0 0', paddingLeft: 17, fontSize: FS.micro, color: TK.sub2, lineHeight: 1.7 }}>
        {it.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <a href={`/research?q=${encodeURIComponent(it.ticker)}`}
          style={{ fontSize: FS.micro, fontWeight: 700, color: TK.amber400, textDecoration: 'none', background: `${TK.amber500}18`, border: `1px solid ${TK.amber500}44`, borderRadius: RAD.xs, padding: '3px 8px' }}>
          🎯 종합 판정으로 한 번 더 보기
        </a>
      </div>
    </div>
  )
}

function Cell({ label, value, sub, c }: { label: string; value: string; sub?: string; c?: string }) {
  return (
    <div style={{ background: TK.bg0, borderRadius: RAD.xs, padding: '7px 10px' }}>
      <div style={{ fontSize: FS.micro, color: TK.sub4 }}>{label}</div>
      <div style={{ fontSize: FS.tiny, fontWeight: 800, color: c ?? TK.slate200, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: FS.micro, color: TK.sub3 }}>{sub}</div>}
    </div>
  )
}
