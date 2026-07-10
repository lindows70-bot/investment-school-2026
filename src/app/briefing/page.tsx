'use client'
// 🎯 오늘의 매매 브리핑 — 매일 아침 이 한 페이지만: ①오늘 신호 ②정리할 것 ③담을 것 ④판 읽기 ⑤스탠스
//    신규 계산 0 — 전부 기존 SSOT API의 요약 뷰 + 상세 딥링크. 섹션별 독립 로딩(하나 느려도 나머지 먼저 표시).
import { useState, useEffect } from 'react'
import TimingBadge from '@/app/components/TimingBadge'
import TradePlanCard from '@/app/components/TradePlanCard'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'
import type { RotationResult } from '@/app/api/sector-rotation/route'
import type { WatchChange } from '@/app/api/cron/timing-watch/route'

const CARD = '#12151f', BORDER = '#1e293b'

/* eslint-disable @typescript-eslint/no-explicit-any */
function useFetch<T>(url: string): { d: T | null; loading: boolean } {
  const [d, setD] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch(url).then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setD(j?.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [url])
  return { d, loading }
}

const Sec = ({ no, title, sub, link, linkLabel, children }: { no: string; title: string; sub: string; link?: string; linkLabel?: string; children: React.ReactNode }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 900, color: '#7c8db0', background: '#1b2130', borderRadius: 6, padding: '2px 8px' }}>{no}</span>
      <span style={{ fontSize: 15.5, fontWeight: 800, color: '#f1f5f9' }}>{title}</span>
      <span style={{ fontSize: 11, color: '#7f93a8' }}>{sub}</span>
      {link && <a href={link} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#818cf8', textDecoration: 'none' }}>{linkLabel ?? '상세 보기'} →</a>}
    </div>
    {children}
  </div>
)
const Skel = ({ h = 60 }: { h?: number }) => <div style={{ height: h, background: '#171b26', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />

const WL: Record<string, { c: string; t: string }> = {
  green: { c: '#4ade80', t: '돌파!' }, red: { c: '#f87171', t: '이탈 경계' }, yellow: { c: '#eab308', t: '대기 전환' },
}

export default function BriefingPage() {
  const watch = useFetch<{ changes: WatchChange[] }>('/api/timing-watch')
  const reb = useFetch<any>('/api/ai-rebalance')
  const reco = useFetch<UnifiedRecoResult>('/api/unified-reco')
  const rot = useFetch<RotationResult>('/api/sector-rotation')
  const marks = useFetch<any>('/api/marks-cycle')

  const cs = reb.d?.coreSatellite
  const sells = cs ? [...(cs.drop ?? []).map((x: any) => ({ ...x, kind: '버릴 것', kc: '#f87171' })), ...(cs.trim ?? []).map((x: any) => ({ ...x, kind: '줄일 것', kc: '#fbbf24' }))].slice(0, 4) : []
  const buys = reco.d?.items?.slice(0, 5) ?? []
  const temp = marks.d?.temp
  const cash = temp == null ? null : temp >= 75 ? '30~40%' : temp >= 58 ? '20~30%' : temp >= 42 ? '15~25%' : temp >= 25 ? '10~20%' : '10~15%'

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1100, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#1a1f30,#0d1017)', border: '1px solid #33415588', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#f1f5f9' }}>🎯 오늘의 매매 브리핑</div>
        <div style={{ fontSize: 12, color: '#8599ae', marginTop: 5, lineHeight: 1.6 }}>
          매일 아침 <b style={{ color: '#cbd5e1' }}>이 한 페이지</b>면 충분합니다 — <b style={{ color: '#f87171' }}>① 신호</b> → <b style={{ color: '#fbbf24' }}>② 정리</b> → <b style={{ color: '#4ade80' }}>③ 매수</b> → <b style={{ color: '#38bdf8' }}>④ 판 읽기</b> → <b style={{ color: '#c4b5fd' }}>⑤ 스탠스</b>.
          근거가 궁금할 때만 각 섹션의 &lsquo;상세&rsquo;로 들어가세요.
        </div>
      </div>

      {/* ① 오늘 신호 */}
      <Sec no="①" title="오늘 신호" sub="어제 대비 타점 전환(🟢돌파/🔴이탈) — 내 보유 종목만">
        {watch.loading ? <Skel h={36} /> : watch.d?.changes?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {watch.d.changes.map(c => (
              <span key={c.ticker + c.market} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0f1117', border: `1px solid ${WL[c.to]?.c ?? '#334155'}55`, borderRadius: 7, padding: '4px 10px', fontSize: 11.5 }}>
                <b style={{ color: '#e2e8f0' }}>{c.market === 'KR' ? '🇰🇷' : '🇺🇸'} {c.name}</b>
                <b style={{ color: WL[c.to]?.c }}>{WL[c.to]?.t}</b>
              </span>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: '#7f93a8' }}>오늘은 보유 종목의 타점 전환이 없습니다 — 조용한 날엔 아무것도 안 하는 것도 실력.</div>}
      </Sec>

      {/* ② 정리할 것 */}
      <Sec no="②" title="정리할 것" sub="AI 리밸런싱의 버릴/줄일 상위" link="/dashboard?tab=rebalance" linkLabel="AI 리밸런싱 상세">
        {reb.loading ? <Skel h={80} /> : sells.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sells.map((s: any, i: number) => (
              <div key={s.ticker + i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: '#0f1117', borderRadius: 8, padding: '7px 11px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 10, color: s.kc, minWidth: 42 }}>{s.kind}</b>
                <b style={{ fontSize: 12.5, color: '#e2e8f0' }}>{s.name}</b>
                <span style={{ fontSize: 10.5, color: '#7f93a8', fontFamily: 'monospace' }}>{s.trimPct ? `−${s.trimPct}%p` : `비중 ${s.weightPct}%`}</span>
                <span style={{ fontSize: 10.5, color: '#9aa7b4', flex: 1, minWidth: 200 }}>{String(s.reason).slice(0, 90)}{String(s.reason).length > 90 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: '#7f93a8' }}>{reb.d ? '지금 정리할 종목이 없습니다 — 포트폴리오 건강.' : '리밸런싱 데이터 로드 실패 — 상세 탭에서 확인해주세요.'}</div>}
      </Sec>

      {/* ③ 담을 것 */}
      <Sec no="③" title="담을 것" sub="통합추천 Top 5 — 4축 점수 + 🚦타점 + 📋플랜" link="/dashboard?tab=moneyflow&view=unified" linkLabel="통합추천 전체(12종)">
        {reco.loading ? <Skel h={160} /> : buys.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buys.map(it => (
              <div key={it.ticker + it.market} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13, color: '#f1f5f9' }}>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'} {it.name}</b>
                  <span style={{ fontSize: 10.5, color: '#7f93a8' }}>{it.sector}</span>
                  <b style={{ marginLeft: 'auto', fontSize: 15, color: '#4ade80', fontFamily: 'monospace' }}>{it.combined}<span style={{ fontSize: 9, color: '#7f93a8' }}> 통합</span></b>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
                  {it.suggestWon > 0 && <span style={{ fontSize: 10, color: '#86efac', background: '#14532d33', borderRadius: 5, padding: '1px 7px' }}>💰 권장 {Math.round(it.suggestWon / 1e4).toLocaleString()}만원</span>}
                  {it.timing && <TimingBadge t={it.timing} market={it.market} compact />}
                  {it.badges.slice(0, 3).map(b => <span key={b} style={{ fontSize: 9.5, color: '#9aa7b4', background: '#1b2130', borderRadius: 5, padding: '1px 6px' }}>{b}</span>)}
                </div>
                {it.timing && it.timing.price != null && (reco.d?.portfolioKrw ?? 0) > 0 && (
                  <TradePlanCard market={it.market} timing={it.timing} portfolioKrw={reco.d!.portfolioKrw} />
                )}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: '#7f93a8' }}>추천 데이터 로드 실패 — 통합추천 탭에서 확인해주세요.</div>}
      </Sec>

      {/* ④ 판 읽기 */}
      <Sec no="④" title="판 읽기" sub="섹터 자금 순환 — 돈이 어디서 나와 어디로 가나" link="/dashboard?tab=rotation" linkLabel="로테이션 시계 상세">
        {rot.loading ? <Skel h={70} /> : rot.d ? (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <b style={{ fontSize: 11, color: '#4ade80' }}>🔥 돈 몰림</b>
              {rot.d.inflow.map((s, i) => <div key={s.key} style={{ fontSize: 12, color: '#cbd5e1', marginTop: 3 }}>{i + 1}. {s.emoji} {s.label.replace(/\s*\(.*\)/, '')} <b style={{ color: '#4ade80', fontFamily: 'monospace' }}>+{s.score}</b></div>)}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <b style={{ fontSize: 11, color: '#94a3b8' }}>❄️ 돈 빠짐</b>
              {rot.d.outflow.map((s, i) => <div key={s.key} style={{ fontSize: 12, color: '#cbd5e1', marginTop: 3 }}>{i + 1}. {s.emoji} {s.label.replace(/\s*\(.*\)/, '')} <b style={{ color: '#f87171', fontFamily: 'monospace' }}>{s.score}</b></div>)}
            </div>
            {rot.d.buys?.[0] && (
              <div style={{ flex: '1 1 240px', background: '#10241a55', border: '1px solid #22c55e33', borderRadius: 9, padding: '8px 11px' }}>
                <b style={{ fontSize: 11, color: '#4ade80' }}>🎯 소섹터 매수 1위</b>
                <div style={{ fontSize: 12.5, color: '#e2e8f0', marginTop: 3 }}>{rot.d.buys[0].sectorEmoji}{rot.d.buys[0].sectorLabel} › <b>{rot.d.buys[0].subEmoji}{rot.d.buys[0].subLabel}</b></div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {rot.d.buys[0].etfUs && <b style={{ fontSize: 10, color: '#4ade80', background: '#14532d', borderRadius: 5, padding: '1px 7px' }}>🇺🇸 {rot.d.buys[0].etfUs}</b>}
                  {rot.d.buys[0].etfKr && <b style={{ fontSize: 10, color: '#4ade80', background: '#14532d', borderRadius: 5, padding: '1px 7px' }}>🇰🇷 {rot.d.buys[0].etfKr}</b>}
                  {rot.d.buys[0].etfTiming && <TimingBadge t={rot.d.buys[0].etfTiming} compact />}
                </div>
              </div>
            )}
          </div>
        ) : <div style={{ fontSize: 12, color: '#7f93a8' }}>로테이션 데이터 로드 실패.</div>}
      </Sec>

      {/* ⑤ 오늘의 스탠스 */}
      <Sec no="⑤" title="오늘의 스탠스" sub="얼마나 공격적으로 — 막스 온도 + 계절" link="/dashboard?tab=marks" linkLabel="막스 시계추 상세">
        {marks.loading ? <Skel h={36} /> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
            {temp != null && (<>
              <span style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🕰️ 탐욕 온도 <b style={{ color: temp >= 58 ? '#f87171' : temp <= 42 ? '#4ade80' : '#e2e8f0', fontFamily: 'monospace' }}>{temp}</b> · <b style={{ color: '#cbd5e1' }}>{marks.d.stance}</b></span>
              <span style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>💰 권장 현금 <b style={{ color: '#c4b5fd', fontFamily: 'monospace' }}>{cash}</b></span>
            </>)}
            {reco.d && (
              <span style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🌦️ 계절 🇺🇸 <b style={{ color: '#cbd5e1' }}>{reco.d.usSeason.label}</b> · 🇰🇷 <b style={{ color: '#cbd5e1' }}>{reco.d.krSeason.label}</b></span>
            )}
          </div>
        )}
      </Sec>

      <div style={{ fontSize: 10.5, color: '#8a9aaa', lineHeight: 1.6, padding: '0 4px' }}>
        ⚠️ 모든 수치는 각 상세 화면과 동일한 SSOT(제2원칙) — 이 페이지는 요약 뷰입니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다. 자동 주문 없음.
      </div>
    </div>
  )
}
