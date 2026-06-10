'use client'

/**
 * 🐳 ShadowTracker13F — 슈퍼 클론 (킬러 기능 10단계)
 *
 * 내가 보유한 종목을 거인들이 들고 있는지 추적.
 *  · 미국(US): 전설적 투자자 9인(버핏·애크먼·드러켄밀러…)의 분기 13F-HR
 *  · 한국(KR): DART 최대주주 현황(국민연금=NPS 거인 / 설립자·핵심 경영진)
 *
 * 데이터: /api/shadow-13f (US=인메모리 12h 캐시 · KR=DART hyslrSttus 폴백)
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import type { ShadowResult, ShadowHolder } from '@/app/api/shadow-13f/route'

interface Props { ticker: string; name: string; market: string }

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', purple: '#a78bfa',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

const usdB = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n / 1e3)}K`
const krwMoney = (n: number) =>
  n >= 1e12 ? `₩${(n / 1e12).toFixed(1)}조` : n >= 1e8 ? `₩${Math.round(n / 1e8).toLocaleString()}억` : n >= 1e4 ? `₩${Math.round(n / 1e4).toLocaleString()}만` : `₩${Math.round(n).toLocaleString()}`

const ACTION: Record<ShadowHolder['action'], { label: string; emoji: string; color: string }> = {
  new:  { label: '신규',     emoji: '🆕', color: C.green },
  add:  { label: '확대',     emoji: '🔼', color: C.green },
  hold: { label: '유지',     emoji: '⏸️', color: C.blue },
  trim: { label: '축소',     emoji: '🔽', color: C.gold },
  exit: { label: '전량매도', emoji: '❌', color: C.red },
}

export default function ShadowTracker13F({ ticker, name, market }: Props) {
  const [data, setData] = useState<ShadowResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    const qs = new URLSearchParams({ ticker, name: name || '', market: market || '' }).toString()
    fetch(`/api/shadow-13f?${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((r: ShadowResult) => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name, market])

  const isKR = data?.market === 'KR'
  const srcBadge = isKR ? 'DART 최대주주' : '13F 공시'
  const fmtMoney = (n: number) => (isKR ? krwMoney(n) : usdB(n))

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>🐳</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>
        슈퍼 클론 — {isKR ? '거인들의 지분 추적' : '거인들의 포트폴리오 추적'}
      </span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontWeight: 700 }}>SECRET · {data ? srcBadge : '거인추적'}</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>{Header}{child}</div>
  )

  if (loading) return Wrap(<div style={{ fontSize: 12.5, color: C.textLow, lineHeight: 1.6 }}>🐳 거인들의 보유 공시를 훑는 중… (첫 조회는 수 초 걸릴 수 있어요)</div>)
  if (!data) return null
  if (data.status === 'unsupported') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.65 }}>🐳 {data.message}</div>)
  if (data.status === 'error') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>🐳 {data.message || '데이터를 불러오지 못했습니다.'}</div>)
  if (data.status === 'none') return Wrap(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 12, background: `${C.textLow}14`, border: `1px solid ${C.textLow}44`, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.textLow }}>
          {isKR ? '🔍 주요 주주 정보 없음' : '🔍 추적 중인 전설 중 보유자 없음'}
        </span>
      </div>
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${C.textLow}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75, fontStyle: 'italic' }}>&ldquo;{data.lynchComment || data.message}&rdquo;</div>
      </div>
    </>,
    `${C.textLow}55`
  )

  const hasLegend = data.holders.some(h => h.isLegend)
  const owning = data.holders.filter(h => h.action !== 'exit')
  const accent = hasLegend ? C.cyan : C.purple
  const asOf = data.asOf?.slice(0, isKR ? undefined : 10) || ''
  const pctLabel = isKR ? '지분율' : '비중'
  const deltaLabel = isKR ? '전기 대비' : '지난 분기'

  const banner = isKR
    ? (hasLegend ? `🏛️ 국민연금(NPS)이 ${data.name} 보유 — 거인이 뒤를 받친다` : `🏛️ 설립자·핵심 경영진이 ${data.name} 굳건히 보유`)
    : `🐳 전설 ${owning.length}명이 ${data.name} 보유 중`

  return Wrap(
    <>
      {/* 판정 배너 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}44`, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: accent }}>{banner}</span>
        <span style={{ fontSize: 11, color: C.textLow }}>
          {isKR ? `· 출처 DART · 기준 ${asOf}` : `· 전설 ${data.trackedFunds}인 추적 · 기준 ${asOf}`}
        </span>
      </div>

      {/* 보유 거인/주주 목록 */}
      {data.holders.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 380 }}>
            <thead>
              <tr style={{ color: C.textLow, fontSize: 10.5 }}>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 8px' }}>{isKR ? '주주' : '전설적 투자자'}</th>
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 8px' }}>평가액</th>
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 8px' }}>{pctLabel}</th>
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 8px' }}>{deltaLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.holders.map((h, i) => {
                const a = ACTION[h.action]
                const isExit = h.action === 'exit'
                return (
                  <tr key={i} style={{
                    borderTop: `1px solid ${C.border}`,
                    opacity: isExit ? 0.7 : 1,
                    background: h.isLegend ? `${C.cyan}10` : 'transparent',
                  }}>
                    <td style={{ textAlign: 'left', padding: '9px 4px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: h.isLegend ? C.cyan : C.text }}>
                        {h.mgr}{h.isLegend && <span style={{ fontSize: 9, color: C.cyan, marginLeft: 6, fontWeight: 700 }}>★ 거인</span>}
                      </div>
                      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 1 }}>{h.fund}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isExit ? C.textLow : C.text, padding: '9px 4px' }}>
                      {isExit ? '—' : (h.value > 0 ? fmtMoney(h.value) : `${(h.shares / 1e6).toFixed(1)}M주`)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: isExit ? C.textLow : h.pctPort >= 5 ? C.cyan : C.textSub, padding: '9px 4px' }}>
                      {isExit ? '—' : `${h.pctPort.toFixed(isKR ? 2 : 1)}%`}
                    </td>
                    <td style={{ textAlign: 'right', padding: '9px 4px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: a.color, padding: '2px 7px', borderRadius: 20, background: `${a.color}18` }}>
                        {a.emoji} {a.label}{h.deltaPct != null && (h.action === 'add' || h.action === 'trim') ? ` ${h.deltaPct > 0 ? '+' : ''}${h.deltaPct}%` : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 린치/Jarvis 코멘트 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75, fontStyle: 'italic' }}>&ldquo;{data.lynchComment}&rdquo;</div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        🐳 {data.lagNote} · {isKR
          ? '출처: 금융감독원 DART 최대주주 현황 · 평가액=보유주식수×현재가(추정) · 지분율=발행주식 대비'
          : '발행사명 매칭 기반(일부 약어 종목 누락 가능) · 비중=펀드 포트폴리오 내 평가액 비율'} · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
    </>,
    `${accent}55`
  )
}
