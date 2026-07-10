'use client'
// 🔍 피터린치 자동 분석 — 검색 종목 1개를 6대 분류·PEG 해석·이익선 이격·종합 판정으로 자동 분석(위저드 없음)
import { LYNCH_CATEGORY_KR } from '@/lib/lynchAnalysis'
import { isHoldingCompany, isFinancialCompany } from '@/lib/assetClassifier'   // 🏢 지주사·🏦 금융주 — EPS·PEG·이익선 왜곡(지분법이익·투자손익)

const CARD = '#161b25', BORDER = '#1e293b'

// 카테고리별 린치 적정 PER(이익선 멀티플) — 고성장은 성장률 연동(린치: 적정PER≈성장률), 나머지는 캡
const CAT_MULT: Record<string, number> = { fast_grower: 25, stalwart: 16, cyclical: 12, slow_grower: 10, turnaround: 15, asset_play: 12 }

export interface LynchAutoProps {
  ticker: string; name: string; market: string
  per?: number | null; peg?: number | null; eps?: number | null
  epsGrowth?: number | null; currentPrice?: number | null; currency?: string
  lynchCategory?: string | null; lynchLabel?: string | null
}

export default function LynchAutoPanel(p: LynchAutoProps) {
  const cat = p.lynchCategory ?? null
  const catKr = (cat && LYNCH_CATEGORY_KR[cat]) || p.lynchLabel || '분류 미정'
  const peg = p.peg ?? null
  const g = p.epsGrowth ?? null
  const won = p.currency === 'KRW'
  const fmtPrice = (v: number) => won ? `₩${Math.round(v).toLocaleString()}` : `$${v.toFixed(2)}`

  // 기저효과 가드(SSOT 철학) — 작년 이익 붕괴 후 회복으로 PEG가 0에 수렴한 착시
  const pegSuspect = peg != null && peg > 0 && peg < 0.3 && g != null && g > 100
  // 🏢 지주사 — EPS가 자회사 지분법이익(예: SK스퀘어→SK하이닉스)에 휘둘려 PEG·이익선 비교가 왜곡 → NAV·SOTP로 평가
  const holding = isHoldingCompany(p.ticker, p.name)
  // 🏦 금융주(보험·은행) — EPS가 투자손익·대손에 휘둘려 이익선(EPS×PER)이 왜곡(보험은 PBR 0.45처럼 저PBR이라 이익선=고평가, 실제 가치는 P/B·내재가치) → 지주사가 아닐 때만
  const financial = !holding && isFinancialCompany(p.ticker, p.name)
  const special = holding || financial

  // PEG 해석
  const pegView = peg == null ? { label: 'PEG 데이터 없음', color: '#8a9aaa', desc: '성장률·PER 데이터가 부족합니다.' }
    : pegSuspect ? { label: '⚠️ 기저효과 착시', color: '#f59e0b', desc: `PEG ${peg.toFixed(2)}는 작년 이익 붕괴 후 회복(성장 ${g!.toFixed(0)}%)으로 0에 수렴한 착시 — 저평가 근거로 쓸 수 없습니다.` }
    : peg <= 0.5 ? { label: '✅ 강력 매수 구간', color: '#22c55e', desc: '성장 대비 크게 저평가(PEG ≤ 0.5).' }
    : peg <= 1.0 ? { label: '🟢 매수 적정', color: '#22c55e', desc: '성장 대비 합리적 저평가(PEG ≤ 1.0 = 린치 기준선).' }
    : peg <= 1.5 ? { label: '🔵 합리적 보유', color: '#60a5fa', desc: '적정~약간 고평가 구간(PEG 1.0~1.5).' }
    : peg <= 2.2 ? { label: '🟠 매도 경계', color: '#f59e0b', desc: '성장 대비 고평가 경계(PEG 1.5~2.2).' }
    : { label: '🔴 매도 검토', color: '#ef4444', desc: `성장 대비 고평가(PEG ${peg.toFixed(2)} > 2.2).` }

  // 이익선(Lynch Line) 이격 — EPS × 카테고리 적정PER
  const mult: number = (cat ? CAT_MULT[cat] : undefined) ?? 15
  const fairMult: number = cat === 'fast_grower' && g != null && g > 0 ? Math.min(30, Math.max(15, g)) : mult
  const eps = p.eps ?? null
  const price = p.currentPrice ?? null
  const fairPrice = eps != null && eps > 0 ? eps * fairMult : null
  const gapPct = fairPrice != null && price != null && price > 0 ? Math.round((price / fairPrice - 1) * 1000) / 10 : null
  const lineView = holding ? { color: '#a78bfa', t: '🏢 지주사 — EPS 기반 이익선 비교 부적합(자회사 지분법이익이 EPS를 왜곡). NAV·SOTP로 평가' }
    : financial ? { color: '#38bdf8', t: '🏦 금융주(보험·은행) — EPS 기반 이익선 비교 부적합(이익이 투자손익·대손에 휘둘림). P/B·ROE·내재가치(EV)로 평가' }
    : fairPrice == null ? null
    : gapPct == null ? null
    : gapPct <= -20 ? { color: '#22c55e', t: `이익선 대비 ${Math.abs(gapPct)}% 아래 — 저평가(매수 영역)` }
    : gapPct >= 20 ? { color: '#ef4444', t: `이익선 대비 +${gapPct}% 위 — 고평가(차익 영역)` }
    : { color: '#60a5fa', t: `이익선 ±${Math.abs(gapPct)}% — 적정 부근` }

  // 린치 종합 한 줄
  const summary = holding
    ? '🏢 지주사예요 — EPS·PEG·이익선이 자회사(예: SK스퀘어→SK하이닉스) 실적에 휘둘려 왜곡됩니다. 보유 자회사 가치 합산(NAV·SOTP)에 지주 할인을 적용해 평가하세요.'
    : financial
    ? '🏦 금융주(보험·은행)예요 — EPS가 투자손익·대손충당에 휘둘려 이익선(EPS×PER)이 왜곡됩니다(보험은 저PBR이라 이익선상 고평가로 보여도 P/B 기준 저평가일 수 있어요). PER 대신 P/B·ROE·내재가치(EV)로 평가하세요.'
    : pegSuspect
    ? '경기순환·턴어라운드 기저효과로 저PEG가 착시일 수 있어요 — 이익이 정점인지부터 확인하세요(린치의 경기순환 함정).'
    : peg != null && peg <= 1.0 && (cat === 'fast_grower' || cat === 'stalwart')
    ? '린치가 좋아할 자리 — 우량·고성장이 성장 대비 저평가(PEG ≤ 1.0). 단, 이익 성장이 꺾이지 않는지 추적하세요.'
    : peg != null && peg > 2.2
    ? '성장 대비 비쌉니다 — 좋은 회사라도 PEG가 높으면 린치는 사지 않습니다. 분할 익절·관망.'
    : '분류와 PEG·이익선을 함께 보세요 — 린치는 "내가 아는 사업 + 성장 대비 싼 가격"을 삽니다.'

  const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ flex: '1 1 220px', minWidth: 200, background: '#0f1117', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '11px 13px' }}>
      <div style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15 }}>🔍</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>피터린치 자동 분석</span>
        <span style={{ color: '#7f93a8', fontSize: 11 }}>{p.name} · 6대 분류 × PEG × 이익선</span>
      </div>

      <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
        <Box title="🏷️ 6대 분류">
          <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 15 }}>{catKr}</div>
          <div style={{ color: '#9aa7b4', fontSize: 10.5, marginTop: 3 }}>{cat === 'fast_grower' ? '성장률 = 적정 PER (린치 공식)' : cat === 'cyclical' ? '이익 정점 = PER 최저 함정 주의' : cat === 'stalwart' ? '꾸준한 대형 우량주' : '분류별 가치 기준 적용'}</div>
        </Box>
        <Box title={`💎 PEG 해석 ${peg != null ? `(${peg.toFixed(2)})` : ''}`}>
          <div style={{ color: pegView.color, fontWeight: 800, fontSize: 14 }}>{pegView.label}</div>
          <div style={{ color: '#9aa7b4', fontSize: 10.5, marginTop: 3, lineHeight: 1.5 }}>{pegView.desc}</div>
        </Box>
        <Box title="📈 이익선(EPS×적정PER) 이격">
          {special ? (
            <div style={{ color: lineView!.color, fontWeight: 700, fontSize: 11.5, lineHeight: 1.55 }}>{lineView!.t}</div>
          ) : fairPrice != null && lineView ? (
            <>
              <div style={{ color: lineView.color, fontWeight: 800, fontSize: 13.5 }}>{lineView.t}</div>
              <div style={{ color: '#9aa7b4', fontSize: 10.5, marginTop: 3, fontFamily: 'monospace' }}>이익선 {fmtPrice(fairPrice)} (EPS×{fairMult.toFixed(0)}) {price != null ? `· 현재 ${fmtPrice(price)}` : ''}</div>
            </>
          ) : <div style={{ color: '#8a9aaa', fontSize: 11.5 }}>EPS·가격 데이터 부족 — 적자/혁신성장주는 이익선 계산 제한</div>}
        </Box>
      </div>

      <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, padding: '10px 13px', color: '#ddd6fe', fontSize: 12, lineHeight: 1.65 }}>
        🧭 <b>린치의 종합 의견</b> — {summary}
      </div>
      <div style={{ color: '#8a9aaa', fontSize: 9.5, lineHeight: 1.6 }}>
        ※ PEG·이익선은 흑자·성장 측정 가능한 종목에 유효. 적자·혁신성장주는 매출(P/S)·해자로 보완하세요. 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
