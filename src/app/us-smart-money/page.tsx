'use client'
// 🇺🇸 미국 스마트머니 — "큰돈은 지금 어디로 가나"를 한 화면에서. 탭 없이 위에서 아래로(시장 → 섹터 → 회사).
//   지금은 3번째 절(내부자 매수 스캐너)만 있다. 다른 절은 만들어지는 대로 위·아래에 붙는다 — 빈 자리에 '준비 중'을 넣지 않는다.
//   설계: docs/us-smart-money/plan.md · ⛔ 종합 점수·추천 없음(잣대가 다른 것을 합치면 가짜 정밀) · ⛔ 매도 신호 없음
import { useEffect, useState } from 'react'
import { LIMITS, WINDOW_DAYS, type InsiderMarket, type InsiderMarketItem } from '@/lib/insiderMarketShared'   // 순수 모듈 — 서버 전용 lib 를 클라이언트 번들에 끌어오지 않는다
import type { UsLiquidity, Gauge, Tone } from '@/lib/usLiquidity'   // type-only — 번들에 안 실린다
import type { EtfFlow, EtfFlowItem } from '@/lib/etfFlow'
import type { AnalystRerating, ReratingItem } from '@/lib/analystRerating'
import type { gradeUsm } from '@/lib/usSmartHistory'
type UsmRecord = Awaited<ReturnType<typeof gradeUsm>>
import { TK, FS, RAD, SP } from '@/lib/theme'

const TONE_C: Record<Tone, string> = { good: TK.green400, warn: TK.amber400, bad: TK.orange400, neutral: TK.slate300 }

const CARD = TK.card, BORDER = TK.border
const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`
/** 그룹 합계가 일부만 더해진 경우에만 '(3/11개)' 를 붙인다 — 전부면 군더더기 */
const partOf = (of: string | null) => { if (!of) return ''; const [n, tot] = of.split('/'); return n === tot ? '' : ` (${n}/${tot}개)` }
const md = (d: string) => d ? d.slice(5).replace('-', '/') : '—'

export default function UsSmartMoneyPage() {
  const [d, setD] = useState<InsiderMarket | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [liq, setLiq] = useState<UsLiquidity | null>(null)
  const [liqErr, setLiqErr] = useState<string | null>(null)
  const [flow, setFlow] = useState<EtfFlow | null>(null)
  const [flowErr, setFlowErr] = useState<string | null>(null)
  const [an, setAn] = useState<AnalystRerating | null>(null)
  const [anErr, setAnErr] = useState<string | null>(null)
  const [rec, setRec] = useState<UsmRecord | null>(null)

  useEffect(() => {
    let alive = true
    // 절마다 따로 부른다 — 한 절이 느려도 다른 절이 먼저 뜬다(상태 3종은 각 절의 가드 안에서 확정)
    fetch('/api/us-liquidity', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setLiqErr(String(j.error)); else setLiq(j) })
      .catch(() => { if (alive) setLiqErr('유동성 지표를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    fetch('/api/etf-flow', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setFlowErr(String(j.error)); else setFlow(j) })
      .catch(() => { if (alive) setFlowErr('ETF 자금 흐름을 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    fetch('/api/analyst-rerating', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setAnErr(j.note ?? String(j.error)); else setAn(j) })
      .catch(() => { if (alive) setAnErr('애널리스트 리레이팅을 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    // 성적표는 실패해도 화면의 다른 절을 막지 않는다(없으면 섹션 자체가 안 뜬다)
    fetch('/api/usm-record', { cache: 'no-store' }).then(r => r.json()).then(j => { if (alive && !j.error) setRec(j) }).catch(() => { /* 조용히 생략 */ })
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

      {/* ── 절 1 · 지금 돈이 풀리고 있나, 마르고 있나 (기존 SSOT 조립) ── */}
      {liqErr && <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {liqErr}</div>}
      {!liq && !liqErr && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>유동성 지표를 모으는 중…</div>}
      {liq && <LiquiditySection q={liq} />}

      {/* ── 절 2 · 돈이 어느 섹터로 가고 있나 (ETF 순자산 스냅샷 역산 — 첫 1주는 값의 흐름만) ── */}
      {flowErr && <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {flowErr}</div>}
      {!flow && !flowErr && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>ETF 자금 흐름을 계산하는 중…</div>}
      {flow && <FlowSection f={flow} />}

      {/* ── 절 3 · 회사를 제일 잘 아는 사람들이 사고 있는 회사는 ── */}
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
            읽는 법 — 🔥 <b>함께 샀다</b>는 서로 다른 <b>경영진·이사</b> {LIMITS.cluster}명 이상이 각자 ${(LIMITS.minPerBuyer / 1000).toFixed(0)}K 넘게 자기 돈으로 장내매수한 회사(옵션 행사·보너스 주식·우리사주 소액 매수는 제외 · 10% 주주·펀드는 금액엔 넣되 인원엔 안 셉니다 — 같은 운용사 펀드 둘이 2명으로 세어지는 걸 막기 위해). 같은 사람·같은 날·같은 주식수의 재제출은 한 건으로. 📉 <b>저가 근처</b>는 현재가가 52주 저가에서 +{LIMITS.nearLowPct}% 안. ✅ <b>추정치 상향</b>은 최근 30일 애널리스트 EPS 추정치가 상향 우세(노이즈 캔슬러와 같은 규칙). ⚠️ <b>적자</b>는 최근 4분기 EPS 가 마이너스.
            <br />기준($100K·시총 0.1%·2명·+15%)은 보고서의 값이며 <b>우리 표본으로 검증된 숫자가 아닙니다</b>. 내부자 매수는 통계적으로 우위가 보고된 지표지만 매도 신호는 없습니다(파는 이유는 수만 가지). 기관 수급은 무료 데이터가 없어 보지 않습니다. 단가가 공시에 없는 매수는 금액 합계에서 빠져 있습니다(표시: 단가 미상). 공시 단가와 현재가가 {LIMITS.maxGapPct}% 넘게 어긋나는 종목(해외 원주 단가로 적힌 ADR 등)은 금액을 믿을 수 없어 뺐습니다.
          </div>
        </section>
      )}

      {/* ── 절 4 · 전문가들이 마음을 바꾼 회사는 (등급 상향 3곳↑ × EPS 리비전 — TipRanks 대신 노이즈 캔슬러 규칙) ── */}
      {anErr && <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {anErr}</div>}
      {!an && !anErr && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>애널리스트 등급 변경을 훑는 중…</div>}
      {an && <ReratingSection a={an} />}

      {/* ── 📋 이 화면의 실제 성적 — 목록을 보여주는 이상 학생은 추천으로 읽는다. 그러면 성적도 함께 보여야 정직하다 ── */}
      {rec && <RecordSection r={rec} />}
    </div>
  )
}

/** 📋 적립 성적 — 스윙 성적표와 같은 관례: 소급 없음 · 진입가는 등재일 완성 종가 · 표본 10건·2주 미만이면 '참고용' */
function RecordSection({ r }: { r: UsmRecord }) {
  const all = r.grades.filter(g => g.src === 'all')
  if (!all.length) return null
  const lab: Record<string, string> = { insider: '🕵️ 내부자 클러스터', rerating: '🎧 진짜 리레이팅', all: '📋 전체' }
  const started = all[0].firstDate
  const pending = all[0].pending
  const scored = all.some(g => g.n > 0)
  return (
    <section style={{ background: CARD, border: `1px solid ${TK.indigo400}33`, borderRadius: RAD.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>📋 이 화면에 오른 종목의 실제 성적</span>
        <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{started ? `${started}부터 적립 중` : '아직 적립 이력이 없습니다'} · 소급 채점 없음</span>
      </div>
      <div style={{ fontSize: FS.tiny, color: TK.sub, lineHeight: 1.6 }}>
        진입가는 <b>목록에 오른 날의 완성 종가</b>입니다(장중가 아님). 매도 신호가 없는 화면이라 손절 채점도 없고, 같은 기간 <b>시장(SPY)</b>과의 차이(초과분)를 함께 잽니다 — 오른 게 이 신호 덕인지 장 덕인지 갈라야 하니까요.
      </div>
      {!scored ? (
        <div style={{ background: TK.bg3, border: `1px dashed ${BORDER}`, borderRadius: RAD.sm, padding: '14px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7 }}>
          {pending > 0
            ? <>지금 <b>{pending}건</b>이 기간을 채우는 중입니다 — 20거래일(약 한 달)이 지나야 첫 숫자가 나옵니다. <b>아직 숫자를 말할 수 없습니다.</b></>
            : <>적립을 막 시작했습니다. 내일 크론부터 하나씩 쌓입니다.</>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          {r.grades.filter(g => g.n > 0 || g.pending > 0).map(g => (
            <div key={`${g.src}-${g.bars}`} style={{ background: TK.bg3, borderRadius: RAD.sm, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{lab[g.src]} · {g.bars}거래일</span>
              {g.n === 0 ? <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>{g.pending}건 기간 미경과</span> : (<>
                <span style={{ fontSize: FS.xl, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: g.thin ? TK.sub3 : (g.edgePp ?? 0) > 0 ? TK.green400 : TK.orange400 }}>
                  {g.edgePp == null ? '—' : `${g.edgePp > 0 ? '+' : ''}${g.edgePp}%p`}
                </span>
                <span style={{ fontSize: FS.micro, color: TK.sub }}>시장 대비 · 평균 {g.avgPct}% vs 시장 {g.benchAvgPct}% · 승률 {g.winRate}% · {g.n}건{g.pending ? ` (+${g.pending} 진행)` : ''}</span>
                {g.thin && <span style={{ fontSize: FS.micro, color: TK.amber400 }}>⚠️ 표본 {g.n}건·{g.cohorts}개 주 — 통계가 아니라 기록입니다</span>}
              </>)}
            </div>
          ))}
        </div>
      )}
      {r.recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>최근 적립 — 승률만 보지 말고 개별 건을 확인하세요</span>
          {r.recent.slice(0, 6).map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: TK.bg0, borderRadius: RAD.xs, padding: '6px 10px', fontSize: FS.tiny }}>
              <span style={{ color: TK.sub3, width: 44 }}>{x.date.slice(5)}</span>
              <span>{x.src === 'insider' ? '🕵️' : '🎧'}</span>
              <b style={{ color: TK.slate100 }}>{x.name}</b>
              <span style={{ color: TK.sub3, fontSize: FS.micro }}>{x.note}</span>
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: x.retPct == null ? TK.sub3 : x.retPct >= 0 ? TK.red400 : TK.blue400 }}>
                {x.retPct == null ? '—' : `${x.retPct >= 0 ? '+' : ''}${x.retPct}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** 절 4 — 진짜 리레이팅 / 목표가 소음 / 무더기 하향 세 묶음. 별점·승률(유료)은 없고, 그 자리를 '실적 전망이 같이 올랐나'가 맡는다. */
function ReratingSection({ a }: { a: AnalystRerating }) {
  const [showAll, setShowAll] = useState(false)
  const groups: { key: ReratingItem['verdict']; title: string; c: string; note: string }[] = [
    { key: 'rerating', title: '✅ 진짜 리레이팅', c: TK.green400, note: '증권사 3곳 이상 상향 + EPS 추정치 상향 우세 + 목표가 여력 15% 이상' },
    { key: 'noise', title: '🎧 목표가만 오른 소음', c: TK.amber400, note: '등급은 올렸는데 실적 추정치는 안 오르거나 여력이 작음 — 린치: 목표가는 소음, 실적이 신호' },
    { key: 'downgrade', title: '⬇️ 무더기 하향', c: TK.orange400, note: '증권사 3곳 이상이 30일 안에 등급을 내림' },
  ]
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>🎧 전문가들이 마음을 바꾼 회사는</div>
      <div style={{ fontSize: FS.body, color: TK.slate200, lineHeight: 1.6 }}>{a.answer}</div>
      <div style={{ fontSize: FS.micro, color: TK.sub3 }}>Yahoo 등급 변경 이력·EPS 추정치 · 미국 {a.scanned}종 스캔(주간 유니버스 + 내부자 통과 종목) · 조회 성공 {a.okCount}종 · 최근 30일</div>
      {groups.map(g => {
        const rows = a.items.filter(i => i.verdict === g.key)
        if (!rows.length) return null
        const shown = showAll || g.key !== 'noise' ? rows.slice(0, showAll ? rows.length : 7) : rows.slice(0, 3)
        return (
          <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: FS.tiny, color: g.c }}>{g.title} {rows.length}곳</b>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{g.note}</span>
            </div>
            {shown.map(i => (
              <a key={i.ticker} href={`/research?q=${encodeURIComponent(i.ticker)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: TK.bg3, border: `1px solid ${g.c}33`, borderRadius: RAD.sm, padding: '8px 12px', fontSize: FS.tiny }}>
                <b style={{ color: TK.slate100, fontSize: FS.body }}>{i.name}</b>
                <span style={{ color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: FS.micro }}>{i.ticker}</span>
                {i.sectorKo && <span style={{ color: TK.sub3, fontSize: FS.micro }}>{i.sectorKo}</span>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: TK.slate200 }}>상향 <b>{i.upgrades}</b>곳{i.downgrades ? ` · 하향 ${i.downgrades}` : ''}</span>
                  <span style={{ color: i.revision === 'up' ? TK.green400 : i.revision === 'down' ? TK.orange400 : TK.sub }}>추정치 {i.revUp ?? '—'}↑ {i.revDown ?? '—'}↓</span>
                  {i.upsidePct != null && <span style={{ color: TK.slate200 }}>목표가 ${i.target?.toFixed(2)} · 여력 <b style={{ color: i.upsidePct >= 0 ? TK.red400 : TK.blue400 }}>{i.upsidePct >= 0 ? '+' : ''}{i.upsidePct}%</b></span>}
                </span>
                {i.firms.length > 0 && <span style={{ width: '100%', fontSize: FS.micro, color: TK.sub }}>{i.firms.join(' · ')}</span>}
              </a>
            ))}
          </div>
        )
      })}
      {a.items.length > 10 && (
        <button onClick={() => setShowAll(v => !v)} style={{ minHeight: 44, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, color: TK.slate300, fontSize: FS.tiny, fontWeight: 700, cursor: 'pointer' }}>{showAll ? '접기' : '전부 보기'}</button>
      )}
      <div style={{ fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.7, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        보고서가 요구한 애널리스트 별점·승률(TipRanks)은 유료라 보지 못합니다. 그 자리를 <b>실적 전망이 같이 올랐나</b>가 맡습니다 — 목표가는 소음이고 실적 추정치가 신호라는 앱의 노이즈 캔슬러 규칙 그대로입니다. 3곳·15% 는 보고서의 값이며 우리 표본으로 검증된 숫자가 아닙니다. 상향 이유(실적·신제품·마진·M&A)는 무료 데이터에 없어 태깅하지 않습니다.
      </div>
    </section>
  )
}

/** 절 1 — 질문 하나·답 한 줄·계기판 5개·계절이 말하는 유리/불리 섹터·교차 자산 사실 3줄. 확률 시나리오는 없다(가짜 정밀). */
function LiquiditySection({ q }: { q: UsLiquidity }) {
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>💧 지금 돈이 풀리고 있나, 마르고 있나</div>
      <div style={{ fontSize: FS.body, color: TK.slate200, lineHeight: 1.6 }}>{q.answer}</div>
      {q.weather && <div style={{ fontSize: FS.tiny, color: TK.sub, lineHeight: 1.6 }}>{q.weather.advice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
        {q.gauges.map(g => <GaugeCard key={g.key} g={g} />)}
      </div>
      {q.missing.length > 0 && <div style={{ fontSize: FS.micro, color: TK.amber400 }}>못 구한 지표: {q.missing.join(' · ')} — 빈 칸은 빈 칸으로 둡니다.</div>}

      {q.season && (
        <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: FS.tiny, color: TK.sub }}>이 국면에서 유리한 곳·불리한 곳 — <b style={{ color: TK.slate200 }}>미국 4계절 {q.season.ko}</b> 기준(앱의 계절 SSOT, 새 판정 아님)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: FS.tiny, color: TK.green400, fontWeight: 700 }}>유리</span>
            {q.season.favored.map(s => <span key={s.sector} style={{ fontSize: FS.tiny, color: TK.slate200, background: TK.bg1, border: `1px solid ${TK.green400}44`, borderRadius: RAD.pill, padding: '3px 10px' }}>{s.icon} {s.ko}</span>)}
            <span style={{ fontSize: FS.tiny, color: TK.orange400, fontWeight: 700, marginLeft: 6 }}>불리</span>
            {q.season.unfavored.map(s => <span key={s.sector} style={{ fontSize: FS.tiny, color: TK.slate200, background: TK.bg1, border: `1px solid ${TK.orange400}44`, borderRadius: RAD.pill, padding: '3px 10px' }}>{s.icon} {s.ko}</span>)}
          </div>
          <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.55 }}>{q.season.guide}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {q.cross.map(c => (
          <div key={c.label} style={{ flex: '1 1 160px', background: TK.bg0, borderRadius: RAD.xs, padding: '7px 10px' }}>
            <div style={{ fontSize: FS.micro, color: TK.sub3 }}>{c.label} · 4주</div>
            {/* 🇰🇷 등락 색 — 자산 가격 변화라 빨강↑ 파랑↓ */}
            <div style={{ fontSize: FS.lg, fontWeight: 700, color: c.chg4wPct == null ? TK.sub3 : c.chg4wPct >= 0 ? TK.red400 : TK.blue400, fontVariantNumeric: 'tabular-nums' }}>{c.chg4wPct == null ? '—' : `${c.chg4wPct >= 0 ? '+' : ''}${c.chg4wPct}%`}</div>
            <div style={{ fontSize: FS.micro, color: TK.sub }}>{c.note}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3 }}>출처 {q.sources.join(' · ')} · 판정은 앱의 매크로 날씨·수익률곡선·4계절 SSOT 와 같은 값 · 3개월 확률 시나리오는 근거가 없어 만들지 않습니다</div>
    </section>
  )
}
/** 절 2 — 그룹별 표(섹터·스타일·지역·테마·채권·레버리지 vs 지수형). 순유입은 스냅샷이 5개 쌓인 뒤부터, 그 전엔 1개월 등락·거래량만. */
function FlowSection({ f }: { f: EtfFlow }) {
  const [open, setOpen] = useState<string | null>('sector')
  const money = (v: number) => {
    const abs = Math.abs(v), sign = v >= 0 ? '+' : '−'
    const usd = abs >= 1e9 ? `$${(abs / 1e9).toFixed(1)}B` : `$${Math.round(abs / 1e6)}M`
    const krw = f.usdKrw ? (abs * f.usdKrw >= 1e12 ? ` (${(abs * f.usdKrw / 1e12).toFixed(1)}조원)` : ` (${Math.round(abs * f.usdKrw / 1e8).toLocaleString()}억원)`) : ''
    return sign + usd + krw
  }
  const haveFlow = f.items.some(i => i.flow1w != null)
  const groups = f.groups.filter(g => f.items.some(i => i.group === g.group))
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>🧭 돈이 어느 섹터로 가고 있나</div>
      <div style={{ fontSize: FS.body, color: TK.slate200, lineHeight: 1.6 }}>{f.answer}</div>
      <div style={{ fontSize: FS.micro, color: TK.sub3 }}>
        {f.items.length}개 대표 ETF · 순자산 스냅샷 {f.daysCollected}일{f.firstDay ? ` (${f.firstDay.slice(5)}~${f.lastDay?.slice(5)})` : ''} · 순유입 = 순자산 변화 − 시장 등락분(역산 추정, 운용사 공식 집계와 다를 수 있음)
        {haveFlow && <> · 각 수치에 마우스를 올리면 <b>실제로 잰 구간</b>이 나옵니다 — 스냅샷이 빠져 기간이 벌어진 종목은 값을 비웁니다(‘1주’가 3주가 되지 않게)</>}
      </div>
      {!haveFlow && (
        <div style={{ background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.xs, padding: '7px 10px', fontSize: FS.tiny, color: TK.amber400, lineHeight: 1.6 }}>
          ⏳ 자금 흐름은 매일 하나씩 쌓입니다 — 1주 순유입은 스냅샷 6개(약 1주), 1개월은 21개부터 보입니다. 그 전엔 값의 흐름(1개월 등락·거래량)만 보여드립니다.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map(g => {
          const rows = f.items.filter(i => i.group === g.group).sort((a, b) => ((b.flow1w ?? b.ret1m ?? 0) - (a.flow1w ?? a.ret1m ?? 0)))
          const isOpen = open === g.group
          return (
            <div key={g.group} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.sm }}>
              <button onClick={() => setOpen(isOpen ? null : g.group)} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', color: TK.slate200, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <b style={{ fontSize: FS.tiny, flexGrow: 1 }}>{g.ko}</b>
                {g.flow1w != null && <span style={{ fontSize: FS.tiny, color: g.flow1w >= 0 ? TK.red400 : TK.blue400, fontVariantNumeric: 'tabular-nums' }}>1주 {money(g.flow1w)}{partOf(g.flow1wOf)}</span>}
                {g.ret1m != null && <span style={{ fontSize: FS.tiny, color: g.ret1m >= 0 ? TK.red400 : TK.blue400, fontVariantNumeric: 'tabular-nums' }}>1개월 평균 {g.ret1m >= 0 ? '+' : ''}{g.ret1m}%</span>}
                <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 10px' }}>
                  {rows.map(i => <FlowRow key={i.t} i={i} money={money} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.7, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        읽는 법 — 🔺 <b>가속</b>은 이번 주 하루 평균 유입이 한 달 평균의 1.5배 이상. ↔️ <b>괴리</b>는 돈은 들어오는데 값이 내리거나(반전 후보) 돈은 나가는데 값이 오르는 곳(차익 실현 후보). 📢 <b>거래량</b>은 최근 5일 평균이 20일 평균의 몇 배인지 — 2배 넘으면 손바뀜.
        레버리지·인버스는 단기 투기 자금, 지수형은 장기 기관 자금으로 읽는 게 관례지만 증명된 건 아닙니다. 값의 상대강도는 <a href="/dashboard?tab=rotation" style={{ color: TK.amber400 }}>섹터 로테이션 시계</a>가 따로 봅니다.
      </div>
    </section>
  )
}
function FlowRow({ i, money }: { i: EtfFlowItem; money: (v: number) => string }) {
  const c = (v: number | null) => v == null ? TK.sub3 : v >= 0 ? TK.red400 : TK.blue400
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: TK.bg0, borderRadius: RAD.xs, padding: '6px 10px', fontSize: FS.tiny }}>
      <b style={{ color: TK.slate100, minWidth: 96 }}>{i.name}</b>
      <span style={{ color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: FS.micro }}>{i.t}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
        {i.flow1w != null ? <span style={{ color: c(i.flow1w) }} title={`실제로 잰 구간 ${i.flow1wRange}`}>1주 {money(i.flow1w)}{i.flow1wPct != null ? ` · 자산의 ${i.flow1wPct}%` : ''}</span> : null}
        {i.flow1m != null ? <span style={{ color: c(i.flow1m) }} title={`실제로 잰 구간 ${i.flow1mRange}`}>1개월 {money(i.flow1m)}</span> : null}
        <span style={{ color: c(i.ret1m) }}>값 1개월 {i.ret1m == null ? '—' : `${i.ret1m >= 0 ? '+' : ''}${i.ret1m}%`}</span>
        {i.volX != null && <span style={{ color: i.volX >= 2 ? TK.amber400 : TK.sub }}>{i.volX >= 2 ? '📢 ' : ''}거래량 {i.volX}배</span>}
        {i.accel && <span style={{ color: TK.amber400, fontWeight: 700 }}>🔺 가속</span>}
        {i.divergence && <span style={{ color: TK.cyan400, fontWeight: 700 }}>↔️ {i.divergence === 'inflow-down' ? '유입인데 하락' : '유출인데 상승'}</span>}
      </span>
    </div>
  )
}
function GaugeCard({ g }: { g: Gauge }) {
  const c = TONE_C[g.tone]
  return (
    <div style={{ background: TK.bg3, border: `1px solid ${c}44`, borderRadius: RAD.sm, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub }}>{g.label}</span>
      <span style={{ fontSize: FS.xl, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{g.value}</span>
      {g.sub && <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{g.sub}</span>}
      <span style={{ fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.55, marginTop: 2 }}>{g.meaning}</span>
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
        <Cell label="경영진·이사" value={`${it.buyers}명`} sub={(it.holders10 ? `+ 10% 주주·펀드 ${it.holders10} · ` : '') + it.roles.filter(r => r !== '10% 주주').join(' · ')} />
        <Cell label="평균 매수단가" value={it.avgPx != null ? `$${it.avgPx.toFixed(2)}` : '—'} sub={`${md(it.firstDate)}${it.firstDate !== it.lastDate ? `~${md(it.lastDate)}` : ''}`} />
        <Cell label="현재가" value={it.price != null ? `$${it.price.toLocaleString()}` : '—'} sub={it.gapPct != null ? `매수단가 대비 ${it.gapPct >= 0 ? '+' : ''}${it.gapPct}%` : undefined} c={gapC} />
      </div>
      {it.buys.length > 0 && (
        <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.6 }}>
          {it.buys.slice(0, 3).map((b, i) => <span key={i}>{i > 0 && ' · '}{b.owner}({b.role}) {b.unpriced ? '단가 미상' : usd(b.value)}{b.n > 1 ? ` ${b.n}회` : ''} ~{md(b.date)}</span>)}
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
