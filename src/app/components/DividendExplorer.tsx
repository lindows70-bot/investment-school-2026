'use client'

/**
 * 💰 DividendExplorer — 글로벌 배당 익스플로러 & 세이프티 가드
 *
 * 포트폴리오 미보유 종목도 자유롭게 배당 탐색 + 배당 함정(Dividend Trap) 경보.
 *  · 프리셋 탭 3개: 배당 귀족주 / 인기 월배당 / 초고배당·파생 주의
 *  · 썸네일 카드 클릭 → 상세 진단 레이어
 *  · 파생 ETF·배당성향 과다·FCF 적자 → 피터 린치 경고 카드
 *
 * 데이터: /api/dividend-explorer (48h 캐시 · 인증 불필요)
 */

import { useState, useCallback } from 'react'
import type { DividendProfile } from '@/app/api/dividend-explorer/route'
import { TK } from '@/lib/theme'

// ── 색상 (기존 프로젝트 다크 테마 계승) ──────────────────────────────────────
const C = {
  bg:      TK.slate950,
  surface: TK.slate900,
  card:    TK.bg7,
  card2:   TK.bg5,
  border:  TK.line1,
  text:    TK.slate100,
  textSub: '#b0bec8',
  textLow: '#8a9db5',
  green:   TK.green400,
  red:     TK.red400,
  gold:    TK.amber500,
  orange:  TK.orange400,
  cyan:    TK.cyan400,
  pink:    TK.pink400,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// ── 프리셋 탭 정의 ───────────────────────────────────────────────────────────
type PresetKey = 'aristocrat' | 'growth' | 'monthly' | 'highdiv'
const PRESETS: Record<PresetKey, { label: string; icon: string; tickers: string[]; accent: string }> = {
  aristocrat: {
    label: '배당 귀족주', icon: '🏆',
    tickers: ['O', 'KO', 'PEP', 'JNJ'],
    accent: C.gold,
  },
  growth: {   // 🌱 배당 성장주 — 낮은 배당성향·높은 성장률(장기 Yield on Cost 극대화)
    label: '배당 성장주', icon: '🌱',
    tickers: ['MDLZ', 'SPGI', 'ADP', 'PH'],
    accent: C.green,
  },
  monthly: {
    label: '인기 월배당', icon: '📅',
    tickers: ['O', 'MAIN', 'STAG'],
    accent: C.cyan,
  },
  highdiv: {
    label: '초고배당/파생 주의', icon: '⚠️',
    tickers: ['MSTY', 'JEPI', 'TSLY'],
    accent: C.orange,
  },
}

// ── 배당 등급·스타일 메타 ────────────────────────────────────────────────────
const GRADE_META: Record<'king' | 'aristocrat' | 'achiever' | 'challenger', { label: string; desc: string; color: string }> = {
  king:       { label: '👑 배당 킹',    desc: '50년+ 연속 인상', color: '#facc15' },
  aristocrat: { label: '🏆 배당 귀족',  desc: '25년+ 연속 인상', color: '#fbbf24' },
  achiever:   { label: '🥇 배당 성취자', desc: '10년+ 연속 인상', color: '#38bdf8' },
  challenger: { label: '🌱 배당 도전자', desc: '5년+ 연속 인상',  color: '#4ade80' },
}
const STYLE_META: Record<'high_yield' | 'growth' | 'balanced', { label: string; desc: string; color: string }> = {
  high_yield: { label: '💵 고수익형', desc: '즉시 현금흐름 (VZ·리얼티인컴형)', color: '#fb923c' },
  growth:     { label: '🌱 성장형',   desc: '장기 복리·Yield on Cost (몬델레즈·SPGI형)', color: '#4ade80' },
  balanced:   { label: '⚖️ 균형형',   desc: '수익률·성장 균형', color: '#38bdf8' },
}
const safetyColor = (grade: string | null) =>
  grade === '매우 안전' ? '#4ade80' : grade === '안전' ? '#38bdf8' : grade === '보통' ? '#facc15' : grade === '주의' ? '#fb923c' : '#f87171'

// ── 유틸 ─────────────────────────────────────────────────────────────────────
// 배당성향: Yahoo는 소수(0.52=52%, 1.2=120%)로 반환 → ×100 표시
const pct = (v: number | null) => v == null ? '—' : (v * 100).toFixed(2) + '%'
// 통화 인식 포맷: KRW는 ₩ + 정수, USD는 $ + 소수점2
const fmtCurrency = (v: number | null, currency: string) => {
  if (v == null) return '—'
  if (currency === 'KRW') return '₩' + Math.round(v).toLocaleString('ko-KR')
  return '$' + v.toFixed(2)
}
// FCF: 원화는 10억(B) 기준, 달러도 B 기준
const fmtFcf = (v: number | null, currency: string) => {
  if (v == null) return null
  if (currency === 'KRW') {
    const b = v / 1e8   // 억원 단위
    return (v >= 0 ? '+' : '') + (Math.abs(b) >= 10000
      ? (b / 10000).toFixed(1) + '조원'
      : Math.round(b).toLocaleString() + '억원')
  }
  const b = v / 1e9
  return (v >= 0 ? '+' : '') + b.toFixed(1) + 'B'
}
const FREQ_LABEL = { monthly: '월배당', quarterly: '분기', annual: '연배당', unknown: '—' }
const FREQ_COLOR = { monthly: C.cyan, quarterly: C.gold, annual: C.textSub, unknown: C.textLow }

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────
function Skeleton({ n = 3 }: { n?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <style>{`@keyframes divShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ width: 140, height: 96, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${C.border}55,transparent)`, animation: `divShimmer 1.4s infinite`, animationDelay: `${i * 0.15}s` }} />
        </div>
      ))}
    </div>
  )
}

// ── 썸네일 카드 ───────────────────────────────────────────────────────────────
function ThumbnailCard({ profile, accent, onClick, isActive }: {
  profile: DividendProfile; accent: string; onClick: () => void; isActive: boolean
}) {
  const yld = profile.dividendYield
  const isWarning = profile.isTrapWarning
  const border = isActive ? accent : isWarning ? `${C.orange}55` : C.border
  return (
    <button onClick={onClick} style={{
      width: 140, padding: '10px 12px', borderRadius: 12,
      background: isActive ? `${accent}14` : C.card,
      border: `1.5px solid ${border}`, cursor: 'pointer',
      textAlign: 'left', fontFamily: FONT, transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? accent : C.text, marginBottom: 3 }}>
        {profile.name.slice(0, 12)}
      </div>
      <div style={{ fontSize: 10, color: C.textLow, marginBottom: 5, fontFamily: 'monospace' }}>{profile.ticker}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: isWarning ? C.orange : C.green, fontFamily: 'monospace' }}>
        {yld != null ? (yld * 100).toFixed(1) + '%' : '—'}
      </div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: FREQ_COLOR[profile.frequency] }}>{FREQ_LABEL[profile.frequency]}</span>
        {profile.dividendGrade && <span title={GRADE_META[profile.dividendGrade].desc}>{GRADE_META[profile.dividendGrade].label.split(' ')[0]}</span>}
        {profile.dividendGrowth5y != null && profile.dividendGrowth5y >= 0.05 &&
          <span style={{ color: C.green }}>↑{(profile.dividendGrowth5y * 100).toFixed(0)}%</span>}
        {isWarning && <span style={{ color: C.orange, marginLeft: 'auto' }}>⚠️</span>}
      </div>
    </button>
  )
}

// ── 배당 함정 경고 카드 ────────────────────────────────────────────────────────
function TrapWarningCard({ profile }: { profile: DividendProfile }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12, marginTop: 12,
      background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.4)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: C.orange, marginBottom: 8 }}>
        ⚠️ 배당 함정(Dividend Trap) 경보
      </div>
      <div style={{ fontSize: 12.5, color: '#fed7aa', lineHeight: 1.75, marginBottom: 10 }}>
        본 종목은 배당률은 높으나{' '}
        {profile.isDerivativeEtf
          ? <><b>파생 옵션 프리미엄을 재원</b>으로 삼고 있어, 주가 우하향 시 원금이 잠식되는 구조입니다.</>
          : <><b>배당성향이 과도하거나 현금흐름 체력이 약해</b> 배당을 지속하기 어려울 수 있습니다.</>
        }
        {' '}투자학교 학생들은 배당률 숫자가 아닌 <b>기업의 펀더멘털과 현금흐름 체력</b>을 먼저 점검하세요.
      </div>
      {profile.trapReasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {profile.trapReasons.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: C.orange, display: 'flex', gap: 6 }}>
              <span>•</span><span>{r}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: '#fdba74', fontStyle: 'italic', borderTop: '1px solid rgba(251,146,60,0.25)', paddingTop: 8 }}>
        &ldquo;높은 배당률은 투자자를 유혹하는 가장 달콤한 함정이다. 진짜 좋은 배당주는 이익 성장으로 배당을 늘리는 기업이다.&rdquo; — 피터 린치
      </div>
    </div>
  )
}

// ── 🌱 배당 성장 프로필 패널 (배당 성장률·안전성·Yield on Cost·바벨) ──────────
function GrowthPanel({ profile }: { profile: DividendProfile }) {
  const g5 = profile.dividendGrowth5y, g1 = profile.dividendGrowth1y
  const grade = profile.dividendGrade ? GRADE_META[profile.dividendGrade] : null
  const style = profile.style ? STYLE_META[profile.style] : null
  const hasYoc = profile.dividendYield != null && profile.yoc10y != null
  const pctSigned = (v: number | null) => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
  const sc = profile.safetyScore, sg = profile.safetyGrade

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: `linear-gradient(135deg,${TK.bg0},${C.card2})`, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 11 }}>🌱 배당 성장 프로필</div>

      {/* 배지 행: 등급 · 스타일 · 안전성 점수 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {grade && (
          <div title={grade.desc} style={{ padding: '5px 11px', borderRadius: 8, background: `${grade.color}18`, border: `1px solid ${grade.color}55` }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: grade.color }}>{grade.label}</span>
            <span style={{ fontSize: 10, color: C.textLow, marginLeft: 6 }}>{grade.desc}{profile.streakEstimated ? ' (추정)' : ''}</span>
          </div>
        )}
        {style && (
          <div title={style.desc} style={{ padding: '5px 11px', borderRadius: 8, background: `${style.color}18`, border: `1px solid ${style.color}55` }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: style.color }}>{style.label}</span>
            <span style={{ fontSize: 10, color: C.textLow, marginLeft: 6 }}>{style.desc}</span>
          </div>
        )}
        {sc != null && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 11px', borderRadius: 8, background: `${safetyColor(sg)}14`, border: `1px solid ${safetyColor(sg)}55` }}>
            <span style={{ fontSize: 10, color: C.textLow }}>안전성</span>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: safetyColor(sg) }}>{sc}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: safetyColor(sg) }}>{sg}</span>
          </div>
        )}
      </div>

      {/* 성장률 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: hasYoc ? 12 : 0 }}>
        {[
          { k: '배당 성장률(5년)', v: g5 != null ? pctSigned(g5) : '—', c: g5 == null ? C.textLow : g5 >= 0.05 ? C.green : g5 < 0 ? C.red : C.gold, note: '연평균' },
          { k: '최근 1년 인상', v: g1 != null ? pctSigned(g1) : '—', c: g1 == null ? C.textLow : g1 >= 0 ? C.green : C.red, note: '전년比' },
          { k: 'FCF 배당 커버', v: profile.fcfCover != null ? profile.fcfCover.toFixed(1) + '배' : profile.isReit ? 'AFFO' : '—',
            c: profile.fcfCover == null ? C.textLow : profile.fcfCover >= 1.5 ? C.green : profile.fcfCover >= 1 ? C.gold : C.red, note: '현금 여력' },
        ].map(m => (
          <div key={m.k} style={{ padding: '9px 11px', borderRadius: 9, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.textLow, marginBottom: 3 }}>{m.k}</div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 8.5, color: C.textLow, marginTop: 1 }}>{m.note}</div>
          </div>
        ))}
      </div>

      {/* Yield on Cost 프로젝션 — 지금 배당률이 성장하면 취득원가 대비 얼마가 되나 */}
      {hasYoc && (
        <div style={{ padding: '11px 13px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 8 }}>
            💎 Yield on Cost — 지금 사서 배당이 연 {((profile.yocProjRate ?? 0) * 100).toFixed(1)}%씩 성장하면
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {[
              { label: '현재', v: profile.dividendYield! },
              { label: '5년 후', v: profile.yoc5y! },
              { label: '10년 후', v: profile.yoc10y! },
            ].map((s, i) => {
              const maxV = profile.yoc10y!
              const h = Math.max(14, Math.round((s.v / maxV) * 56))
              const col = i === 0 ? C.textLow : i === 1 ? C.cyan : C.green
              return (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: col, marginBottom: 4 }}>{(s.v * 100).toFixed(1)}%</div>
                  <div style={{ height: h, borderRadius: 5, background: `linear-gradient(180deg,${col},${col}66)` }} />
                  <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 4 }}>{s.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 9, color: C.textLow, marginTop: 8, lineHeight: 1.5 }}>
            {profile.style === 'growth'
              ? '지금 배당률은 낮아도 성장률이 높아 오래 보유할수록 취득원가 대비 수익률이 급증합니다(리포트: 삼양·기아형).'
              : '성장률은 초기 급등 후 둔화 가정해 연 15%로 캡을 씌운 보수적 추정입니다(예측 아님·참고용).'}
          </div>
        </div>
      )}

      {/* 리츠 AFFO 안내 */}
      {profile.affoNote && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.3)', fontSize: 10.5, color: '#bae6fd', lineHeight: 1.6 }}>
          🏢 <b>리츠(REIT)</b>는 과세소득의 90% 이상을 의무 배당해 순이익 배당성향이 늘 100%+로 나옵니다 — 함정이 아니라
          <b> AFFO(조정 운영현금흐름) 기준 배당성향 75% 이하</b>인지로 판단해야 합니다(리포트: 리얼티인컴 AFFO 70~75%).
        </div>
      )}
    </div>
  )
}

// ── 상세 진단 패널 ────────────────────────────────────────────────────────────
function DetailPanel({ profile }: { profile: DividendProfile }) {
  const isTrap = profile.isTrapWarning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cur = (profile as any).currency as string || (profile.market === 'KR' ? 'KRW' : 'USD')
  const fcfStr = fmtFcf(profile.fcf, cur)
  return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${isTrap ? C.orange + '55' : C.border}` }}>
      {/* 종목 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: C.text }}>{profile.name}</span>
        <span style={{ fontSize: 11, color: C.textLow, fontFamily: 'monospace' }}>{profile.ticker} · {profile.market}</span>
        {profile.isDerivativeEtf && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${C.orange}22`, color: C.orange, fontWeight: 700 }}>파생 ETF</span>
        )}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${FREQ_COLOR[profile.frequency]}22`, color: FREQ_COLOR[profile.frequency], fontWeight: 700 }}>
          {FREQ_LABEL[profile.frequency]}
        </span>
        {cur === 'KRW' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: `${C.cyan}18`, color: C.cyan, fontWeight: 700 }}>KRW</span>}
      </div>

      {/* KPI 4칸 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }} className="de-kpi">
        {[
          { k: '시가배당률',
            v: profile.dividendYield != null ? (profile.dividendYield * 100).toFixed(2) + '%' : '—',
            c: profile.dividendYield != null && profile.dividendYield > 0.08 ? C.orange : C.green },
          { k: cur === 'KRW' ? '연간 배당금(₩)' : '연간 배당금',
            v: fmtCurrency(profile.annualDividend, cur), c: C.text },
          { k: '배당성향',
            v: pct(profile.payoutRatio),
            c: profile.payoutRatio != null && profile.payoutRatio > 0.8 ? C.orange : C.gold },
          { k: '연속 성장', v: profile.consecutiveYears != null ? profile.consecutiveYears + '년' : '—', c: C.cyan },
        ].map(m => (
          <div key={m.k} style={{ padding: '10px 12px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 4 }}>{m.k}</div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* FCF 표시 */}
      {fcfStr != null && (
        <div style={{ fontSize: 11, color: profile.fcf! < 0 ? C.red : C.textSub, marginBottom: 10 }}>
          FCF(잉여현금흐름): <b style={{ fontFamily: 'monospace' }}>{fcfStr}</b>
          {profile.fcf! < 0 && <span style={{ color: C.red, marginLeft: 6 }}>⚠️ 배당 지속 위험</span>}
        </div>
      )}

      {/* 🌱 배당 성장 프로필 (성장률·안전성·Yield on Cost·바벨) */}
      <GrowthPanel profile={profile} />

      {/* 배당 함정 경고 */}
      {isTrap && <TrapWarningCard profile={profile} />}

      {/* 현재가 */}
      {profile.price != null && (
        <div style={{ marginTop: 10, fontSize: 10.5, color: C.textLow }}>
          현재가 <span style={{ fontFamily: 'monospace', color: C.textSub }}>{fmtCurrency(profile.price, cur)}</span>
          {' '}· 48h 캐시 · {profile.asOf.slice(0, 10)}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function DividendExplorer() {
  const [activePreset, setActivePreset] = useState<PresetKey>('aristocrat')
  const [presetCache, setPresetCache]   = useState<Record<string, DividendProfile>>({})
  const [presetLoading, setPresetLoading] = useState<Record<PresetKey, boolean>>({ aristocrat: false, growth: false, monthly: false, highdiv: false })
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState<DividendProfile | null>(null)
  const [searching, setSearching] = useState(false)

  // 프리셋 탭 전환 시 데이터 로드
  const loadPreset = useCallback(async (key: PresetKey) => {
    setActivePreset(key)
    setSelected(null)
    const tickers = PRESETS[key].tickers.filter(t => !presetCache[t])
    if (!tickers.length) return
    setPresetLoading(p => ({ ...p, [key]: true }))
    await Promise.all(tickers.map(async t => {
      try {
        const r = await fetch(`/api/dividend-explorer?ticker=${t}&market=US`, { cache: 'no-store' })
        const j: DividendProfile = await r.json()
        setPresetCache(c => ({ ...c, [t]: j }))
      } catch { /* graceful */ }
    }))
    setPresetLoading(p => ({ ...p, [key]: false }))
  }, [presetCache])

  // 첫 렌더에서 기본 프리셋 로드
  const [didInit, setDidInit] = useState(false)
  if (!didInit) { setDidInit(true); loadPreset('aristocrat') }

  // 직접 검색
  const handleSearch = useCallback(async (tk: string) => {
    const t = tk.trim().toUpperCase(); if (!t) return
    setQuery(t); setSearching(true)
    try {
      const mkt = /^\d{6}$/.test(t) ? 'KR' : 'US'
      const r = await fetch(`/api/dividend-explorer?ticker=${t}&market=${mkt}`, { cache: 'no-store' })
      const j: DividendProfile = await r.json()
      setSelected(j); setPresetCache(c => ({ ...c, [t]: j }))
    } catch { setSelected(null) }
    setSearching(false)
  }, [])

  const preset = PRESETS[activePreset]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>

      {/* ── 헤더 ── */}
      <div style={{ padding: '16px 20px', borderRadius: 14, background: `linear-gradient(135deg,${TK.bg0},${C.card})`, border: `1px solid #1e3050` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>글로벌 배당 익스플로러</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.gold}22`, color: C.gold, fontWeight: 700 }}>Safety Guard</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.textLow }}>포트폴리오 미보유 종목도 탐색 · 배당 함정 자동 경보 · 48h 캐시</div>
      </div>

      {/* ── 검색창 ── */}
      <div style={{ padding: '14px 16px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
            placeholder="티커 직접 검색 (예: O, KO, 005930)"
            style={{ flex: 1, padding: '9px 13px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: 'none', fontFamily: FONT }}
          />
          <button onClick={() => handleSearch(query)} disabled={searching || !query.trim()}
            style={{ padding: '9px 18px', borderRadius: 9, background: searching ? '#1e3050' : '#1e40af', color: C.text, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            {searching ? '⏳' : '🔍 분석'}
          </button>
        </div>

        {/* ── 프리셋 탭 ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {(Object.keys(PRESETS) as PresetKey[]).map(k => (
            <button key={k} onClick={() => loadPreset(k)}
              style={{
                padding: '6px 12px', borderRadius: 20, border: `1px solid ${activePreset === k ? PRESETS[k].accent : C.border}`,
                background: activePreset === k ? `${PRESETS[k].accent}18` : 'transparent',
                color: activePreset === k ? PRESETS[k].accent : C.textLow,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              }}>
              {PRESETS[k].icon} {PRESETS[k].label}
            </button>
          ))}
        </div>

        {/* ── 썸네일 카드 그리드 ── */}
        {presetLoading[activePreset]
          ? <Skeleton n={preset.tickers.length} />
          : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {preset.tickers.map(t => {
                const p = presetCache[t]
                if (!p) return (
                  <div key={t} style={{ width: 140, height: 96, borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: C.textLow }}>{t}…</span>
                  </div>
                )
                return <ThumbnailCard key={t} profile={p} accent={preset.accent}
                  isActive={selected?.ticker === t || query === t}
                  onClick={() => { setQuery(t); setSelected(p) }} />
              })}
            </div>
          )
        }
      </div>

      {/* ── 상세 진단 패널 ── */}
      {searching && (
        <div style={{ padding: '24px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, textAlign: 'center', color: C.textLow, fontSize: 13 }}>
          ⏳ 배당 데이터 수집 중…
        </div>
      )}
      {!searching && selected && <DetailPanel profile={selected} />}

      {/* 바벨 전략 안내 */}
      <div style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.22)' }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.green, marginBottom: 5 }}>⚖️ 고수익 ↔ 성장 배당 바벨 전략</div>
        <div style={{ fontSize: 10.5, color: C.textSub, lineHeight: 1.7 }}>
          <b style={{ color: C.orange }}>💵 고수익형</b>(VZ·리얼티인컴)은 <b>지금 당장의 현금흐름</b>을,
          <b style={{ color: C.green }}> 🌱 성장형</b>(몬델레즈·SPGI)은 <b>장기 배당 증액으로 취득원가 대비 수익률(Yield on Cost)</b>을 극대화합니다.
          단순 고배당률이 아니라 <b>배당 성장률·안전성·현금 여력</b>을 함께 봐야 진짜 배당주를 가릅니다.
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6, padding: '0 4px' }}>
        👑 배당 킹 50년+ / 🏆 귀족 25년+ / 🥇 성취자 10년+ / 🌱 도전자 5년+ 연속 인상 · 성장률·연속 인상은 Yahoo 지급 이력 실측(귀족주 이상은 공식 자료 병용) ·
        파생 ETF(MSTY·JEPI 등)=Covered Call 옵션 프리미엄 재원(원금 잠식 위험) · 리츠는 AFFO 기준 · 48h 캐시 · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
      <style>{`@media(max-width:600px){.de-kpi{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </div>
  )
}
