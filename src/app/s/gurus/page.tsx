'use client'
// 학생 '거장' — 추적 거장(guruFunds) 칩 → 고른 거장의 상위 보유 10종목(비중·전분기 대비·이번 분기 행동)과 확인된 명언 한 줄(있으면). 홈 바로가기·거장 카드가 온다(5단계: 분석 화면 대신 간편 안에서)
//   원천 = /api/guru-portfolio?cik= (13F — 분기마다 45일 늦게 공개 · 종목명만 있고 티커는 유명 종목만). 명언은 quotes(원문 확인된 것만)
//   보유 목록은 주식 줄만 — 풋 · 콜(옵션)은 아래에 따로(2026-11-28). 최신 분기 신고가 없는 거장은 '마지막 신고'라고 밝힌다
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FUNDS } from '@/lib/guruFunds'
import { QUOTES } from '@/lib/quotes'
import { useJson } from '@/app/components/student/useJson'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'

interface Position { name?: unknown; ticker?: unknown; pctPort?: unknown; action?: unknown; deltaPct?: unknown; self?: unknown }
interface Opt { name?: unknown; ticker?: unknown; pc?: unknown; action?: unknown }
interface Resp { status?: unknown; mgr?: unknown; fund?: unknown; asOf?: unknown; reportDate?: unknown; stale?: unknown; broad?: unknown; total?: unknown; count?: unknown; positions?: Position[]; options?: Opt[]; optLines?: unknown }
const ACTION_KO: Record<string, string> = { new: '새로 샀어요', add: '더 샀어요', hold: '그대로', trim: '줄였어요' }
const TOP = 10
const OPT_TOP = 5
// 풋 · 콜은 좋고 나쁨이 아니라 방향 — 등락색을 쓰지 않는다
const PC_KO: Record<string, string> = { put: '풋 · 내리면 버는 계약', call: '콜 · 오르면 버는 계약' }
const OPT_ACTION_KO: Record<string, string> = { new: '이번에 새로', add: '늘렸어요', hold: '그대로', trim: '줄였어요' }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pct1 = (n: number) => `${n.toFixed(1)}%`
/** 'YYYY-MM-DD' 또는 ISO → 'YYYY.M.D' */
const ymdDot = (s: string) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}.${Number(m[2])}.${Number(m[3])}` : s }

const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>

export default function StudentGurus() {
  const [cik, setCik] = useState(FUNDS[0].cik)
  const fund = FUNDS.find(f => f.cik === cik) ?? FUNDS[0]
  const r = useJson<Resp>(`/api/guru-portfolio?cik=${encodeURIComponent(cik)}`)
  // 거장 본인의 확인된 명언 — 목록에 없으면 줄 자체를 생략(다른 사람 말을 빌리지 않는다)
  const quote = QUOTES.find(q => q.person === fund.mgr && !q.quotedBy)
  const ok = r.state === 'ok' && r.data?.status === 'ok' && Array.isArray(r.data.positions)
  const positions = ok ? (r.data!.positions as Position[]).slice(0, TOP) : []
  const options = ok && Array.isArray(r.data!.options) ? (r.data!.options as Opt[]).filter(o => typeof o.name === 'string' && typeof o.pc === 'string' && PC_KO[o.pc]).slice(0, OPT_TOP) : []
  const stale = ok && r.data!.stale === true, broad = ok && r.data!.broad === true
  const reportDate = ok && typeof r.data!.reportDate === 'string' ? r.data!.reportDate : null
  const optLines = ok && isNum(r.data!.optLines) ? r.data!.optLines : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 720 }}>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>거장들의 포트폴리오</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>유명 투자자들이 무엇을 들고 있는지 — 미국에 신고한 보유 목록(13F)이에요. 따라 사라는 뜻이 아니에요.</p>
      </header>

      <div role="group" aria-label="거장 고르기" style={{ display: 'flex', gap: SP.xs, flexWrap: 'wrap' }}>
        {FUNDS.map(f => {
          const on = f.cik === cik
          return (
            <button key={f.cik} type="button" aria-pressed={on} onClick={() => setCik(f.cik)}
              style={{ height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.pill, border: `1px solid ${on ? TK.line4 : TK.line1}`, background: on ? TK.bg7 : 'transparent', color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {f.mgr}
            </button>
          )
        })}
      </div>

      <section aria-label={`${fund.mgr} 보유`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>{fund.mgr}</h2>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>{fund.fund}</span>
        </div>
        {quote && (
          <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
            “{quote.ko}” <span style={{ fontSize: FS.micro, color: TK.sub }}>— {quote.sourceLabel}</span>
          </p>
        )}
        {(r.state === 'idle' || r.state === 'loading') && <span style={noteStyle()}>보유 목록을 불러오는 중… 조금 걸려요.</span>}
        {r.state === 'unauth' && <span style={noteStyle()}>로그인하면 보유 목록이 보여요.</span>}
        {(r.state === 'failed' || (r.state === 'ok' && !ok)) && <FailRow text="보유 목록을 못 가져왔어요." onRetry={r.reload} retryLabel="거장 보유 목록 다시 불러오기" />}
        {stale && reportDate && (
          <p style={{ margin: 0, padding: SP.sm, borderRadius: RAD.md, border: `1px solid ${TK.line1}`, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all' }}>
            마지막 신고예요 — {ymdDot(reportDate)}에 들고 있던 목록이고, 그 뒤로는 새 신고가 없어요. 지금은 다를 수 있어요.
          </p>
        )}
        {broad && (
          <p style={{ margin: 0, padding: SP.sm, borderRadius: RAD.md, border: `1px solid ${TK.line1}`, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all' }}>
            수천 종목을 쉴 새 없이 사고파는 회사예요. 위쪽 종목이 &lsquo;믿고 크게 산 종목&rsquo;이라는 뜻은 아니에요.
          </p>
        )}
        {ok && positions.length === 0 && <span style={noteStyle()}>이번 분기 신고에 보유 종목이 없어요.</span>}
        {ok && positions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {positions.map((p, i) => {
              const name = typeof p.name === 'string' ? p.name : '?'
              const ticker = typeof p.ticker === 'string' ? p.ticker : null
              const w = isNum(p.pctPort) ? p.pctPort : null
              const action = typeof p.action === 'string' ? ACTION_KO[p.action] ?? null : null
              const delta = isNum(p.deltaPct) ? p.deltaPct : null
              const row = (
                <>
                  <span style={{ width: 22, flexShrink: 0, fontSize: FS.tiny, color: TK.sub }}>{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                    <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{ticker ? <span style={{ fontSize: FS.micro, fontWeight: 500, color: TK.sub, marginLeft: SP.xs }}>{ticker}</span> : null}</span>
                    {/* 행동은 색 없이 — 좋고 나쁨이 아니다(등락색은 가격 등락·내 손익에만) */}
                    <span style={{ fontSize: FS.micro, color: TK.sub }}>{[p.self === true ? '자기 회사 주식' : null, action, delta != null && action !== '그대로' ? `주식 수 ${delta > 0 ? '+' : ''}${delta.toFixed(0)}%` : null].filter(Boolean).join(' · ') || '전분기 대비 모름'}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>{w == null ? '비중 모름' : pct1(w)}</span>
                </>
              )
              const style = { display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 52, borderTop: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 } as const
              return ticker
                ? <Link key={`${name}${i}`} href={`/s/stock/${encodeURIComponent(ticker)}?m=US&n=${encodeURIComponent(name)}`} style={style}>{row}</Link>
                : <div key={`${name}${i}`} style={style}>{row}</div>
            })}
          </div>
        )}
        {ok && (
          <span style={noteStyle()}>
            {[
              `주식만 · 비중 큰 순 ${positions.length}종목${isNum(r.data!.count) ? ` / 전체 ${r.data!.count}종목` : ''}`,
              reportDate ? `${ymdDot(reportDate)} 보유` : null,
              typeof r.data!.asOf === 'string' ? `${ymdDot(r.data!.asOf)} 신고` : null,
              '미국 SEC 13F',
            ].filter(Boolean).join(' · ')}
          </span>
        )}
        {options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}>
            <h3 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>주식 말고 걸어 둔 계약(옵션)</h3>
            {options.map((o, i) => (
              // 이름과 설명을 두 줄로 — 한 줄에 나란히 두면 375 폭에서 이름이 'STATE STR SPDR S&P…'로 잘린다
              <div key={`${String(o.name)}${String(o.pc)}${i}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 52, minWidth: 0, borderTop: `1px solid ${TK.border}` }}>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(o.name)}{typeof o.ticker === 'string' ? <span style={{ fontSize: FS.micro, fontWeight: 500, color: TK.sub, marginLeft: SP.xs }}>{o.ticker}</span> : null}</span>
                <span style={{ fontSize: FS.micro, color: TK.slate300 }}>{PC_KO[o.pc as string]}{typeof o.action === 'string' && OPT_ACTION_KO[o.action] ? ` · ${OPT_ACTION_KO[o.action]}` : ''}</span>
              </div>
            ))}
            <span style={noteStyle()}>
              {optLines != null && optLines > options.length ? `옵션 ${optLines.toLocaleString()}줄 중 큰 것 ${options.length}개 · ` : ''}풋은 가진 주식의 보험일 수도 있어요. 얼마를 걸었는지는 신고되지 않아요(신고 금액은 그 주식의 값이지 계약에 낸 돈이 아니에요).
            </span>
          </div>
        )}
        <span style={noteStyle()}>13F는 분기가 끝나고 45일 뒤에 공개돼요 — 지금 보유와 다를 수 있어요. 종목명만 신고돼서 티커는 잘 알려진 종목에만 붙어요.</span>
      </section>
    </div>
  )
}
