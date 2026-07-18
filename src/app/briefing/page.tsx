'use client'
// 🎯 오늘의 매매 브리핑 — 매일 아침 이 한 페이지만: ①오늘 신호 ②정리할 것 ③담을 것 ④판 읽기 ⑤스탠스
//    신규 계산 0 — 전부 기존 SSOT API의 요약 뷰 + 상세 딥링크. 섹션별 독립 로딩(하나 느려도 나머지 먼저 표시).
import { useState, useEffect } from 'react'
import TimingBadge from '@/app/components/TimingBadge'
import TradePlanCard from '@/app/components/TradePlanCard'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'
import type { RotationResult } from '@/app/api/sector-rotation/route'
import type { WatchSig } from '@/app/api/cron/timing-watch/route'
import { type WLApi, splitGroups, factorStats, buildLesson, WL_PERIOD_LABEL } from '@/lib/winLose'
import { TK } from '@/lib/theme'

const CARD = '#12151f', BORDER = TK.border

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
      <span style={{ fontSize: 15.5, fontWeight: 800, color: TK.slate100 }}>{title}</span>
      <span style={{ fontSize: 11, color: TK.sub2 }}>{sub}</span>
      {link && <a href={link} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: TK.indigo400, textDecoration: 'none' }}>{linkLabel ?? '상세 보기'} →</a>}
    </div>
    {children}
  </div>
)
const Skel = ({ h = 60 }: { h?: number }) => <div style={{ height: h, background: '#171b26', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />


export default function BriefingPage() {
  const watch = useFetch<{ sigs: WatchSig[] }>('/api/timing-watch')
  const reb = useFetch<any>('/api/ai-rebalance')
  const reco = useFetch<UnifiedRecoResult>('/api/unified-reco')
  const rot = useFetch<RotationResult>('/api/sector-rotation')
  const marks = useFetch<any>('/api/marks-cycle')
  const wl = useFetch<WLApi>('/api/win-lose')

  const cs = reb.d?.coreSatellite
  const sells = cs ? [...(cs.drop ?? []).map((x: any) => ({ ...x, kind: '버릴 것', kc: TK.red400 })), ...(cs.trim ?? []).map((x: any) => ({ ...x, kind: '줄일 것', kc: TK.amber400 }))].slice(0, 4) : []
  const buys = reco.d?.items?.slice(0, 5) ?? []
  const temp = marks.d?.temp
  const cash = temp == null ? null : temp >= 75 ? '30~40%' : temp >= 58 ? '20~30%' : temp >= 42 ? '15~25%' : temp >= 25 ? '10~20%' : '10~15%'

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1100, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,#1a1f30,${TK.bg1})`, border: '1px solid #33415588', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: TK.slate100 }}>🎯 오늘의 매매 브리핑</div>
        <div style={{ fontSize: 12, color: TK.sub3, marginTop: 5, lineHeight: 1.6 }}>
          매일 아침 <b style={{ color: TK.slate300 }}>이 한 페이지</b>면 충분합니다 — <b style={{ color: TK.red400 }}>① 신호</b> → <b style={{ color: TK.amber400 }}>② 정리</b> → <b style={{ color: TK.green400 }}>③ 매수</b> → <b style={{ color: TK.sky400 }}>④ 판 읽기</b> → <b style={{ color: TK.violet300 }}>⑤ 스탠스</b>.
          근거가 궁금할 때만 각 섹션의 &lsquo;상세&rsquo;로 들어가세요.
        </div>
      </div>

      {/* ① 오늘 신호 */}
      <Sec no="①" title="오늘 신호" sub="어제 대비 매수/매도 타점 전환(신호등·라쉬케·스퀴즈·매물평단) — 내 보유 종목만">
        {watch.loading ? <Skel h={36} /> : watch.d?.sigs?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {watch.d.sigs.map((s, i) => {
              const c = s.kind === 'sell' ? TK.red400 : TK.green400
              const clash = s.fund && ((s.kind === 'buy' && s.fund === 'SELL') || (s.kind === 'sell' && s.fund === 'BUY'))
              const clashTxt = s.kind === 'buy' ? '⚠️ 펀더 매도검토' : '🟢 펀더 매수기회'
              const clashTip = s.kind === 'buy'
                ? '기술 타점은 매수 신호지만 Jarvis 펀더멘탈 진단은 매도 검토 — 신규 진입·불타기 자제(WHAT은 펀더멘탈 우선)'
                : 'Jarvis 펀더멘탈 진단은 매수 기회 — 이 기술 신호는 단기 경계 참고로만(저점 매도 주의)'
              return (
                <span key={s.ticker + s.market + i} title={clash ? `${s.detail} · ${clashTip}` : s.detail} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg3, border: `1px solid ${c}55`, borderRadius: 7, padding: '4px 10px', fontSize: 11.5 }}>
                  <b style={{ color: TK.slate200 }}>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'} {s.name}</b>
                  <span style={{ color: TK.sub, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>{s.ticker}</span>
                  <b style={{ color: c }}>{s.icon} {s.label}</b>
                  {clash && <b style={{ color: s.kind === 'buy' ? TK.red400 : TK.green400, fontSize: 10, borderLeft: `1px solid ${TK.border}`, paddingLeft: 5 }}>{clashTxt}</b>}
                </span>
              )
            })}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>오늘은 보유 종목의 타점 전환이 없습니다 — 조용한 날엔 아무것도 안 하는 것도 실력.</div>}
      </Sec>

      {/* ② 정리할 것 */}
      <Sec no="②" title="정리할 것" sub="AI 리밸런싱의 버릴/줄일 상위" link="/dashboard?tab=rebalance" linkLabel="AI 리밸런싱 상세">
        {reb.loading ? <Skel h={80} /> : sells.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sells.map((s: any, i: number) => (
              <div key={s.ticker + i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: TK.bg3, borderRadius: 8, padding: '7px 11px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 10, color: s.kc, minWidth: 42 }}>{s.kind}</b>
                <b style={{ fontSize: 12.5, color: TK.slate200 }}>{s.name}</b>
                <span style={{ fontSize: 10.5, color: TK.sub2, fontFamily: 'monospace' }}>{s.trimPct ? `−${s.trimPct}%p` : `비중 ${s.weightPct}%`}</span>
                <span style={{ fontSize: 10.5, color: TK.sub13, flex: 1, minWidth: 200 }}>{String(s.reason).slice(0, 90)}{String(s.reason).length > 90 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>{reb.d ? '지금 정리할 종목이 없습니다 — 포트폴리오 건강.' : '리밸런싱 데이터 로드 실패 — 상세 탭에서 확인해주세요.'}</div>}
      </Sec>

      {/* ③ 담을 것 */}
      <Sec no="③" title="담을 것" sub="통합추천 Top 5 — 4축 점수 + 🚦타점 + 📋플랜" link="/dashboard?tab=moneyflow&view=unified" linkLabel="통합추천 전체(12종)">
        {reco.loading ? <Skel h={160} /> : buys.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buys.map(it => (
              <div key={it.ticker + it.market} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13, color: TK.slate100 }}>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'} {it.name}</b>
                  <span style={{ fontSize: 10.5, color: TK.sub2 }}>{it.sector}</span>
                  <b style={{ marginLeft: 'auto', fontSize: 15, color: TK.green400, fontFamily: 'monospace' }}>{it.combined}<span style={{ fontSize: 9, color: TK.sub2 }}> 통합</span></b>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
                  {it.suggestWon > 0 && <span style={{ fontSize: 10, color: TK.green300, background: '#14532d33', borderRadius: 5, padding: '1px 7px' }}>💰 권장 {Math.round(it.suggestWon / 1e4).toLocaleString()}만원</span>}
                  {it.timing && <TimingBadge t={it.timing} market={it.market} compact />}
                  {it.badges.slice(0, 3).map(b => <span key={b} style={{ fontSize: 9.5, color: TK.sub13, background: '#1b2130', borderRadius: 5, padding: '1px 6px' }}>{b}</span>)}
                </div>
                {it.timing && it.timing.price != null && (reco.d?.portfolioKrw ?? 0) > 0 && (
                  <TradePlanCard market={it.market} timing={it.timing} portfolioKrw={reco.d!.portfolioKrw} />
                )}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>추천 데이터 로드 실패 — 통합추천 탭에서 확인해주세요.</div>}
      </Sec>

      {/* ④ 판 읽기 */}
      <Sec no="④" title="판 읽기" sub="섹터 자금 순환 — 돈이 어디서 나와 어디로 가나" link="/dashboard?tab=rotation" linkLabel="로테이션 시계 상세">
        {rot.loading ? <Skel h={70} /> : rot.d ? (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <b style={{ fontSize: 11, color: TK.green400 }}>🔥 돈 몰림</b>
              {rot.d.inflow.map((s, i) => <div key={s.key} style={{ fontSize: 12, color: TK.slate300, marginTop: 3 }}>{i + 1}. {s.emoji} {s.label.replace(/\s*\(.*\)/, '')} <b style={{ color: TK.green400, fontFamily: 'monospace' }}>+{s.score}</b></div>)}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <b style={{ fontSize: 11, color: TK.slate400 }}>❄️ 돈 빠짐</b>
              {rot.d.outflow.map((s, i) => <div key={s.key} style={{ fontSize: 12, color: TK.slate300, marginTop: 3 }}>{i + 1}. {s.emoji} {s.label.replace(/\s*\(.*\)/, '')} <b style={{ color: TK.red400, fontFamily: 'monospace' }}>{s.score}</b></div>)}
            </div>
            {rot.d.buys?.[0] && (
              <div style={{ flex: '1 1 240px', background: '#10241a55', border: `1px solid ${TK.green500}33`, borderRadius: 9, padding: '8px 11px' }}>
                <b style={{ fontSize: 11, color: TK.green400 }}>🎯 소섹터 매수 1위</b>
                <div style={{ fontSize: 12.5, color: TK.slate200, marginTop: 3 }}>{rot.d.buys[0].sectorEmoji}{rot.d.buys[0].sectorLabel} › <b>{rot.d.buys[0].subEmoji}{rot.d.buys[0].subLabel}</b></div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {rot.d.buys[0].etfUs && <b style={{ fontSize: 10, color: TK.green400, background: '#14532d', borderRadius: 5, padding: '1px 7px' }}>🇺🇸 {rot.d.buys[0].etfUs}</b>}
                  {rot.d.buys[0].etfKr && <b style={{ fontSize: 10, color: TK.green400, background: '#14532d', borderRadius: 5, padding: '1px 7px' }}>🇰🇷 {rot.d.buys[0].etfKr}</b>}
                  {rot.d.buys[0].etfTiming && <TimingBadge t={rot.d.buys[0].etfTiming} compact />}
                </div>
              </div>
            )}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>로테이션 데이터 로드 실패.</div>}
      </Sec>

      {/* ④½ ⚔️ 승패 해부 — 지금 장에서 뭐가 통하나(시장의 채점 기준) */}
      <Sec no="⚔️" title="승패 해부" sub="지금 장에서 오르는 종목 vs 떨어지는 종목 — 무엇이 갈랐나" link="/win-lose" linkLabel="해부실 상세">
        {wl.loading ? <Skel h={48} /> : wl.d?.rows?.length ? (() => {
          const { win, lose } = splitGroups(wl.d.rows, '1m')
          if (win.length < 3 || lose.length < 3) return <div style={{ fontSize: 12, color: TK.sub2 }}>표본 부족 — 해부실에서 기간을 바꿔 보세요.</div>
          const lesson = buildLesson(factorStats(win, lose), WL_PERIOD_LABEL['1m'])
          return (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 7, fontSize: 12 }}>
                <span style={{ background: '#0d2818', border: `1px solid ${TK.green500}44`, borderRadius: 7, padding: '4px 10px' }}>🔺 오르는 <b style={{ color: TK.green400, fontFamily: 'monospace' }}>{win.length}</b></span>
                <span style={{ background: '#2a0f12', border: `1px solid ${TK.red500}44`, borderRadius: 7, padding: '4px 10px' }}>🔻 떨어지는 <b style={{ color: TK.red400, fontFamily: 'monospace' }}>{lose.length}</b></span>
                {lesson.top.map(s => (
                  <span key={s.key} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '4px 10px', fontSize: 11 }}>
                    {s.icon} {s.label.replace(/\(.*\)/, '').trim()} <b style={{ color: TK.green400, fontFamily: 'monospace' }}>{s.winDisp}</b><span style={{ color: TK.sub2 }}> vs </span><b style={{ color: TK.red400, fontFamily: 'monospace' }}>{s.loseDisp}</b>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: TK.slate300, lineHeight: 1.55 }}>🎓 {lesson.text}</div>
            </div>
          )
        })() : <div style={{ fontSize: 12, color: TK.sub2 }}>승패 데이터 준비 중(매일 08:50 자동 계산).</div>}
      </Sec>

      {/* ⑤ 오늘의 스탠스 */}
      <Sec no="⑤" title="오늘의 스탠스" sub="얼마나 공격적으로 — 막스 온도 + 계절" link="/dashboard?tab=marks" linkLabel="막스 시계추 상세">
        {marks.loading ? <Skel h={36} /> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
            {temp != null && (<>
              <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🕰️ 탐욕 온도 <b style={{ color: temp >= 58 ? TK.red400 : temp <= 42 ? TK.green400 : TK.slate200, fontFamily: 'monospace' }}>{temp}</b> · <b style={{ color: TK.slate300 }}>{marks.d.stance}</b></span>
              <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>💰 권장 현금 <b style={{ color: TK.violet300, fontFamily: 'monospace' }}>{cash}</b></span>
              {typeof marks.d.requiredMos === 'number' && (
                <span title="탐욕일수록 더 큰 할인을 요구 — 신규 매수는 공정가치 대비 이만큼 싼 가격에서만(모닝스타 별점 할인율과 비교)" style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🎯 요구 안전마진 <b style={{ color: temp >= 58 ? TK.red400 : temp <= 42 ? TK.green400 : TK.amber400, fontFamily: 'monospace' }}>{marks.d.requiredMos}%</b></span>
              )}
            </>)}
            {reco.d && (
              <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🌦️ 계절 🇺🇸 <b style={{ color: TK.slate300 }}>{reco.d.usSeason.label}</b> · 🇰🇷 <b style={{ color: TK.slate300 }}>{reco.d.krSeason.label}</b></span>
            )}
          </div>
        )}
      </Sec>

      <div style={{ fontSize: 10.5, color: TK.sub, lineHeight: 1.6, padding: '0 4px' }}>
        ⚠️ 모든 수치는 각 상세 화면과 동일한 SSOT(제2원칙) — 이 페이지는 요약 뷰입니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다. 자동 주문 없음.
      </div>
    </div>
  )
}
