'use client'

/**
 * 🎧 NoiseCanceller — Jarvis 노이즈 캔슬러 (비밀병기 7단계)
 *
 * 목표가 소음은 끄고, '실적 추정치 리비전'이라는 진짜 신호만 증폭.
 * 종목 리서치 페이지에 배치. 종목 선택 시 자동 분석(서버액션 getAnalystSignal).
 *
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import { getAnalystSignal, type AnalystSignal } from '@/app/actions/getAnalystSignal'
import { TK } from '@/lib/theme'

interface Props { ticker: string; name: string; market: string }

const C = {
  card: TK.bg7, card2: TK.bg5, border: TK.line1,
  gold: TK.amber500, green: TK.green400, red: TK.red400, blue: TK.blue400, cyan: TK.cyan400,
  text: TK.slate100, textSub: TK.slate400, textLow: TK.sub3,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

const VERDICT: Record<AnalystSignal['verdict'], { color: string; emoji: string; label: string }> = {
  signal:  { color: C.green, emoji: '🟢', label: '정렬된 신호 — 진짜일 수 있어' },
  noise:   { color: C.blue,  emoji: '🔇', label: '순수 노이즈 — 휘둘리지 마' },
  trap:    { color: C.red,   emoji: '⚠️', label: '함정 주의 — 겉은 낙관, 속은 후퇴' },
  neutral: { color: C.gold,  emoji: '〰️', label: '중립 — 특이 신호 없음' },
}
// 한국(네이버 컨센서스 축소판) 전용 판정 라벨
const KR_VERDICT: Record<AnalystSignal['verdict'], { color: string; emoji: string; label: string }> = {
  signal:  { color: C.green, emoji: '🟢', label: '컨센서스 매수 우위 — 상승여력 충분' },
  noise:   { color: C.gold,  emoji: '⚠️', label: '목표가 거의 소진 — 추격 주의' },
  trap:    { color: C.red,   emoji: '⚠️', label: '주의' },
  neutral: { color: C.gold,  emoji: '〰️', label: '컨센서스 중립' },
}

export default function NoiseCanceller({ ticker, name, market }: Props) {
  const [data, setData] = useState<AnalystSignal | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    getAnalystSignal({ ticker, name, market })
      .then(r => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market, name])

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>🎧</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Jarvis 노이즈 캔슬러</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>SECRET · 월가 소음제거</span>
    </div>
  )

  if (loading) {
    return (
      <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
        {Header}
        <div style={{ fontSize: 12.5, color: C.textLow }}>🎧 월가의 목표가 소음을 걸러내고 진짜 신호를 분석 중…</div>
      </div>
    )
  }
  if (!data) return null

  if (data.status !== 'ok') {
    return (
      <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
        {Header}
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>
          {data.status === 'unsupported' ? '🎧 ' : '🎧 '}{data.message || '데이터를 불러오지 못했습니다.'}
        </div>
      </div>
    )
  }

  const isKr = data.source === 'naver'
  const v = isKr ? KR_VERDICT[data.verdict] : VERDICT[data.verdict]
  const revColor = data.revisionSignal === 'up' ? C.green : data.revisionSignal === 'down' ? C.red : C.gold
  const dispColor = data.dispersion == null ? C.textLow : data.dispersion >= 80 ? C.red : data.dispersion >= 40 ? C.gold : C.green
  const upColor = data.upside == null ? C.textLow : data.upside >= 15 ? C.green : data.upside < 3 ? C.gold : C.text
  const fmt$ = (n: number | null) => n != null ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
  const fmtPx = (n: number | null) => n == null ? '—' : isKr ? `₩${n.toLocaleString('ko-KR')}` : fmt$(n)

  return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${v.color}55`, fontFamily: FONT,
      boxShadow: data.verdict === 'trap' ? `0 0 18px ${C.red}1f` : 'none' }}>
      {Header}

      {/* 종합 판정 배너 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12,
        background: `${v.color}14`, border: `1px solid ${v.color}44`, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>{v.emoji}</span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: v.color }}>{v.label}</div>
          <div style={{ fontSize: 11, color: C.textLow, marginTop: 2 }}>
            {isKr
              ? `최근 리포트 ${data.reportCount ?? 0}건 · 투자의견 ${data.recMean != null ? data.recMean.toFixed(2) : '—'} (5=강력매수 · 1=매도)`
              : `애널리스트 ${data.analysts ?? '?'}명 커버 · 평균등급 ${data.recMean != null ? data.recMean.toFixed(2) : '—'} (1=강력매수 · 5=매도)`}
          </div>
        </div>
      </div>

      {/* 3개 신호 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 14 }}>
      {isKr ? (<>
        {/* KR ① 목표가 평균 + 상승여력 */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${upColor}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>🎯 목표가 평균 · 상승여력</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: upColor, fontFamily: 'monospace' }}>
            {data.upside != null ? `${data.upside >= 0 ? '+' : ''}${data.upside}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4, fontFamily: 'monospace' }}>
            목표 {fmtPx(data.targetMean)} / 현재 {fmtPx(data.current)}
          </div>
          <div style={{ fontSize: 10, color: C.textLow, marginTop: 3 }}>
            {data.upside == null ? '' : data.upside >= 15 ? '여력 충분' : data.upside < 3 ? '목표가 거의 소진' : '보통'}
          </div>
        </div>

        {/* KR ② 투자의견 (네이버 컨센서스, 5=매수) */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${data.recMean != null && data.recMean >= 3.8 ? C.green : C.gold}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>⭐ 투자의견 (컨센서스)</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: data.recMean != null && data.recMean >= 3.8 ? C.green : C.text, fontFamily: 'monospace' }}>
            {data.recMean != null ? data.recMean.toFixed(2) : '—'}
          </div>
          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>5점=강력매수 · 3점=중립</div>
          <div style={{ fontSize: 10, color: C.textLow, marginTop: 3 }}>
            {data.recMean == null ? '' : data.recMean >= 4 ? '강한 매수 우위' : data.recMean >= 3.5 ? '매수 우위' : '중립~보수'}
          </div>
        </div>

        {/* KR ③ 리포트 활동 */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>📰 최근 리포트 활동</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>{data.reportCount ?? 0}건</div>
          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4, lineHeight: 1.4 }}>
            {data.brokers.length ? data.brokers.slice(0, 3).join(' · ') : '커버 증권사 정보 없음'}
          </div>
        </div>
      </>) : (<>
        {/* ① 목표가 노이즈(분산) */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${dispColor}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>🔇 목표가 노이즈 (분산)</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: dispColor, fontFamily: 'monospace' }}>
            {data.dispersion != null ? `${Math.round(data.dispersion)}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4, fontFamily: 'monospace' }}>
            {fmt$(data.targetLow)} ~ {fmt$(data.targetHigh)}
          </div>
          <div style={{ fontSize: 10, color: C.textLow, marginTop: 3 }}>
            {data.dispersion == null ? '' : data.dispersion >= 80 ? '의견 제각각 = 시장도 모름' : data.dispersion >= 40 ? '보통 수준' : '의견 좁게 일치'}
          </div>
        </div>

        {/* ② EPS 리비전 (핵심 신호) */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${revColor}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>📈 EPS 추정치 리비전 (30일)</div>
          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace' }}>
            <span style={{ color: C.green }}>▲{data.revUp30 ?? 0}</span>
            <span style={{ color: C.textLow, margin: '0 6px' }}>vs</span>
            <span style={{ color: C.red }}>▼{data.revDown30 ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: revColor, marginTop: 4 }}>
            {data.revisionSignal === 'up' ? '🟢 실적 전망 상향 (진짜 신호)' : data.revisionSignal === 'down' ? '🔴 실적 전망 하향 (경고)' : data.revisionSignal === 'mixed' ? '⚪ 혼조' : '—'}
          </div>
          {data.growth != null && <div style={{ fontSize: 10, color: C.textLow, marginTop: 3 }}>추정 성장률 {data.growth >= 0 ? '+' : ''}{data.growth}%</div>}
        </div>

        {/* ③ 컨센서스 표류 */}
        <div style={{ padding: '13px 15px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}` }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6 }}>🔄 컨센서스 표류 (3개월)</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>
            {data.bullNow != null ? `${data.bullNow}%` : '—'}
            {data.drift && <span style={{ fontSize: 13, color: data.drift === 'improving' ? C.green : data.drift === 'worsening' ? C.red : C.textLow, marginLeft: 6 }}>
              {data.drift === 'improving' ? '▲' : data.drift === 'worsening' ? '▼' : '─'}
            </span>}
          </div>
          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>매수의견 비중 (3개월전 {data.bull3mAgo != null ? `${data.bull3mAgo}%` : '—'})</div>
          <div style={{ fontSize: 10, color: C.textLow, marginTop: 3 }}>
            {data.drift === 'improving' ? '조용한 리레이팅 진행' : data.drift === 'worsening' ? '컨센서스 악화' : '큰 변화 없음'}
          </div>
        </div>
      </>)}
      </div>

      {/* 린치 코멘트 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${v.color}` }}>
        <div style={{ fontSize: 12.5, color: TK.slate300, lineHeight: 1.75, fontStyle: 'italic' }}>
          &ldquo;{data.lynchComment}&rdquo;
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
          🎧 목표가·등급에 휘둘리지 말고 <strong style={{ color: C.textSub }}>실적</strong>을 직접 보세요(린치: follow the earnings).
          {isKr ? ' 국내는 목표가 분산·EPS 리비전 데이터가 공개되지 않아 컨센서스 요약만 제공합니다.' : ' 교육용 참고 지표 · 매매 권유 아님.'}
        </span>
        <span style={{ fontSize: 9.5, color: C.textLow, fontFamily: 'monospace' }}>
          {data.cached ? '💾 저장된 분석' : '✨ 방금 분석'} · {isKr ? '네이버' : 'Yahoo'}
        </span>
      </div>
    </div>
  )
}
