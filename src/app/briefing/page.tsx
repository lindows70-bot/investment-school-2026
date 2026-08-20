'use client'
// 🎯 오늘의 매매 브리핑 — 매일 아침 이 한 페이지만: ①오늘 신호 ②정리할 것 ③담을 것 ④판 읽기 ⑤스탠스
//    신규 계산 0 — 전부 기존 SSOT API의 요약 뷰 + 상세 딥링크. 섹션별 독립 로딩(하나 느려도 나머지 먼저 표시).
import { useState, useEffect } from 'react'
import TimingBadge from '@/app/components/TimingBadge'
import TradePlanCard from '@/app/components/TradePlanCard'
import EventCalendarPanel from '@/app/components/EventCalendarPanel'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'
import type { ExitPlanApi } from '@/app/api/exit-plan/route'
import type { RotationResult } from '@/app/api/sector-rotation/route'
import type { WatchSig } from '@/app/api/cron/timing-watch/route'
import { type WLApi, splitGroups, factorStats, buildLesson, WL_PERIOD_LABEL } from '@/lib/winLose'
import { cashBandOf } from '@/lib/cashPosition'
import { LYNCH_CATEGORY_KR } from '@/lib/lynchAnalysis'
import { TK } from '@/lib/theme'
import { flagOf } from '@/lib/marketFlag'
import StockActionChips from '@/app/components/StockActionChips'   // 🔗 종목 액션 SSOT
import DilutionAlertBanner from '@/app/components/DilutionAlertBanner'   // 🚨 희석 경보(대시보드에만 있던 것을 브리핑에도)
import SwingStopAlertBanner from '@/app/components/SwingStopAlertBanner'   // 🚨 스윙 손절선 이탈 — 진입만 알려주고 이탈을 침묵하면 반쪽이다
import DayMoverAlertBanner from '@/app/components/DayMoverAlertBanner'   // 🚀 비트코인·보유 종목 당일 ±5% 급등락

const CARD = '#12151f', BORDER = TK.border

/* eslint-disable @typescript-eslint/no-explicit-any */
// ⚠️ 401(비로그인)을 일반 실패와 같은 null로 뭉개면 '로드 실패'라는 거짓 문구가 나간다
//    ('없음 vs 못 불러옴 vs 로그인 필요'는 다른 사실) — unauth를 따로 들고 문구를 분기한다.
function useFetch<T>(url: string): { d: T | null; loading: boolean; unauth: boolean } {
  const [d, setD] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(url).then(r => { if (alive && r.status === 401) setUnauth(true); return r.ok ? r.json() : null })
      .then(j => { if (alive) setD(j?.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [url])
  return { d, loading, unauth }
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
  const exitp = useFetch<ExitPlanApi>('/api/exit-plan')   // 🚪 출구 플랜 조인 — ②정리할 것에 참고선·버핏 점검 근거 병기
  const reco = useFetch<UnifiedRecoResult>('/api/unified-reco')
  const rot = useFetch<RotationResult>('/api/sector-rotation')
  const marks = useFetch<any>('/api/marks-cycle')
  const wl = useFetch<WLApi>('/api/win-lose')
  const health = useFetch<{ staleCount: number; checks: { id: string; label: string; status: string }[] }>('/api/cron-health')
  const staleCrons = (health.d?.checks ?? []).filter(c => c.status === 'stale')
  const earn = useFetch<{ rows: { ticker: string; name: string; market: string; reportDate: string; daysAgo: number; beat: boolean | null; reactionPct: number | null; summary: string }[] }>('/api/earnings-results')
  const earnRows = earn.d?.rows ?? []
  const breadth = useFetch<{ us: { pctAbove200: number } | null; kr: { pctAbove200: number } | null }>('/api/market-breadth')
  const cash = useFetch<{ needsSetup?: boolean; cashPct?: number; cashKrw?: number; verdict?: 'aggressive' | 'inband' | 'defensive' | null }>('/api/cash-position')

  const cal = useFetch<{ events: { type: string; dDay: number; ticker: string }[] }>('/api/event-calendar')

  // 🚪 출구 플랜 조인 — ② 정리 후보 옆에 '기술 출구신호(WHEN)'와 '버핏 기업 점검(WHAT)'을 나란히.
  //    리밸런싱(비중)·출구신호(타이밍)·버핏(기업)은 축이 다르므로 병기해야 학생이 "왜 정리인가"를 축별로 읽는다.
  const exitMap = new Map((exitp.d?.items ?? []).map(it => [it.ticker.toUpperCase(), it]))
  const buffettAlerts = (exitp.d?.items ?? []).filter(it => it.buffett && (it.buffett.level === 'strong' || it.buffett.level === 'watch'))

  const cs = reb.d?.coreSatellite
  const sells = cs ? [...(cs.drop ?? []).map((x: any) => ({ ...x, kind: '버릴 것', kc: TK.red400 })), ...(cs.trim ?? []).map((x: any) => ({ ...x, kind: '줄일 것', kc: TK.amber400 }))].slice(0, 4) : []
  const buys = reco.d?.items?.slice(0, 5) ?? []
  // 📅 실적 임박(D-7) 보유 종목 — 같은 페이지의 이벤트 캘린더와 ② 매도 카드가 서로 모르면
  //    'PLTR 줄일 것'과 'PLTR 실적 D-1'이 나란히 뜨고도 갭 경고가 없다(교차 주입 — ETN 융합 전례)
  const earnDday = new Map<string, number>()
  for (const e of cal.d?.events ?? []) if (e.type === 'earnings' && e.dDay <= 7 && !earnDday.has(e.ticker)) earnDday.set(e.ticker, e.dDay)
  // ⚖️ ②에서 '~비중 과다'로 줄이는 분류가 ③ 추천에 다시 올라오면 — 시장 랭킹(보유 제외)과
  //    내 분산 상황의 축 차이라 모순은 아니지만, 설명 없이 나란히 두면 학생은 반대 지시로 읽는다
  const overCats = new Set<string>()
  for (const s of sells) { const m = String(s.reason ?? '').match(/([가-힣]+)\s*비중 과다/); if (m) overCats.add(m[1]) }
  const overlapBuys = buys.filter(b => overCats.has(LYNCH_CATEGORY_KR[b.lynchCategory as string] ?? ''))
  const temp = marks.d?.temp
  const cashBand = temp == null ? null : (() => { const b = cashBandOf(temp); return `${b.min}~${b.max}%` })()   // 밴드 산식 SSOT(lib/cashPosition)

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

      {/* 🚨 크론 헬스 — 오늘 안 돈 자동 갱신이 있으면 빨간 한 줄(없으면 렌더 0) */}
      {staleCrons.length > 0 && (
        <div style={{ background: '#2a1215', border: `1px solid ${TK.red400}66`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.red400 }}>
            ⚠️ 오늘 실행되지 않은 자동 갱신 {staleCrons.length}건 — {staleCrons.map(c => c.label).join(' · ')}
          </div>
          <div style={{ fontSize: 11, color: TK.sub3, marginTop: 3 }}>
            해당 데이터는 어제(직전 실행) 기준일 수 있습니다. 아침 자동 점검(09:40)이 경량 갱신은 스스로 복구합니다.
          </div>
        </div>
      )}

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
                // 🔗 칩 전체가 차트 링크 — 신호를 보고 확인하러 가는 게 한 번의 클릭이어야 한다(대시보드 배너와 동일 규약)
                <a key={s.ticker + s.market + i} href={`/tech-chart?ticker=${encodeURIComponent(s.ticker)}&market=${s.market}`}
                  title={`${clash ? `${s.detail} · ${clashTip}` : s.detail}\n\n클릭하면 이 종목 차트로 이동합니다`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg3, border: `1px solid ${c}55`, borderRadius: 7, padding: '4px 10px', fontSize: 11.5, textDecoration: 'none' }}>
                  <b style={{ color: TK.slate200 }}>{flagOf(s.market, s.ticker)} {s.name}</b>
                  <span style={{ color: TK.sub, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>{s.ticker}</span>
                  <b style={{ color: c }}>{s.icon} {s.label}</b>
                  {clash && <b style={{ color: s.kind === 'buy' ? TK.red400 : TK.green400, fontSize: 10, borderLeft: `1px solid ${TK.border}`, paddingLeft: 5 }}>{clashTxt}</b>}
                </a>
              )
            })}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>오늘은 보유 종목의 타점 전환이 없습니다 — 조용한 날엔 아무것도 안 하는 것도 실력.</div>}
      </Sec>

      {/* 🚨 희석 경보(유상증자·CB) — 대시보드 live 탭에만 있어서, 사이드바 첫 항목인 브리핑만 보는 학생은
          자기 KR 보유 종목의 유상증자 공시를 영영 못 봤다(2026-08-08 조사). 경보는 학생이 있는 곳에 있어야 한다.
          경보가 없으면 컴포넌트가 스스로 렌더 0 — 조용한 날엔 화면을 차지하지 않는다. */}
      <DilutionAlertBanner />

      {/* 🚨 스윙 손절선 이탈 — 스윙 추천 종목이 손절선 아래로 마감하면 여기 크게 뜬다(없으면 렌더 0) */}
      <SwingStopAlertBanner />

      {/* 🚀 오늘의 급등락 — 비트코인·보유 종목 당일 ±5% 이상(없으면 렌더 0. 사용자 요청 2026-08-20) */}
      <DayMoverAlertBanner />

      {/* ①½ 이번 주 이벤트 — 어닝 D-day·배당락(이벤트 없으면 렌더 0) */}
      <EventCalendarPanel compact />

      {/* 📰 실적 발표 결과(최근 3일) — 보유 종목 발표가 없으면 렌더 0 */}
      {earnRows.length > 0 && (
        <Sec no="①¾" title="📰 실적 발표 결과" sub="내 보유 종목 최근 3일 발표 — 컨센서스 대비 + 발표 후 주가">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {earnRows.map(r => (
              <div key={`${r.ticker}:${r.market}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#171b26', borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${r.beat === true ? TK.green400 : r.beat === false ? TK.red400 : TK.sub3}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate100 }}>{r.name}</span>
                <span style={{ fontSize: 10.5, color: TK.sub3 }}>{r.daysAgo === 0 ? '오늘' : `${r.daysAgo}일 전`} 발표</span>
                <span style={{ fontSize: 11.5, color: r.beat === true ? TK.green400 : r.beat === false ? TK.red400 : TK.sub2, fontWeight: 700 }}>{r.summary}</span>
                <a href={`/research?q=${encodeURIComponent(r.ticker)}`} style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: TK.indigo400, textDecoration: 'none' }}>Jarvis 어닝콜 →</a>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TK.sub3, marginTop: 6 }}>서프라이즈는 EPS 컨센서스 대비(가이던스·실적의 질은 어닝콜 분석에서) · 발표 당일은 주가 반응 집계 전일 수 있음</div>
        </Sec>
      )}

      {/* ② 정리할 것 */}
      <Sec no="②" title="정리할 것" sub="AI 리밸런싱의 버릴/줄일 상위" link="/dashboard?tab=rebalance" linkLabel="AI 리밸런싱 상세">
        {reb.loading ? <Skel h={80} /> : sells.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sells.map((s: any, i: number) => (
              <div key={s.ticker + i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: TK.bg3, borderRadius: 8, padding: '7px 11px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 10, color: s.kc, minWidth: 42 }}>{s.kind}</b>
                <b style={{ fontSize: 12.5, color: TK.slate200 }}>{s.name}</b>
                <span style={{ fontSize: 10.5, color: TK.sub2, fontFamily: 'monospace' }}>{s.trimPct ? `−${s.trimPct}%p` : `비중 ${s.weightPct}%`}</span>
                {earnDday.has(s.ticker) && (
                  <b title="실적 발표 직전·직후는 갭 변동성이 크다 — 정리하더라도 발표 전후 분할·시점 분산 고려" style={{ fontSize: 10, color: TK.amber400 }}>
                    📅 실적 {earnDday.get(s.ticker) === 0 ? '오늘' : `D-${earnDday.get(s.ticker)}`} · 갭 주의
                  </b>
                )}
                {(() => {
                  // 🚪 출구 플랜 조인 — 같은 종목의 타이밍(출구신호)·기업(버핏) 판정을 비중 사유 옆에 병기(축 병기 원칙)
                  const ex = exitMap.get(String(s.ticker ?? '').toUpperCase())
                  if (!ex) return null
                  const bf = ex.buffett
                  return (<>
                    {ex.signals.length > 0 && (
                      <b title={`출구 플랜 매도 압력: ${ex.signals.map(x => `${x.icon} ${x.label}`).join(' · ')} — 상세는 자산 관리 → 출구 플랜`}
                        style={{ fontSize: 10, color: TK.amber400 }}>🚪 출구신호 {ex.signals.length}</b>
                    )}
                    {bf && bf.level !== 'na' && (
                      <b title={bf.headline}
                        style={{ fontSize: 10, color: bf.level === 'strong' ? TK.red400 : bf.level === 'watch' ? TK.amber400 : TK.green400 }}>
                        {bf.level === 'strong' ? '🏰 기업 변질' : bf.level === 'watch' ? '🏰 기업 주의' : '🏰 기업은 그대로'}
                      </b>
                    )}
                  </>)
                })()}
                {(() => {
                  // 🛡 보호 문구(투매 금물)는 절대 잘리면 안 된다 — 90자 컷이 앞부분만 남기면
                  //   '손실 중 —' 까지만 보여 정반대(당장 팔라)로 읽힌다. 앞만 자르고 🛡 꼬리는 통짜 유지.
                  const r = String(s.reason ?? '')
                  const g = r.indexOf('🛡')
                  const head = g >= 0 ? r.slice(0, g).replace(/[\s·]+$/, '') : r
                  const guard = g >= 0 ? r.slice(g) : ''
                  return (
                    <span style={{ fontSize: 10.5, color: TK.sub13, flex: 1, minWidth: 200 }}>
                      {head.length > 90 ? head.slice(0, 90) + '…' : head}
                      {guard && <b style={{ color: TK.amber400 }}> {guard}</b>}
                    </span>
                  )
                })()}
                {/* 🔗 정리 후보도 근거 확인 경로가 필요하다 — '팔라'는 말만 있고 왜인지 볼 곳이 없으면 공포로 판다.
                    이미 보유 중이므로 '보유 등록'은 제외하고 판정·차트만(축에 맞는 액션만 노출) */}
                <StockActionChips ticker={String(s.ticker)} name={s.name} market={s.market} only={['research', 'chart']} compact />
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>{reb.d ? '지금 정리할 종목이 없습니다 — 포트폴리오 건강.' : reb.unauth ? '내 포트폴리오 기준이라 로그인하면 보입니다.' : '리밸런싱 데이터 로드 실패 — 상세 탭에서 확인해주세요.'}</div>}
        {/* 🏰 정리 목록에 없어도 기업 변질 감시 종목은 여기서 알린다 — 비중(리밸런싱)과 기업(버핏)은 다른 축이라
            리밸런싱이 조용해도 버핏 축이 켜질 수 있다. 반대로 정리 후보인데 버핏 🟢이면 '기업이 아니라 비중 문제'다. */}
        {buffettAlerts.length > 0 && (
          <div style={{ fontSize: 10.5, color: TK.sub13, lineHeight: 1.6, marginTop: 7, background: '#2a1f0a55', border: `1px solid ${TK.amber400}33`, borderRadius: 8, padding: '6px 10px' }}>
            🏰 <b style={{ color: TK.amber400 }}>버핏 기업 점검 감시</b> — {buffettAlerts.map(it => `${it.name}(${it.buffett!.level === 'strong' ? '🔴 변질 신호 다수' : '🟡 신호 1개'})`).join(' · ')}
            <span style={{ color: TK.sub3 }}> · 가격이 아니라 기업이 변했는지의 축 — 근거는 </span>
            <a href="/assets" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}>출구 플랜 →</a>
          </div>
        )}
        {exitp.d && exitp.d.items.length > 0 && (
          <div style={{ fontSize: 10, color: TK.sub3, marginTop: 5 }}>
            🚪 정리 판단의 근거 3축 — 비중(리밸런싱)·타이밍(출구신호)·기업(버핏 점검)을 함께 보세요. 참고선·3축 상세는 <a href="/assets" style={{ color: TK.indigo400, textDecoration: 'none' }}>자산 관리 → 출구 플랜</a>
          </div>
        )}
      </Sec>

      {/* ③ 담을 것 */}
      <Sec no="③" title="담을 것" sub="통합추천 Top 5 — 6축 점수 + 🚦타점 + 📋플랜" link="/dashboard?tab=moneyflow&view=unified" linkLabel={`통합추천 전체(${reco.d?.items?.length ?? 0}종)`}>
        {reco.loading ? <Skel h={160} /> : buys.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buys.map(it => (
              <div key={it.ticker + it.market} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13, color: TK.slate100 }}>{flagOf(it.market, it.ticker)} {it.name}</b>
                  <span style={{ fontSize: 10.5, color: TK.sub2 }}>{it.sector}</span>
                  <b style={{ marginLeft: 'auto', fontSize: 15, color: TK.green400, fontFamily: 'monospace' }}>{it.combined}<span style={{ fontSize: 9, color: TK.sub2 }}> 통합</span></b>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
                  {it.suggestWon > 0 && <span style={{ fontSize: 10, color: TK.green300, background: '#14532d33', borderRadius: 5, padding: '1px 7px' }}>💰 권장 {Math.round(it.suggestWon / 1e4).toLocaleString()}만원</span>}
                  {it.timing && <TimingBadge t={it.timing} market={it.market} compact />}
                  {it.badges.slice(0, 3).map(b => <span key={b} style={{ fontSize: 9.5, color: TK.sub13, background: '#1b2130', borderRadius: 5, padding: '1px 6px' }}>{b}</span>)}
                </div>
                {/* 🔗 다음 행동 — 배지 3개만 보여주고 링크가 없어서, 근거를 더 보려면 통합추천 탭에서 같은 종목을
                    다시 찾아야 했고 사려면 티커를 손으로 타이핑해야 했다(2026-08-08 연결 조직) */}
                <div style={{ marginTop: 6 }}>
                  <StockActionChips ticker={it.ticker} name={it.name} market={it.market} />
                </div>
                {it.timing && it.timing.price != null && (reco.d?.portfolioKrw ?? 0) > 0 && (
                  <TradePlanCard market={it.market} timing={it.timing} portfolioKrw={reco.d!.portfolioKrw} />
                )}
              </div>
            ))}
            {overlapBuys.length > 0 && (
              <div style={{ fontSize: 10.5, color: TK.amber400, lineHeight: 1.55, background: '#2a1f0a55', border: `1px solid ${TK.amber400}33`, borderRadius: 8, padding: '7px 11px' }}>
                ⚖️ ②에서 <b>{Array.from(overCats).join('·')} 비중 과다</b>로 줄이는 중인데 {overlapBuys.map(b => b.name).join('·')}도 같은 분류입니다 —
                ③은 시장 전체 랭킹(내 보유 제외)이라 내 분산 상황을 모릅니다. &lsquo;더 담기&rsquo;보다 <b>교체(줄인 자리를 더 나은 종목으로)</b> 관점으로 보세요.
              </div>
            )}
          </div>
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>{reco.unauth ? '권장 편입액이 내 포트폴리오 기준이라 로그인하면 보입니다.' : '추천 데이터 로드 실패 — 통합추천 탭에서 확인해주세요.'}</div>}
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
        ) : <div style={{ fontSize: 12, color: TK.sub2 }}>{rot.unauth ? '로그인하면 보입니다.' : '로테이션 데이터 로드 실패.'}</div>}
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
              <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>
                💰 권장 현금 <b style={{ color: TK.violet300, fontFamily: 'monospace' }}>{cashBand}</b>
                {cash.d?.verdict && typeof cash.d.cashPct === 'number' ? (
                  <> · 내 현금 <b style={{ color: cash.d.verdict === 'inband' ? TK.green400 : cash.d.verdict === 'aggressive' ? TK.amber400 : TK.sky400, fontFamily: 'monospace' }}>{cash.d.cashPct}%</b></>
                ) : cash.d && !cash.d.needsSetup ? (
                  <> · <a href="/assets" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}>내 현금 등록 →</a></>
                ) : null}
              </span>
              {typeof marks.d.requiredMos === 'number' && (
                <span title="탐욕일수록 더 큰 할인을 요구 — 신규 매수는 공정가치 대비 이만큼 싼 가격에서만(모닝스타 별점 할인율과 비교)" style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🎯 요구 안전마진 <b style={{ color: temp >= 58 ? TK.red400 : temp <= 42 ? TK.green400 : TK.amber400, fontFamily: 'monospace' }}>{marks.d.requiredMos}%</b></span>
              )}
            </>)}
            {reco.d && (
              <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>🌦️ 계절 🇺🇸 <b style={{ color: TK.slate300 }}>{reco.d.usSeason.label}</b> · 🇰🇷 <b style={{ color: TK.slate300 }}>{reco.d.krSeason.label}</b></span>
            )}
            {breadth.d && (breadth.d.us || breadth.d.kr) && (
              <span title="추천 유니버스 중 200일선 위에 있는 종목 비율 — 지수가 올라도 이 수치가 낮으면 소수 대형주 장세(상세는 막스 시계추 탭)" style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 11px' }}>
                📊 시장 속살(200일선 위)
                {breadth.d.us && <> 🇺🇸 <b style={{ color: breadth.d.us.pctAbove200 >= 45 ? TK.green400 : breadth.d.us.pctAbove200 >= 25 ? TK.amber400 : TK.sky400, fontFamily: 'monospace' }}>{breadth.d.us.pctAbove200}%</b></>}
                {breadth.d.kr && <> · 🇰🇷 <b style={{ color: breadth.d.kr.pctAbove200 >= 45 ? TK.green400 : breadth.d.kr.pctAbove200 >= 25 ? TK.amber400 : TK.sky400, fontFamily: 'monospace' }}>{breadth.d.kr.pctAbove200}%</b></>}
              </span>
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
