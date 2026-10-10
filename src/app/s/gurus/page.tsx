'use client'
// 학생 '거장' — 거장 9인(guruFunds) 칩 → 고른 거장의 상위 보유 10종목(비중·전분기 대비·이번 분기 행동)과 확인된 명언 한 줄(있으면). 홈 바로가기·거장 카드가 온다(5단계: 분석 화면 대신 간편 안에서)
//   원천 = /api/guru-portfolio?cik= (13F — 분기마다 45일 늦게 공개 · 종목명만 있고 티커는 유명 종목만). 명언은 quotes(원문 확인된 것만)
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FUNDS } from '@/lib/guruFunds'
import { QUOTES } from '@/lib/quotes'
import { useJson } from '@/app/components/student/useJson'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'

interface Position { name?: unknown; ticker?: unknown; pctPort?: unknown; action?: unknown; deltaPct?: unknown }
interface Resp { status?: unknown; mgr?: unknown; fund?: unknown; asOf?: unknown; total?: unknown; count?: unknown; positions?: Position[] }
const ACTION_KO: Record<string, string> = { new: '새로 샀어요', add: '더 샀어요', hold: '그대로', trim: '줄였어요' }
const TOP = 10
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
                    <span style={{ fontSize: FS.micro, color: TK.sub }}>{[action, delta != null && action !== '그대로' ? `주식 수 ${delta > 0 ? '+' : ''}${delta.toFixed(0)}%` : null].filter(Boolean).join(' · ') || '전분기 대비 모름'}</span>
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
              `비중 큰 순 ${positions.length}종목${isNum(r.data!.count) ? ` / 전체 ${r.data!.count}종목` : ''}`,
              typeof r.data!.asOf === 'string' ? `${ymdDot(r.data!.asOf)} 신고 기준` : null,
              '미국 SEC 13F',
            ].filter(Boolean).join(' · ')}
          </span>
        )}
        <span style={noteStyle()}>13F는 분기가 끝나고 45일 뒤에 공개돼요 — 지금 보유와 다를 수 있어요. 종목명만 신고돼서 티커는 잘 알려진 종목에만 붙어요.</span>
      </section>
    </div>
  )
}
