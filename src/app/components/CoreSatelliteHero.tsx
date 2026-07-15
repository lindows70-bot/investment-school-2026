'use client'
// 🎯 코어-새틀라이트 처방전 히어로 — 자산군 구성·코어밴드·캡 게이지 + 버릴/줄일/보강 3액션
import type { CoreSatelliteView, ActionItem, BuyIdea } from '@/app/api/ai-rebalance/route'
import SectorBadge from '@/app/components/SectorBadge'
import TimingBadge from '@/app/components/TimingBadge'
import { TK } from '@/lib/theme'

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
          {cs.add.map((a: BuyIdea, i: number) => (
            <div key={`${a.ticker}-${i}`} style={{ background: TK.bg3, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12 }}>{a.ticker === 'CORE' || a.ticker === 'BTC' ? a.name : dnm(a.market, a.name, a.ticker)}</span>
                <SectorBadge sector={a.sector} size="xs" />
                {a.targetPct > 0 && <span style={{ color: TK.green500, fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace' }}>+{a.targetPct}%{wonTag(a.targetPct, pv)}</span>}
                <span style={{ marginLeft: 'auto' }}><Tag t={a.tag} color={TK.green500} /></span>
              </div>
              <div style={{ color: TK.sub13, fontSize: 11, lineHeight: 1.5 }}>{a.reason}</div>
              {a.timing && <div style={{ marginTop: 4 }}><TimingBadge t={a.timing} market={a.market} compact /></div>}
            </div>
          ))}
        </ActionCard>
      </div>

      {/* 조언형 실행 가이드 */}
      <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, padding: '10px 14px', color: '#bfdbfe', fontSize: 11.5, lineHeight: 1.7 }}>
        🧭 <b>실행 가이드</b> — {cs.guide}
      </div>
    </div>
  )
}
