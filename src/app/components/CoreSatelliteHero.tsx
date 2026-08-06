'use client'
// 🎯 코어-새틀라이트 처방전 히어로 — 자산군 구성·코어밴드·캡 게이지 + 버릴/줄일/보강 3액션
import { useState, useEffect } from 'react'
import type { CoreSatelliteView, ActionItem, BuyIdea } from '@/app/api/ai-rebalance/route'
import SectorBadge from '@/app/components/SectorBadge'
import TimingBadge from '@/app/components/TimingBadge'
import MastersBadge from '@/app/components/MastersBadge'
import { TK, FS } from '@/lib/theme'
import { flagOf } from '@/lib/marketFlag'

const CARD = TK.bg6, BORDER = TK.border
const ROLE_COLOR: Record<string, string> = {
  CORE_INDEX: TK.blue500, CORE_BOND: TK.cyan400, SATELLITE_BTC: TK.amber500,
  SATELLITE_GHOST: TK.violet400, SATELLITE_GENERAL: TK.green500, BLOCKED: TK.red500,
}
function wonTag(pct: number, pv: number): string {
  const won = (pct / 100) * pv
  if (won <= 0) return ''
  return won >= 1e8 ? ` ≈ ${(won / 1e8).toFixed(2)}억` : ` ≈ ${Math.round(won / 1e4).toLocaleString()}만`
}
const dnm = (m: string, n: string, t: string) => (m === 'KR' ? (n || t).slice(0, 12) : t)

function CapGauge({ label, pct, cap, color }: { label: string; pct: number; cap: number; color: string }) {
  const over = pct > cap
  const w = Math.min((pct / (cap * 1.6)) * 100, 100)
  return (
    <div style={{ flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: TK.slate400, fontSize: 11 }}>{label}</span>
        <span style={{ color: over ? TK.red500 : TK.slate300, fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace' }}>{pct}% / 캡 {cap}%</span>
      </div>
      <div style={{ height: 7, background: TK.bg3, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${w}%`, height: '100%', background: over ? TK.red500 : color, borderRadius: 4 }} />
        <div style={{ position: 'absolute', left: `${(cap / (cap * 1.6)) * 100}%`, top: 0, bottom: 0, width: 1.5, background: TK.slate200 }} />
      </div>
    </div>
  )
}

function Tag({ t, color }: { t: string; color: string }) {
  return <span style={{ background: `${color}1f`, color, border: `1px solid ${color}55`, borderRadius: 999, padding: '1px 7px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{t}</span>
}

function ActionCard({ icon, title, color, count, children }: { icon: string; title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 280px', minWidth: 260, background: CARD, borderRadius: 12, border: `1px solid ${color}44`, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ color, fontWeight: 800, fontSize: 13.5 }}>{title}</span>
        <span style={{ marginLeft: 'auto', color: TK.slate500, fontSize: 12, fontWeight: 700 }}>{count}</span>
      </div>
      {count === 0
        ? <div style={{ color: TK.slate500, fontSize: 11.5, padding: '6px 0' }}>해당 없음 ✓</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>}
    </div>
  )
}

export default function CoreSatelliteHero({ cs, portfolioValue }: { cs: CoreSatelliteView; portfolioValue: number }) {
  const coreOk = cs.corePct >= cs.coreTargetMin && cs.corePct <= cs.coreTargetMax
  const pv = cs.totalValue > 0 ? cs.totalValue : portfolioValue   // 전 자산 총액 우선(원화 환산 정확도)

  // 🎩 '보강할 것'(액션 표면)의 위원회 관문 — 배지만으론 부족하다("배지는 숫자를 상쇄하지 못한다").
  //    실증된 축만 강하게: ① 회계 품질 레드라인(이익-현금 괴리·ROE 부풀림 — 1,089건 시뮬 절사초과 −3.5%p 실증)
  //    은 목록에서 **제외**(제외 사실 명시). ② 그 외 불통과(기저효과·기대과도 — 역인과라 유죄 증거 없음)는
  //    **후순위 + 경고 문구**. 정보 표면(통합추천 15종)은 배지 병기 유지 — 액션 표면만 관문을 세운다.
  const [verdicts, setVerdicts] = useState<Record<string, { final: string; acctBad: boolean }>>({})
  const stockAdds = cs.add.filter((a: BuyIdea) => a.ticker !== 'CORE' && a.ticker !== 'BTC')
  const addKey = stockAdds.map((a: BuyIdea) => a.ticker).join(',')
  useEffect(() => {
    if (!stockAdds.length) return
    let cancelled = false
    const out: Record<string, { final: string; acctBad: boolean }> = {}
    Promise.all(stockAdds.map(async (a: BuyIdea) => {
      try {
        const r = await fetch(`/api/masters-verdict?ticker=${encodeURIComponent(a.ticker)}&market=${a.market === 'KR' ? 'KR' : 'US'}&brief=1`)
        const j = await r.json()
        if (j?.final) out[a.ticker] = {
          final: j.final,
          acctBad: (j.redlines ?? []).some((rl: { key: string; hit: boolean }) => rl.hit && (rl.key === 'quality_gap' || rl.key === 'roe_inflated')),
        }
      } catch { /* 판정 없음 = 관문 미적용(정보 부족으로 제외하지 않는다 — 제외는 실증 축에만) */ }
    })).then(() => { if (!cancelled) setVerdicts(out) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addKey])

  // 정렬·제외 적용된 보강 목록: CORE·BTC(자산군 제안)는 항상 앞, 주식은 비불통과 → 불통과 순, 회계품질 레드라인은 제외
  const acctExcluded = stockAdds.filter((a: BuyIdea) => verdicts[a.ticker]?.acctBad)
  const addOrdered: BuyIdea[] = [
    ...cs.add.filter((a: BuyIdea) => a.ticker === 'CORE' || a.ticker === 'BTC'),
    ...stockAdds.filter((a: BuyIdea) => !verdicts[a.ticker]?.acctBad && verdicts[a.ticker]?.final !== 'fail'),
    ...stockAdds.filter((a: BuyIdea) => !verdicts[a.ticker]?.acctBad && verdicts[a.ticker]?.final === 'fail'),
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 자산군 구성 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>🎯 자산군 구성 (코어-새틀라이트)</span>
          <span style={{ color: TK.sub2, fontSize: 11 }}>전 자산 기준 · 캡: BTC·유령 각 {cs.capPct}%</span>
        </div>
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
          {cs.groups.map(g => <div key={g.role} title={`${g.label} ${g.pct}%`} style={{ width: `${g.pct}%`, background: ROLE_COLOR[g.role] ?? TK.slate500 }} />)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 11 }}>
          {cs.groups.map(g => (
            <span key={g.role} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: TK.slate400 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_COLOR[g.role] ?? TK.slate500 }} />
              {g.label} <b style={{ color: TK.slate200, fontFamily: 'monospace' }}>{g.pct}%</b>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: TK.slate400, fontSize: 11 }}>코어 (목표 {cs.coreTargetMin}~{cs.coreTargetMax}%)</span>
              <span style={{ color: coreOk ? TK.green500 : TK.amber500, fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace' }}>{cs.corePct}% {coreOk ? '적정' : cs.corePct < cs.coreTargetMin ? '부족' : '과다'}</span>
            </div>
            <div style={{ height: 7, background: TK.bg3, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: `${cs.coreTargetMin}%`, width: `${cs.coreTargetMax - cs.coreTargetMin}%`, top: 0, bottom: 0, background: 'rgba(34,197,94,0.25)' }} />
              <div style={{ width: `${Math.min(cs.corePct, 100)}%`, height: '100%', background: coreOk ? TK.green500 : TK.amber500, borderRadius: 4 }} />
            </div>
            <div style={{ color: TK.slate500, fontSize: 9.5, marginTop: 2 }}>{cs.coreTargetText}</div>
          </div>
          <CapGauge label="₿ 비트코인" pct={cs.btcPct} cap={cs.capPct} color={ROLE_COLOR.SATELLITE_BTC} />
          <CapGauge label="👻 유령/10배거" pct={cs.ghostPct} cap={cs.capPct} color={ROLE_COLOR.SATELLITE_GHOST} />
        </div>
      </div>

      {/* 3액션 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ActionCard icon="🗑️" title="버릴 것" color={TK.red500} count={cs.drop.length}>
          {cs.drop.map((a: ActionItem) => (
            <div key={a.ticker} style={{ background: TK.bg3, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12 }}>{dnm(a.market, a.name, a.ticker)}</span>
                <SectorBadge sector={a.sector} size="xs" />
                <span style={{ color: TK.slate500, fontSize: 10, fontFamily: 'monospace' }}>{a.weightPct}%{wonTag(a.weightPct, pv)}</span>
                <span style={{ marginLeft: 'auto' }}><Tag t={a.tag} color={TK.red500} /></span>
              </div>
              <div style={{ color: TK.sub13, fontSize: 11, lineHeight: 1.5 }}>{a.reason}</div>
            </div>
          ))}
        </ActionCard>

        <ActionCard icon="✂️" title="줄일 것" color={TK.amber500} count={cs.trim.length}>
          {cs.trim.map((a: ActionItem) => (
            <div key={a.ticker} style={{ background: TK.bg3, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12 }}>{dnm(a.market, a.name, a.ticker)}</span>
                <SectorBadge sector={a.sector} size="xs" />
                {a.trimPct != null && <span style={{ color: TK.amber500, fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace' }}>−{a.trimPct}%p{wonTag(a.trimPct, pv)}</span>}
                <span style={{ marginLeft: 'auto' }}><Tag t={a.tag} color={TK.amber500} /></span>
              </div>
              <div style={{ color: TK.sub13, fontSize: 11, lineHeight: 1.5 }}>{a.reason}</div>
            </div>
          ))}
        </ActionCard>

        <ActionCard icon="🛒" title="보강할 것" color={TK.green500} count={cs.add.length}>
          {/* ⚠️ 통합추천을 못 받은 상태를 숨기지 않는다 — 안 알리면 '보강 6종'이 어느 날 2종이 되고 학생은 이유를 모른다 */}
          {cs.buysUnavailable && (
            <div style={{ background: 'rgba(251,146,60,0.09)', border: `1px solid ${TK.orange400}55`, borderRadius: 7, padding: '7px 9px', marginBottom: 7, color: TK.amber400, fontSize: 10.5, lineHeight: 1.5 }}>
              ⚠️ 통합추천을 불러오지 못해 <b>개별 종목 보강이 빠졌습니다</b>(집계가 오래 걸릴 때 발생). 아래는 자산군 보강만입니다 — 잠시 후 새로고침해 주세요.
            </div>
          )}
          {addOrdered.map((a: BuyIdea, i: number) => (
            <div key={`${a.ticker}-${i}`} style={{ background: TK.bg3, borderRadius: 8, padding: '8px 10px', ...(verdicts[a.ticker]?.final === 'fail' ? { border: `1px solid ${TK.amber500}44`, opacity: 0.92 } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12 }}>{a.ticker === 'CORE' || a.ticker === 'BTC' ? a.name : dnm(a.market, a.name, a.ticker)}</span>
                <SectorBadge sector={a.sector} size="xs" />
                {a.targetPct > 0 && <span style={{ color: TK.green500, fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace' }}>+{a.targetPct}%{wonTag(a.targetPct, pv)}</span>}
                <span style={{ marginLeft: 'auto' }}><Tag t={a.tag} color={TK.green500} /></span>
              </div>
              <div style={{ color: TK.sub13, fontSize: 11, lineHeight: 1.5 }}>{a.reason}</div>
              {/* 🎩 거장 위원회 — '보강할 것'은 매수 축이라 위원회 판정이 그대로 맞는다.
                  ⛔ '버릴 것·줄일 것'에는 붙이지 않는다 — 위원회는 매수 관점이라 불통과를 매도 지시로 읽히게 된다. */}
              {a.ticker !== 'CORE' && a.ticker !== 'BTC' && (
                <div style={{ marginTop: 4 }}><MastersBadge ticker={a.ticker} market={a.market} /></div>
              )}
              {/* ⚠️ 불통과(기저효과·기대과도 등 — 회계 품질 제외)는 목록에 남되 권유 문구를 뒤집는다 */}
              {verdicts[a.ticker]?.final === 'fail' && (
                <div style={{ marginTop: 4, color: TK.amber400, fontSize: FS.micro, lineHeight: 1.5 }}>
                  ⚠️ 거장 위원회 <b>불통과</b> — 점수는 상위지만 위원회 관문(레드라인)에 걸렸습니다. 새 돈은 <b>소액·분할만</b>, 사유는 위 배지에서 확인하세요.
                </div>
              )}
              {a.timing && <div style={{ marginTop: 4 }}><TimingBadge t={a.timing} market={a.market} compact /></div>}
              {/* 🔬 ETF 분산 대안 — 같은 섹터를 ETF로 분산 진입(점수와 무관, 선택지 병기)
                  📉 ETF 자체가 급락 중이면 분산 대안이 아니다 → 권유를 경고로(통합추천과 동일 처리) */}
              {a.etfAlt && (() => {
                const etfDrop = a.etfAlt.timing?.supply?.sharpDrop ? a.etfAlt.timing.supply.dropFromHigh : null
                return (
                <div style={{ marginTop: 4, background: etfDrop != null ? 'rgba(251,146,60,0.07)' : 'rgba(56,189,248,0.06)', border: `1px solid ${etfDrop != null ? 'rgba(251,146,60,0.4)' : 'rgba(56,189,248,0.2)'}`, borderRadius: 6, padding: '5px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ color: etfDrop != null ? TK.orange400 : TK.blue300, fontWeight: 800, fontSize: 9.5 }}>🔬 ETF 분산 대안{etfDrop != null ? ' — 지금은 대기' : ''}</span>
                    <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 10.5 }}>{flagOf(a.etfAlt.market, a.etfAlt.ticker)} {a.etfAlt.name}</span>
                    <span style={{ color: TK.sub, fontSize: 9, fontFamily: 'monospace' }}>{a.etfAlt.ticker}</span>
                    <span style={{ color: TK.sub, fontSize: 9 }}>· {a.etfAlt.sectorLabel} 섹터{a.etfAlt.isFallback ? '(미국)' : ''}</span>
                    {a.etfAlt.blendedPeg != null && <span style={{ color: TK.blue400, fontSize: 9, fontFamily: 'monospace' }}>합산 PEG {a.etfAlt.blendedPeg.toFixed(2)}</span>}
                  </div>
                  {a.etfAlt.timing && <div style={{ marginTop: 3 }}><TimingBadge t={a.etfAlt.timing} market={a.etfAlt.market} compact /></div>}
                  {etfDrop != null && <div style={{ marginTop: 3, color: TK.amber400, fontSize: 9, lineHeight: 1.4 }}>⚠️ 이 섹터 ETF도 고점 대비 {etfDrop}% 급락 중 — 지금은 분산 대안이 되지 못합니다(섹터 전체 조정). 반등 확인 후.</div>}
                </div>
                )
              })()}
            </div>
          ))}
          {/* 제외를 조용히 숨기지 않는다 — 회계 품질 레드라인(실증 축)으로 뺀 종목은 사실을 명시 */}
          {acctExcluded.length > 0 && (
            <div style={{ color: TK.sub2, fontSize: FS.micro, lineHeight: 1.5, marginTop: 2 }}>
              🚧 위원회 <b style={{ color: TK.red400 }}>회계 품질 레드라인</b>(이익-현금 괴리·ROE 부풀림)으로 보강 목록에서 제외:
              {' '}{acctExcluded.map((a: BuyIdea) => dnm(a.market, a.name, a.ticker)).join(' · ')} — 자체 백테스트(1,089건)에서 실증된 유일한 나쁜 축이라 액션 목록에선 뺍니다.
            </div>
          )}
        </ActionCard>
      </div>

      {/* 조언형 실행 가이드 */}
      <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, padding: '10px 14px', color: '#bfdbfe', fontSize: 11.5, lineHeight: 1.7 }}>
        🧭 <b>실행 가이드</b> — {cs.guide}
      </div>
    </div>
  )
}
