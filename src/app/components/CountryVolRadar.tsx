'use client'
// 🌪️ 국가별 시장 변동성 레이더 — "어느 나라 시장이 지금 위험하게 흔들리는가"
//   자국 5년 역사 백분위(구조적 변동성 차이 보정) + 급변동일(사이드카·서킷브레이커 프록시) + 52주 낙폭.
//   ⛔ 추천 점수·선정 미반영 — 리스크 맥락 전용. "변동성 크다=사지 마라"가 아니라 "손절이 갭에 뚫린다·비중 축소"의 뜻.
import { useEffect, useState } from 'react'
import type { CountryVolResult, CountryVolItem } from '@/lib/countryVolShared'
import { VOL_META } from '@/lib/countryVolShared'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border

function Row({ it, maxVol }: { it: CountryVolItem; maxVol: number }) {
  const m = VOL_META[it.verdict]
  return (
    <div style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${it.verdict === 'extreme' ? `${m.color}66` : BORDER}`, padding: '9px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{it.flag}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5 }}>{it.label}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}55`, borderRadius: 5, padding: '1px 7px', whiteSpace: 'nowrap' }}>{m.icon} {m.label}</span>
        {it.big3 >= 3 && (
          <span title="최근 20거래일 중 지수가 ±3% 이상 움직인 날. 사이드카·서킷브레이커급 급변동의 객관 프록시(실제 발동 이력은 거래소 로그인 게이트라 무료 수집 불가)"
            style={{ fontSize: 9.5, fontWeight: 800, color: TK.red400, background: `${TK.red400}14`, border: `1px solid ${TK.red400}44`, borderRadius: 5, padding: '1px 7px', whiteSpace: 'nowrap' }}>
            ⚡ 20일 중 {it.big3}일 ±3%
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ color: m.color, fontWeight: 900, fontSize: 17, fontFamily: 'monospace' }}>{it.vol20}%</span>
          <span style={{ color: TK.sub, fontSize: 9 }}>20일 변동성</span>
        </span>
      </div>
      {/* 변동성 크기 바(전 지수 공통 스케일) + 자국 백분위 마커 */}
      <div style={{ position: 'relative', height: 6, background: TK.bg2, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ width: `${Math.min(100, it.vol20 / maxVol * 100)}%`, height: '100%', background: m.color }} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: TK.sub }}>
        <span>자국 5년 백분위 <b style={{ color: it.pctile >= 90 ? TK.red400 : it.pctile >= 75 ? TK.orange400 : TK.slate300, fontFamily: 'monospace' }}>{it.pctile}%</b></span>
        <span>60일 <b style={{ color: TK.slate300, fontFamily: 'monospace' }}>{it.vol60}%</b></span>
        <span>52주 고점 대비 <b style={{ color: it.drawdown <= -20 ? TK.red400 : TK.slate300, fontFamily: 'monospace' }}>{it.drawdown}%</b></span>
        <span>20일 등락 <b style={{ color: it.ret20 >= 0 ? TK.green400 : TK.red400, fontFamily: 'monospace' }}>{it.ret20 > 0 ? '+' : ''}{it.ret20}%</b></span>
        <span>±2% <b style={{ color: TK.slate300, fontFamily: 'monospace' }}>{it.big2}일</b></span>
      </div>
    </div>
  )
}

export default function CountryVolRadar() {
  const [data, setData] = useState<CountryVolResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/country-vol').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j && !j.error) setData(j) })
      .catch(() => { /* graceful */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🌪️ 국가별 시장 변동성을 계산 중입니다…</div>
  if (!data) return null

  const sorted = [...data.items].sort((a, b) => b.pctile - a.pctile || b.vol20 - a.vol20)
  const maxVol = Math.max(...data.items.map(i => i.vol20), 1)
  const extremes = sorted.filter(i => i.verdict === 'extreme')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg,rgba(248,113,113,0.10),rgba(96,165,250,0.05))', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 18 }}>🌪️</span>
        <div>
          <div style={{ color: TK.red400, fontWeight: 800, fontSize: 12, marginBottom: 3 }}>국가별 시장 변동성 — 어느 나라가 지금 위험하게 흔들리는가</div>
          <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6 }}>
            지수의 <b>20일 실현변동성</b>을 재고, <b>자국 5년 역사 백분위</b>로 판정합니다. 한국은 구조적으로 미국보다 변동성이 커서 절대값 비교는 무의미 —
            <b> &ldquo;자기 역사에서도 이상 국면인가&rdquo;</b>가 진짜 경고입니다. 여기에 최근 20거래일의 <b>±3% 급변동일</b>(사이드카·서킷브레이커 프록시)을 함께 봅니다.
          </div>
          {extremes.length > 0 && (
            <div style={{ marginTop: 8, background: '#2a1010', border: `1px solid ${TK.red400}55`, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#fca5a5', lineHeight: 1.6 }}>
              🔴 <b>지금 투자 주의 시장</b>: {extremes.map(e => `${e.flag} ${e.label}(백분위 ${e.pctile}%·20일 중 ${e.big3}일 ±3%)`).join(' · ')}
              <div style={{ color: '#fecaca', marginTop: 3 }}>지수 자체가 매일 급변동하는 국면입니다. 개별 종목의 ATR 손절이 <b>지수 갭에 그대로 뚫릴 수 있어</b> 비중 축소·분할 진입이 필수입니다.</div>
            </div>
          )}
        </div>
      </div>

      {/* 지수 목록(자국 백분위 높은 순) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(it => <Row key={it.key} it={it} maxVol={maxVol} />)}
      </div>

      {/* 내재변동성(VIX류) 보조 */}
      {data.implied.length > 0 && (
        <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '11px 14px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: TK.slate200, marginBottom: 6 }}>📉 내재변동성 지수(참고)</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
            {data.implied.map(iv => (
              <span key={iv.symbol} style={{ fontSize: 11, color: TK.sub }}>
                {iv.label} <b style={{ color: iv.value >= 30 ? TK.red400 : iv.value >= 20 ? TK.orange400 : TK.green400, fontFamily: 'monospace', fontSize: 13 }}>{iv.value}</b>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TK.sub8, lineHeight: 1.55 }}>
            ⚠️ VKOSPI(한국)·닛케이VI(일본)·VSTOXX(유럽)는 <b>무료 API로 제공되지 않아</b> 표시하지 못합니다(거래소 유료·로그인 게이트). 그래서 이 화면의 주 지표는 전 시장을 같은 방식으로 잴 수 있는 <b>실현변동성</b>입니다.
          </div>
        </div>
      )}

      {/* 정직 캐비엇 — 양면 교육 */}
      <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '11px 14px', fontSize: 10.5, color: TK.sub8, lineHeight: 1.65 }}>
        🎓 <b>변동성이 크다 = 사지 마라</b>가 아닙니다. 뜻하는 건 ① <b>손절이 갭에 뚫릴 수 있다</b>(지수가 통째로 −8% 갭다운하면 개별 종목 ATR 손절은 무력) ② <b>포지션을 줄이고 나눠 사라</b> ③ 오히려 <b>공포 극단은 역발상 기회</b>일 수 있다(막스 시계추의 &lsquo;강제 매도자 매수 창&rsquo;과 함께 보세요).
        <div style={{ marginTop: 5 }}>※ 실현변동성 = 일간 수익률 표준편차 × √252(연율). 백분위는 자국 5년 롤링 20일 변동성 분포 기준. ±3% 일수는 실제 사이드카·서킷브레이커 발동 이력이 아니라 <b>객관적 프록시</b>입니다(발동 이력은 거래소 로그인 게이트라 무료 수집 불가). 추천 점수·선정에는 <b>반영하지 않습니다</b> — 리스크 맥락 전용. 교육용이며 투자 추천이 아닙니다.</div>
      </div>
    </div>
  )
}
