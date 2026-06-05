'use client'
// 🤖 AI 포트폴리오 리밸런싱 — 수익률 연동형 교체매매 플랜(익절/손절/보류 + 신규 매수후보)
import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { RebalanceResult, HoldingDiagnosis, RebalanceAction, DiversificationView } from '@/app/api/ai-rebalance/route'

const BG = '#0f1117', CARD = '#161b25', BORDER = '#1e293b'

const ACTION_CFG: Record<RebalanceAction, { color: string; bg: string; icon: string; label: string }> = {
  TAKE_PROFIT: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🏆', label: '분할 익절' },
  CUT_LOSS:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '⚔️', label: '손절 검토' },
  HOLD_DIP:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🛡️', label: '보류(저점매도 방지)' },
  DEFEND:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🚀', label: '사수(저평가)' },
  KEEP:        { color: '#8599ae', bg: 'rgba(133,153,174,0.08)', icon: '·', label: '유지' },
}

function pnlColor(p: number | null) { return p == null ? '#8599ae' : p > 0 ? '#22c55e' : p < 0 ? '#ef4444' : '#8599ae' }
function pnlStr(p: number | null) { return p == null ? '—' : `${p > 0 ? '+' : ''}${p}%` }
// 국내(KR)는 한국 종목명, 해외는 티커 표시
function disp(market: string, name: string, ticker: string) {
  return market === 'KR' ? (name || ticker).slice(0, 12) : ticker
}
// 원화 총액 포맷 (1억 이상은 억, 이하는 만원) — 금액과 단위 일관
function wonTotal(won: number): string {
  if (won >= 1e8) return `${(won / 1e8).toFixed(2)}억원`
  return `${Math.round(won / 1e4).toLocaleString()}만원`
}
// 비중(%) → 원화 금액 (실행 가이드). 총액 포맷과 동일 단위 기준
function wonAmount(pct: number, portfolioValue: number): string {
  const won = (pct / 100) * portfolioValue
  if (won <= 0) return ''
  return `≈ ${wonTotal(won)}`
}

export default function AiRebalancePanel() {
  const [data, setData] = useState<RebalanceResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/ai-rebalance${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
      if (r.status === 401) { setError('로그인이 필요합니다'); return }
      if (!r.ok) { setError('데이터 로드 실패'); return }
      setData(await r.json())
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
      <div style={{ color: '#7f93a8', fontSize: 14, lineHeight: 1.6 }}>
        포트폴리오 손익과 매도 신호를 분석 중입니다...<br />
        <span style={{ color: '#6b7280', fontSize: 12 }}>종목 수에 따라 20~40초 소요될 수 있습니다</span>
      </div>
    </div>
  )
  if (error) return (
    <div style={{ background: BG, borderRadius: 12, padding: 24, color: '#ef4444', textAlign: 'center' }}>
      {error}
      <button onClick={() => load()} style={{ display: 'block', margin: '12px auto 0', padding: '6px 16px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>재시도</button>
    </div>
  )
  if (!data || data.holdings.length === 0) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#7f93a8' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      {data?.narrative ?? '분석할 보유 종목이 없습니다.'}
    </div>
  )

  // 회수 비중이 의미 있는(≥0.1%) 신호 교체 후보(익절/손절)
  const sellList = data.holdings.filter(h => (h.action === 'TAKE_PROFIT' || h.action === 'CUT_LOSS') && h.releaseWeight >= 0.1)
  // Phase 3: 분산 목적 트림(신호 없으나 과집중 → 일부 축소)
  const trimList = data.holdings.filter(h => h.trimWeight >= 0.1 && h.action !== 'TAKE_PROFIT' && h.action !== 'CUT_LOSS')
  const trimmedSet = new Set(trimList.map(h => h.ticker))
  const holdDips = data.holdings.filter(h => h.action === 'HOLD_DIP' && !trimmedSet.has(h.ticker))
  const defends = data.holdings.filter(h => h.action === 'DEFEND' && !trimmedSet.has(h.ticker))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>AI 포트폴리오 리밸런싱</span>
              {data.sellBudget > 0 && (
                <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                  재배분 예산 {data.sellBudget}%
                </span>
              )}
            </div>
            <div style={{ color: '#7f93a8', fontSize: 12, marginTop: 4 }}>
              내 실제 수익률을 반영한 교체매매 — 익절/손절/보류를 구분합니다
            </div>
          </div>
          <button onClick={() => load(true)} style={{ padding: '6px 14px', background: '#1e293b', color: '#94a3b8', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🔄 새로고침</button>
        </div>
      </div>

      {/* 📊 포트폴리오 전 → 후 도넛 (글 읽기 전에 그림으로 결론 한눈에) */}
      {data.sellBudget > 0 && (
        <BeforeAfterDonuts data={data} />
      )}

      {/* AI 코칭 내러티브 */}
      {data.narrative && (
        <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(34,197,94,0.05))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💬 AI 자산관리 비서</div>
          <div style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.7 }}>{data.narrative}</div>
        </div>
      )}

      {/* 🔁 시클리컬 가치함정 경고 (피터 린치 영구 원리) */}
      {data.cyclicalTrap && (
        <div style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.35)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ color: '#fb923c', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            🔁 시클리컬 가치함정 주의 — 경기순환주 {data.cyclicalTrap.weight}% 집중
          </div>
          <div style={{ color: '#fdba74', fontSize: 12.5, lineHeight: 1.7 }}>
            <b>{data.cyclicalTrap.tickers.map(t => `${t.market === 'KR' ? (t.name || t.ticker).slice(0, 10) : t.ticker}(PEG ${t.peg})`).join(', ')}</b>는 PEG가 낮아 저평가처럼 보입니다.
            하지만 <b>경기순환주(반도체 등)는 이익이 정점일 때 PER이 가장 낮아 보이는 &lsquo;가치 함정&rsquo;</b>일 수 있습니다(피터 린치).
            저PEG만 보고 &lsquo;사수&rsquo;로 안심하지 말고, ① 영업이익률이 역사적 고점인지 ② 마진이 꺾이기 시작했는지를 함께 확인하세요. 사이클 고점에서의 저PER은 매수가 아니라 매도 신호일 수 있습니다.
          </div>
        </div>
      )}

      {/* 💭 하이프 프리미엄 경고 (실체=이익 없이 내러티브로 프리미엄 = 거품) */}
      {data.hypePremium && (
        <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ color: '#c084fc', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            💭 하이프 프리미엄 주의 — 영업적자 종목 {data.hypePremium.weight}% 보유
          </div>
          <div style={{ color: '#d8b4fe', fontSize: 12.5, lineHeight: 1.7 }}>
            <b>{data.hypePremium.tickers.map(t => `${t.market === 'KR' ? (t.name || t.ticker).slice(0, 10) : t.ticker}(영업이익률 ${t.opMargin}%)`).join(', ')}</b>는 아직 영업적자라 &lsquo;이익&rsquo;이라는 실체가 없습니다.
            이익 없이 성장 스토리·유명인 투자 소식으로 프리미엄을 받는 종목은 <b>거품(하이프 프리미엄) 위험</b>이 큽니다(버핏 원리).
            일방적으로 팔라는 게 아니라 — ① 매출이 실제로 폭증하는지 ② 물리적 해자(기술·데이터·제조)가 진짜인지 확인하고, 스토리만 남으면 비중을 관리하세요.
          </div>
        </div>
      )}

      {/* 🧟 좀비 기업 경고 (영업이익으로 이자도 못 갚음 — 이자보상배율<1.5) */}
      {data.zombieRisk && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            🧟 좀비 기업 경고 — 이자도 못 갚는 종목 {data.zombieRisk.weight}% 보유
          </div>
          <div style={{ color: '#fca5a5', fontSize: 12.5, lineHeight: 1.7 }}>
            <b>{data.zombieRisk.tickers.map(t => `${t.market === 'KR' ? (t.name || t.ticker).slice(0, 10) : t.ticker}(이자보상배율 ${t.interestCoverage}배)`).join(', ')}</b>는 영업이익으로 이자비용도 충분히 못 갚습니다(이자보상배율 1.5 미만).
            흑자 여부와 별개로 <b>빚을 감당 못 하는 구조적 약체</b>로, 금리·업황이 악화되면 파산 위험이 큽니다. 부채가 줄거나 이익이 회복되는지 확인하고 비중을 관리하세요.
          </div>
        </div>
      )}

      {/* ① 교체매매(익절/손절) 카드 */}
      {sellList.length > 0 && (
        <div>
          <SectionTitle icon="🔄" text="신호 기반 교체매매 (익절/손절)" sub="종목별 매도 신호" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sellList.map(h => <SwapCard key={h.ticker} h={h} pv={data.portfolioValue} />)}
          </div>
        </div>
      )}

      {/* ①-b 분산 트림 (Phase 3: 과집중 분류 일부 축소) */}
      {trimList.length > 0 && (
        <div>
          <SectionTitle icon="✂️" text="분산을 위한 일부 축소" sub="좋은 종목이나 한 분류 집중이 과해 일부만 트림" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trimList.map(h => (
              <div key={h.ticker} style={{ background: CARD, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#c084fc', fontSize: 11 }}>✂️ 축소</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{h.market === 'KR' ? (h.name || h.ticker).slice(0, 12) : `${h.name} (${h.ticker})`}</span>
                  <span style={{ color: pnlColor(h.pnlPct), fontSize: 13, fontWeight: 700 }}>{pnlStr(h.pnlPct)}</span>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>비중 {h.weight}% → <b style={{ color: '#c084fc' }}>−{h.trimWeight}%</b> 축소 <span style={{ color: '#c084fc' }}>{wonAmount(h.trimWeight, data.portfolioValue)}</span></span>
                  {h.peg != null && <span style={{ color: '#3b82f6', fontSize: 11 }}>PEG {h.peg.toFixed(2)}</span>}
                </div>
                {h.sellReasons.length > 0 && (
                  <div style={{ marginTop: 6, color: '#aab6c4', fontSize: 12, lineHeight: 1.5 }}>
                    {h.sellReasons.map((r, i) => <div key={i}>· {r}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ①-c 신규 편입 후보 (회수 예산 재배분 — 부족 분류 갭 가중) */}
      {data.buyCandidates.filter(b => b.allocWeight > 0).length > 0 && (
        <div>
          <SectionTitle icon="🛡️" text="코어 편입 후보 — 안정 대형주" sub="부족 분류·섹터를 채우는 AI 추천 (회수 예산의 80%)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.buyCandidates.filter(b => b.allocWeight > 0).map(b => (
              <div key={b.ticker} style={{ background: CARD, borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#22c55e', fontSize: 11 }}>🎯 편입</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{b.market === 'KR' ? (b.name || b.ticker).slice(0, 12) : `${b.name} (${b.ticker})`}</span>
                  <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>AI {b.aiScore}점</span>
                  {b.peg != null && <span style={{ color: '#3b82f6', fontSize: 11 }}>PEG {b.peg.toFixed(2)}</span>}
                  <span style={{ color: '#8599ae', fontSize: 11 }}>{b.sector}</span>
                  <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>+{b.allocWeight}% <span style={{ fontWeight: 400, fontSize: 11 }}>{wonAmount(b.allocWeight, data.portfolioValue)}</span></span>
                </div>
                {b.reason && <div style={{ marginTop: 6, color: '#aab6c4', fontSize: 12, lineHeight: 1.5 }}>{b.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ①-d 🚀 위성(10배거 공격) 후보 — 코어와 별개, 고위험 소액 */}
      {data.satelliteCandidates && data.satelliteCandidates.length > 0 && (
        <div>
          <SectionTitle icon="🚀" text="위성 후보 — 10배거 공격(소액·고위험)" sub="중소형 성장주, 회수 예산의 20% 한정" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.satelliteCandidates.map(s => (
              <div key={s.ticker} style={{ background: CARD, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#c084fc', fontSize: 11 }}>🚀 위성</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{s.market === 'KR' ? (s.name || s.ticker).slice(0, 12) : `${s.name} (${s.ticker.toUpperCase()})`}</span>
                  <span style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 }} title="시총·성장·저PEG 라이트 스크리닝 점수(헌터 탭의 7대 기준 점수와 다름)">성장스크리닝 {s.tenScore}</span>
                  {s.marketCapUsd != null && <span style={{ color: '#8599ae', fontSize: 11 }}>시총 ${(s.marketCapUsd / 1e9).toFixed(1)}B</span>}
                  <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>+{s.allocWeight}% <span style={{ fontWeight: 400, fontSize: 11 }}>{wonAmount(s.allocWeight, data.portfolioValue)}</span></span>
                </div>
                {s.reason && <div style={{ marginTop: 6, color: '#aab6c4', fontSize: 12, lineHeight: 1.5 }}>{s.reason}</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#8a6fb0', lineHeight: 1.6 }}>
            ⚠️ 위성은 <b>중소형 고성장주(10배거 잠재)</b>로 변동성·실패 위험이 큽니다. 코어(안정 대형주)와 분리해 <b>소액만</b> 편입하고, 성장 스토리가 실현되는지 분기마다 확인하세요. 자세한 7대 기준은 &lsquo;🚀 10배거 헌터&rsquo; 탭에서 검증할 수 있습니다.
          </div>
        </div>
      )}

      {/* ② 보류(저점매도 방지) */}
      {holdDips.length > 0 && (
        <div>
          <SectionTitle icon="🛡️" text="저점 매도 방지 — 버티세요" sub="손실 중이나 단순 고평가뿐, thesis 멀쩡" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {holdDips.map(h => (
              <div key={h.ticker} style={{ background: CARD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{disp(h.market, h.name, h.ticker)}</span>
                <span style={{ color: pnlColor(h.pnlPct), fontSize: 12, marginLeft: 8, fontWeight: 600 }}>{pnlStr(h.pnlPct)}</span>
                <span style={{ color: '#f59e0b', fontSize: 11, marginLeft: 8 }}>
                  본전까지 +{h.breakEvenRise ?? '—'}% · 저점매도 금물
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ③ 사수(저평가/호재) */}
      {defends.length > 0 && (
        <div>
          <SectionTitle icon="🚀" text="사수 — 이기는 종목은 달리게 두라" sub="저평가/호재" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {defends.map(h => (
              <div key={h.ticker} style={{ background: CARD, border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{disp(h.market, h.name, h.ticker)}</span>
                <span style={{ color: pnlColor(h.pnlPct), fontSize: 12, marginLeft: 8, fontWeight: 600 }}>{pnlStr(h.pnlPct)}</span>
                {h.peg != null && <span style={{ color: '#3b82f6', fontSize: 11, marginLeft: 8 }}>PEG {h.peg.toFixed(2)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ④ 분산 개선 Before → After */}
      {data.diversification && (
        <DiversificationSection d={data.diversification} />
      )}

      {/* 실행 가이드 안내 (자동매매 없음 — 직접 실행) */}
      {data.portfolioValue > 0 && (data.sellBudget > 0) && (
        <div style={{ background: '#141720', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7 }}>
            🧾 <b style={{ color: '#cbd5e1' }}>실행 가이드</b> — 위 비율 옆의 <b>≈₩금액</b>은 내 포트폴리오(약 {wonTotal(data.portfolioValue)}) 기준 환산액입니다.
            이 금액만큼 <b>본인 증권계좌에서 직접</b> 매도·매수하시면 됩니다.
            <br /><span style={{ color: '#6b7280', fontSize: 11 }}>※ 이 앱은 교육용이라 자동 주문·일괄 거래를 실행하지 않습니다. 실제 매매는 학생 본인이 판단·집행합니다.</span>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'right', color: '#4b5563', fontSize: 11 }}>
        분석 기준: {new Date(data.generatedAt).toLocaleString('ko-KR')} · 24h 캐시 · 교육용 시뮬레이션이며 투자 추천이 아닙니다
      </div>
    </div>
  )
}

// ── 분산 개선 Before→After (분류 황금비율 + 섹터 집중도) ───────────────────────
function DiversificationSection({ d }: { d: DiversificationView }) {
  // 린치 6대 분류 전부 표시 (저성장주 권장 0%도 포함 — '6대 분류 밸런스' 본질 유지)
  const LYNCH6 = ['stalwart', 'fast_grower', 'cyclical', 'turnaround', 'asset_play', 'slow_grower']
  const cats = d.categories.filter(c => LYNCH6.includes(c.key) || c.before > 0 || c.after > 0)
  const maxV = Math.max(40, ...cats.map(c => Math.max(c.before, c.after, c.ideal)))
  const secImproved = d.topSectorAfter < d.topSectorBefore - 0.05
  return (
    <div>
      <SectionTitle icon="⚖️" text="분산 개선 (리밸런싱 전 → 후)" sub="린치 황금비율 · 섹터 집중도" />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 섹터 집중도 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>최대 단일 섹터 비중</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{d.topSectorBefore}%</span>
          <span style={{ color: '#6b7280' }}>→</span>
          <span style={{ color: secImproved ? '#22c55e' : '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{d.topSectorAfter}%</span>
          {secImproved && <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>✓ 집중도 완화</span>}
          {d.sectorsBefore[0] && <span style={{ color: '#6b7280', fontSize: 11 }}>({d.sectorsBefore[0].sector})</span>}
        </div>

        {/* 분류별 Before→After 바 (황금비율 마커) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cats.map(c => (
            <div key={c.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#94a3b8' }}>{c.label}</span>
                <span style={{ color: '#6b7280' }}>
                  <span style={{ color: '#8599ae' }}>{c.before}%</span> → <span style={{ color: c.after >= c.before ? '#60a5fa' : '#8599ae', fontWeight: 600 }}>{c.after}%</span>
                  <span style={{ color: '#4b6380', marginLeft: 6 }}>권장 {c.ideal}%</span>
                </span>
              </div>
              {/* 바: after(파랑) 위에 before(회색 외곽) + 권장 마커 */}
              <div style={{ position: 'relative', height: 8, background: '#0f1117', borderRadius: 4, overflow: 'visible' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(c.after / maxV) * 100}%`, background: '#3b82f6', borderRadius: 4, transition: 'width 0.4s' }} />
                {/* 권장선 마커 */}
                <div style={{ position: 'absolute', left: `${(c.ideal / maxV) * 100}%`, top: -2, height: 12, width: 2, background: '#a8b5c2' }} title={`권장 ${c.ideal}%`} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: '#6b7280', lineHeight: 1.5 }}>
          파란 막대 = 리밸런싱 후 비중 · <span style={{ color: '#a8b5c2' }}>|</span> = 린치 황금비율 권장선. 권장선에 가까울수록 균형 잡힌 포트폴리오입니다.
        </div>
      </div>
    </div>
  )
}

// ── 📊 포트폴리오 전 → 후 도넛 (변화를 색깔로 한눈에) ─────────────────────────
type PosType = 'keep' | 'sell' | 'core' | 'satellite' | 'etc'
const POS_COLOR: Record<PosType, string> = {
  keep: '#3b82f6', sell: '#ef4444', core: '#22c55e', satellite: '#a855f7', etc: '#475569',
}
type SellKind = 'tp' | 'cut' | 'trim'   // 익절(절반)·손절(전량)·분산축소
const SELL_TAG: Record<SellKind, { label: string; color: string }> = {
  tp:   { label: '익절·절반', color: '#f59e0b' },
  cut:  { label: '손절·전량', color: '#ef4444' },
  trim: { label: '분산·축소', color: '#60a5fa' },
}
interface Pos { name: string; value: number; type: PosType; change?: number; kind?: SellKind }   // change=회수/편입 실제 비중(±)

function BeforeAfterDonuts({ data }: { data: RebalanceResult }) {
  const dnm = (market: string, name: string, ticker: string) => (market === 'KR' ? (name || ticker).slice(0, 8) : ticker.toUpperCase())

  // 소액 '유지' 종목만 '기타'로 합산(변화 항목=매도/신규/위성은 작아도 항상 개별 표시)
  const pack = (raw: Pos[]): Pos[] => {
    const changed = raw.filter(p => p.type !== 'keep')
    const keepBig = raw.filter(p => p.type === 'keep' && p.value >= 2)
    const keepSmall = raw.filter(p => p.type === 'keep' && p.value < 2)
    const etcSum = Math.round(keepSmall.reduce((s, p) => s + p.value, 0) * 10) / 10
    const out: Pos[] = [...changed, ...keepBig].sort((a, b) => b.value - a.value)
    if (etcSum >= 0.5) out.push({ name: '기타', value: etcSum, type: 'etc' })
    return out
  }

  const r1 = (n: number) => Math.round(n * 10) / 10
  // 리밸런싱 전: 부분 트림은 '남는 양(파랑)+파는 양(빨강)' 2슬라이스로 쪼개 빨강 면적=회수예산 일치
  const before = pack(data.holdings
    .filter(h => h.weight > 0)
    .flatMap(h => {
      const nm = dnm(h.market, h.name, h.ticker)
      if (h.releaseWeight <= 0) return [{ name: nm, value: r1(h.weight), type: 'keep' as PosType }]
      const sold = r1(h.releaseWeight), kept = r1(h.weight - h.releaseWeight)
      const kind: SellKind = h.action === 'TAKE_PROFIT' ? 'tp' : h.action === 'CUT_LOSS' ? 'cut' : 'trim'
      const parts: Pos[] = [{ name: nm, value: sold, type: 'sell' as PosType, change: sold, kind }]
      if (kept >= 0.1) parts.unshift({ name: nm, value: kept, type: 'keep' as PosType })
      return parts
    }))
  const beforeCount = data.holdings.filter(h => h.weight > 0).length

  // 리밸런싱 후: 유지(회수분 차감) + 신규 코어 + 위성
  const afterRaw: Pos[] = [
    ...data.holdings.map(h => ({ name: dnm(h.market, h.name, h.ticker), value: r1(h.weight - h.releaseWeight), type: 'keep' as PosType })).filter(p => p.value >= 0.1),
    ...data.buyCandidates.filter(b => b.allocWeight > 0).map(b => ({ name: dnm(b.market, b.name, b.ticker), value: b.allocWeight, type: 'core' as PosType })),
    ...(data.satelliteCandidates ?? []).filter(s => s.allocWeight > 0).map(s => ({ name: dnm(s.market, s.name, s.ticker), value: s.allocWeight, type: 'satellite' as PosType })),
  ]
  const after = pack(afterRaw)
  const afterCount = afterRaw.length

  const Donut = ({ title, rows, priority, changeLabel, count }: { title: string; rows: Pos[]; priority: PosType[]; changeLabel: string; count: number }) => {
    // 변화 항목(매도/신규)을 먼저, 그 다음 유지 종목 상위 — 사용자가 '뭘 팔고 뭘 사는지' 확실히 보이게
    const changed = rows.filter(p => priority.includes(p.type))
    const kept = rows.filter(p => !priority.includes(p.type)).sort((a, b) => b.value - a.value)
    return (
    <div style={{ flex: '1 1 240px', minWidth: 220 }}>
      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ position: 'relative', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={1} stroke="#0f1117" strokeWidth={2}>
              {rows.map((p, i) => <Cell key={i} fill={POS_COLOR[p.type]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 18 }}>{count}</div>
          <div style={{ color: '#6b7280', fontSize: 10 }}>종목</div>
        </div>
      </div>
      {/* 변화 항목(매도/신규) 전부 표시 */}
      {changed.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ color: priority[0] === 'sell' ? '#f87171' : '#34d399', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{changeLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {changed.map((p, i) => {
              const isSell = p.type === 'sell'
              const amt = isSell ? (p.change ?? p.value) : p.value   // 매도=회수비중 / 신규=편입비중
              const tag = isSell && p.kind ? SELL_TAG[p.kind] : null
              return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: POS_COLOR[p.type], flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1', flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {tag && <span style={{ color: tag.color, border: `1px solid ${tag.color}55`, borderRadius: 4, padding: '0 4px', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{tag.label}</span>}
                <span style={{ marginLeft: 'auto', color: isSell ? '#f87171' : '#34d399', fontWeight: 700, flexShrink: 0 }}>{isSell ? '−' : '+'}{amt}%</span>
              </div>
            )})}
          </div>
          {priority[0] === 'sell' && changed.some(p => p.kind === 'tp') && (
            <div style={{ color: '#7f8b99', fontSize: 9.5, lineHeight: 1.5, marginTop: 4 }}>
              💡 <b style={{ color: '#f59e0b' }}>익절·절반</b>=수익 중이지만 고평가라 보유의 50%만 실현(나머지 절반은 추세 유지). · <b style={{ color: '#ef4444' }}>손절·전량</b>=손실+투자근거 붕괴라 전량 정리.
            </div>
          )}
        </div>
      )}
      {/* 유지 종목 상위 4 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: changed.length > 0 ? 6 : 4 }}>
        {changed.length > 0 && <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>유지(상위)</div>}
        {kept.slice(0, 4).map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: POS_COLOR[p.type], flexShrink: 0 }} />
            <span style={{ color: '#aab6c4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ color: '#7f93a8', fontWeight: 600 }}>{p.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )}

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 포트폴리오 변화 — 한눈에 보기</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Donut title="리밸런싱 전 (현재)" rows={before} count={beforeCount} priority={['sell']} changeLabel="🔴 매도·축소 (회수 %)" />
        <div style={{ alignSelf: 'center', color: '#6b7280', fontSize: 22, padding: '0 4px' }}>→</div>
        <Donut title="리밸런싱 후 (제안)" rows={after} count={afterCount} priority={['core', 'satellite']} changeLabel="🟢 신규 편입 (편입 %)" />
      </div>
      {/* 색깔 범례 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12, fontSize: 11 }}>
        {([['keep', '유지'], ['sell', '매도·축소'], ['core', '신규(코어)'], ['satellite', '위성(10배거)']] as [PosType, string][]).map(([t, label]) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: POS_COLOR[t] }} />
            <span style={{ color: '#8a9aaa' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function SectionTitle({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{icon} {text}</span>
      {sub && <span style={{ color: '#6b7280', fontSize: 11 }}>{sub}</span>}
    </div>
  )
}

function SwapCard({ h, pv }: { h: HoldingDiagnosis; pv: number }) {
  const cfg = ACTION_CFG[h.action]
  return (
    <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${cfg.color}40`, padding: '14px 16px' }}>
      {/* 매도 종목 라인 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>매도</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{h.name} ({h.ticker})</span>
        <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
        <span style={{ color: pnlColor(h.pnlPct), fontSize: 13, fontWeight: 700 }}>{pnlStr(h.pnlPct)}</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>비중 {h.weight}% → 회수 {h.releaseWeight}% <span style={{ color: '#94a3b8' }}>{wonAmount(h.releaseWeight, pv)}</span></span>
      </div>

      {/* 매도 사유 */}
      {h.sellReasons.length > 0 && (
        <div style={{ marginTop: 6, color: '#aab6c4', fontSize: 12, lineHeight: 1.5 }}>
          {h.sellReasons.map((r, i) => <div key={i}>· {r}</div>)}
        </div>
      )}

      {/* 손절 시 본전 상승률(기회비용) */}
      {h.action === 'CUT_LOSS' && h.breakEvenRise != null && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
          ⏳ 본전까지 <b>+{h.breakEvenRise}%</b> 필요 — 회복 동력이 없는 종목에 묶여 기다리는 기회비용을 점검하세요
        </div>
      )}
    </div>
  )
}
