'use client'
// 🇺🇸 미국 스마트머니 — "큰돈은 지금 어디로 가나"를 한 화면에서. 탭 없이 위에서 아래로(시장 → 섹터 → 회사).
//   지금은 3번째 절(내부자 매수 스캐너)만 있다. 다른 절은 만들어지는 대로 위·아래에 붙는다 — 빈 자리에 '준비 중'을 넣지 않는다.
//   설계: docs/us-smart-money/plan.md · ⛔ 종합 점수·추천 없음(잣대가 다른 것을 합치면 가짜 정밀) · ⛔ 매도 신호 없음
import { useEffect, useState } from 'react'
import { LIMITS, WINDOW_DAYS, type InsiderMarket, type InsiderMarketItem } from '@/lib/insiderMarketShared'   // 순수 모듈 — 서버 전용 lib 를 클라이언트 번들에 끌어오지 않는다
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`
const md = (d: string) => d ? d.slice(5).replace('-', '/') : '—'

export default function UsSmartMoneyPage() {
  const [d, setD] = useState<InsiderMarket | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/insider-market', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setErr(String(j.error)); else setD(j) })
      .catch(() => { if (alive) setErr('내부자 매수 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    return () => { alive = false }
  }, [])

  const items = d ? (showAll ? d.items : d.items.slice(0, 7)) : []

  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SP.md }}>
      <div style={{ background: `linear-gradient(135deg,${TK.bg2},${TK.bg1})`, border: `1px solid ${TK.blue500}33`, borderRadius: RAD.md, padding: '16px 18px' }}>
        <div style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>🇺🇸 미국 스마트머니 — 큰돈은 지금 어디로 가나</div>
        <div style={{ fontSize: FS.tiny, color: TK.sub, marginTop: 4, lineHeight: 1.6 }}>
          미국 시장 <b>전체</b>의 공시·자금 흐름에서 &ldquo;누가 무엇을 사고 있나&rdquo;만 추립니다. 추천이 아니라 <b>출발점</b>입니다 — 여기서 고른 종목은 종목 리서치에서 다시 확인하세요.
        </div>
      </div>

      {err && <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {err}</div>}
      {!d && !err && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>지난 {WINDOW_DAYS}일 공시를 모으는 중…</div>}

      {d && (
        <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          {/* 질문 → 답 한 줄 — 학생이 읽는 첫 줄은 숫자 표가 아니라 문장이다 */}
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>🕵️ 회사를 제일 잘 아는 사람들이 사고 있는 회사는</div>
          <div style={{ fontSize: FS.body, color: TK.slate200, lineHeight: 1.6 }}>{d.summary}</div>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>
            SEC Form 4 · 거래일 {d.window.from} ~ {d.window.to} · 수집 완료 {d.window.daysComplete}일{d.window.daysPartial ? ` · 진행 중 ${d.window.daysPartial}일` : ''} · 장내매수 공시 {d.window.rawBuys.toLocaleString()}건 → 조건 통과 {d.window.candidates}곳{d.window.candidates > d.items.length ? ` → 표시 ${d.items.length}곳` : ''}
          </div>
          {d.partial && (
            <div style={{ background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.xs, padding: '7px 10px', fontSize: FS.tiny, color: TK.amber400, lineHeight: 1.6 }}>
              ⚠️ 아직 {WINDOW_DAYS}일 중 {d.window.daysComplete}일만 모였습니다 — 매시간 채워지는 중이라 목록이 늘어납니다. 지금 숫자로 결론 내리지 마세요.
            </div>
          )}

          {d.sectors.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: FS.tiny, color: TK.sub }}>어느 섹터에 몰렸나</span>
              {d.sectors.slice(0, 6).map(s => (
                <span key={s.sector} style={{ fontSize: FS.tiny, color: TK.slate200, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.pill, padding: '3px 10px' }}>{s.icon} {s.ko} <b>{s.count}</b></span>
              ))}
            </div>
          )}

          {d.items.length === 0 ? (
            <div style={{ background: TK.bg3, border: `1px dashed ${BORDER}`, borderRadius: RAD.sm, padding: '16px 14px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7 }}>
              조건(30일 합계 ${(LIMITS.minValue / 1000).toFixed(0)}K 이상 또는 시총의 {LIMITS.minMcapPct}% 이상, 또는 {LIMITS.cluster}명 이상)을 채운 종목이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
              {items.map(it => <InsiderCard key={it.ticker} it={it} />)}
              {d.items.length > 7 && (
                <button onClick={() => setShowAll(v => !v)} style={{ minHeight: 44, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, color: TK.slate300, fontSize: FS.tiny, fontWeight: 700, cursor: 'pointer' }}>
                  {showAll ? '상위 7개만 보기' : `나머지 ${d.items.length - 7}곳 더 보기`}
                </button>
              )}
            </div>
          )}

          <div style={{ fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.7, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            읽는 법 — 🔥 <b>함께 샀다</b>는 서로 다른 내부자 {LIMITS.cluster}명 이상이 각자 ${(LIMITS.minPerBuyer / 1000).toFixed(0)}K 넘게 자기 돈으로 장내매수한 회사(옵션 행사·보너스 주식·우리사주 소액 매수는 제외). 📉 <b>저가 근처</b>는 현재가가 52주 저가에서 +{LIMITS.nearLowPct}% 안. ✅ <b>추정치 상향</b>은 최근 30일 애널리스트 EPS 추정치가 상향 우세(노이즈 캔슬러와 같은 규칙). ⚠️ <b>적자</b>는 최근 4분기 EPS 가 마이너스.
            <br />기준($100K·시총 0.1%·2명·+15%)은 보고서의 값이며 <b>우리 표본으로 검증된 숫자가 아닙니다</b>. 내부자 매수는 통계적으로 우위가 보고된 지표지만 매도 신호는 없습니다(파는 이유는 수만 가지). 기관 수급은 무료 데이터가 없어 보지 않습니다. 단가가 공시에 없는 매수는 금액 합계에서 빠져 있습니다(표시: 단가 미상). 공시 단가와 현재가가 {LIMITS.maxGapPct}% 넘게 어긋나는 종목(해외 원주 단가로 적힌 ADR 등)은 금액을 믿을 수 없어 뺐습니다.
          </div>
        </section>
      )}
    </div>
  )
}

function InsiderCard({ it }: { it: InsiderMarketItem }) {
  const gapC = it.gapPct == null ? TK.sub3 : it.gapPct >= 0 ? TK.red400 : TK.blue400   // 🇰🇷 현재가가 평균 매수단가보다 위면 빨강(올랐다)
  return (
    <a href={`/research?q=${encodeURIComponent(it.ticker)}`} style={{ textDecoration: 'none', color: 'inherit', background: TK.bg3, border: `1px solid ${it.cluster ? `${TK.amber400}55` : BORDER}`, borderRadius: RAD.sm, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.body, color: TK.slate100 }}>{it.issuer}</b>
        <span style={{ fontSize: FS.tiny, color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{it.ticker}</span>
        {it.sectorKo && <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{it.sectorKo}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {it.cluster && <Badge c={TK.amber400}>🔥 함께 샀다 {it.buyers}명</Badge>}
          {it.nearLow && <Badge c={TK.cyan400}>📉 저가 근처</Badge>}
          {it.revision === 'up' && <Badge c={TK.green400}>✅ 추정치 상향</Badge>}
          {it.loss && <Badge c={TK.orange400}>⚠️ 적자</Badge>}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>   {/* 100px: 폰(카드 폭 ~260)에서 2열 유지 */}
        <Cell label="내부자 매수 합계" value={it.value > 0 ? usd(it.value) : '단가 미상'} sub={it.unpriced && it.value > 0 ? '+ 단가 미상 건' : it.mcapPct != null ? `시총의 ${it.mcapPct}%` : undefined} />
        <Cell label="누가" value={`${it.buyers}명`} sub={it.roles.join(' · ')} />
        <Cell label="평균 매수단가" value={it.avgPx != null ? `$${it.avgPx.toLocaleString()}` : '—'} sub={`${md(it.firstDate)}${it.firstDate !== it.lastDate ? `~${md(it.lastDate)}` : ''}`} />
        <Cell label="현재가" value={it.price != null ? `$${it.price.toLocaleString()}` : '—'} sub={it.gapPct != null ? `매수단가 대비 ${it.gapPct >= 0 ? '+' : ''}${it.gapPct}%` : undefined} c={gapC} />
      </div>
      {it.buys.length > 0 && (
        <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.6 }}>
          {it.buys.slice(0, 3).map((b, i) => <span key={i}>{i > 0 && ' · '}{b.owner}({b.role}) {b.unpriced ? '단가 미상' : usd(b.value)} {md(b.date)}</span>)}
        </div>
      )}
    </a>
  )
}

function Badge({ c, children }: { c: string; children: React.ReactNode }) {
  return <span style={{ fontSize: FS.micro, fontWeight: 700, color: c, border: `1px solid ${c}55`, borderRadius: RAD.pill, padding: '2px 8px', whiteSpace: 'nowrap' }}>{children}</span>
}
function Cell({ label, value, sub, c }: { label: string; value: string; sub?: string; c?: string }) {
  return (
    <div style={{ background: TK.bg0, borderRadius: RAD.xs, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{label}</span>
      <span style={{ fontSize: FS.lg, fontWeight: 700, color: c ?? TK.slate100, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <span style={{ fontSize: FS.micro, color: TK.sub }}>{sub}</span>}
    </div>
  )
}
