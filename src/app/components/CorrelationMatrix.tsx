'use client'

/**
 * 📐 CorrelationMatrix — 포트폴리오 상관관계 매트릭스
 *
 * 보유 주식(STOCK) 간의 60일 일별 수익률 피어슨 상관계수(r)를 히트맵으로.
 *  · r ≥ +0.7 : 짙은 빨강 (과도한 동조화 — 가짜 분산, 리스크)
 *  · +0.3 ~ +0.6 : 주황·옐로우 (보통 동조화)
 *  · r ≤ +0.2 : 청색·에메랄드 (우수한 분산 효과)
 *  · 대각선(자기 자신, r=1.0) : 회색 처리
 *
 * 데이터: /api/correlation-matrix (Supabase auth 기반, 24h 개인 캐시)
 * WCAG AA 준수 다크 테마 색상
 */

import { useState, useEffect } from 'react'
import type { CorrelationResult } from '@/app/api/correlation-matrix/route'

// ── 색상 토큰 ─────────────────────────────────────────────────────────────────
const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  text: '#f1f5f9', textSub: '#b0bec8', textLow: '#8599ae',
  green: '#4ade80', red: '#f87171', gold: '#f59e0b', cyan: '#22d3ee',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// ── 상관계수 → 배경색 (다크모드 최적화, WCAG AA) ────────────────────────────
function corrColor(r: number | null, isDiag: boolean): { bg: string; text: string } {
  if (isDiag)        return { bg: '#2d3145', text: '#8a90b0' }
  if (r === null)    return { bg: '#1e2235', text: '#556080' }
  if (r >=  0.7)     return { bg: '#7f1d1d', text: '#fca5a5' }   // 강한 양의 상관 → 짙은 빨강
  if (r >=  0.5)     return { bg: '#78350f', text: '#fcd34d' }   // 중강 → 짙은 주황
  if (r >=  0.3)     return { bg: '#3d2b07', text: '#fbbf24' }   // 중약 → 옅은 주황
  if (r >=  0.1)     return { bg: '#172232', text: '#93c5fd' }   // 낮음 → 청색
  if (r >= -0.1)     return { bg: '#0f2818', text: '#6ee7b7' }   // 무상관 → 옅은 에메랄드
  return               { bg: '#064e3b', text: '#34d399' }        // 음의 상관 → 짙은 에메랄드
}

// ── 평균 상관계수 등급 ────────────────────────────────────────────────────────
function avgGrade(avg: number): { label: string; color: string; icon: string } {
  if (avg >= 0.7) return { label: '과도한 동조화 (리스크 高)', color: '#f87171', icon: '🚨' }
  if (avg >= 0.4) return { label: '중간 분산',                  color: '#fbbf24', icon: '⚠️' }
  return               { label: '우수한 분산',                  color: '#4ade80', icon: '✅' }
}

// ── 종목 쌍 추출 (매트릭스에서 직접 계산 — 추가 비용 0) ──────────────────────
interface Pair { a: string; b: string; r: number }
function extractPairs(tickers: string[], matrix: (number | null)[][]): Pair[] {
  const out: Pair[] = []
  for (let i = 0; i < tickers.length; i++)
    for (let j = i + 1; j < tickers.length; j++) {
      const r = matrix[i][j]
      if (r !== null && isFinite(r)) out.push({ a: tickers[i], b: tickers[j], r })
    }
  return out
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────────
function Skeleton({ n }: { n: number }) {
  const size = Math.max(3, n)
  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`@keyframes cmShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {Array.from({ length: size + 1 }).map((_, ri) => (
              <tr key={ri}>
                {Array.from({ length: size + 1 }).map((__, ci) => (
                  <td key={ci} style={{ width: 48, height: 38, padding: 3 }}>
                    <div style={{ height: '100%', borderRadius: 6, background: '#1e2235', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,#2a2d3a55,transparent)', animation: 'cmShimmer 1.4s infinite' }} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function CorrelationMatrix() {
  const [data, setData]       = useState<CorrelationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ i: number; j: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetch('/api/correlation-matrix', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!alive) return
        if (j.error) setError(j.error)
        else setData(j)
      })
      .catch(() => { if (alive) setError('데이터를 불러오지 못했습니다.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // ── 헤더 ──
  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>📐</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>포트폴리오 상관관계 매트릭스</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#1e293b', color: C.cyan, fontWeight: 700 }}>60일 · 피어슨 r</span>
      {data && (
        <span style={{ fontSize: 10, color: C.textLow, marginLeft: 'auto' }}>
          {data.tickers.length}종목 · 평균 {data.dataPoints}거래일 · {data.asOf.slice(0, 10)}
        </span>
      )}
    </div>
  )

  const Wrap = (child: React.ReactNode) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
      {Header}{child}
    </div>
  )

  if (loading) return Wrap(<Skeleton n={4} />)
  if (error)   return Wrap(
    <div style={{ padding: '24px 16px', textAlign: 'center', color: C.textSub, fontSize: 13, lineHeight: 1.7 }}>
      📐 {error}
    </div>
  )
  if (!data)   return null

  const { tickers, names, matrix, avgR } = data
  const n = tickers.length
  const grade = avgGrade(avgR)
  const nm = (t: string) => (names[t] || t).slice(0, 9)

  // 동조화·헷지 커플 추출 (매트릭스에서 직접 — 추가 API 없음)
  const pairs = extractPairs(tickers, matrix)
  const topCorr = [...pairs].sort((a, b) => b.r - a.r).filter(p => p.r >= 0.5).slice(0, 3)
  const hedges  = [...pairs].sort((a, b) => a.r - b.r).filter(p => p.r < 0.1).slice(0, 3)

  // 셀 사이즈 : 종목 수에 따라 동적 조정
  const cellW = n <= 6 ? 62 : n <= 10 ? 50 : 42
  const cellH = n <= 6 ? 44 : n <= 10 ? 38 : 32
  const fontSize = n <= 6 ? 12 : n <= 10 ? 11 : 10
  const labelW = n <= 6 ? 80 : n <= 10 ? 66 : 56

  // ── 🔍 우측 AI 분산 진단 패널 ──────────────────────────────────────────────
  const DiagnosisPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 15 }}>🔍</span>
        <span style={{ fontSize: 13.5, fontWeight: 900, color: C.text }}>AI 분산투자 진단</span>
      </div>

      {/* 1) 분산 상태 한줄평 */}
      <div style={{
        padding: '12px 14px', borderRadius: 11,
        background: `${grade.color}14`, border: `1px solid ${grade.color}40`,
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: grade.color, marginBottom: 4 }}>
          {grade.icon} 분산 상태: {grade.label}
        </div>
        <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.6 }}>
          평균 상관계수 <b style={{ color: grade.color, fontFamily: 'monospace' }}>{avgR.toFixed(3)}</b> —{' '}
          {avgR < 0.4
            ? '자산 간 동조화가 낮아 시장 하락 시 충격을 분산하기 좋은 구조입니다.'
            : avgR < 0.7
              ? '일부 종목이 함께 움직입니다. 아래 동조화 커플의 비중을 점검하세요.'
              : '종목들이 한 몸처럼 움직여 분산 효과가 약합니다. 다른 섹터를 섞으세요.'}
        </div>
      </div>

      {/* 2) 🔗 묶어서 조심할 동조화 커플 */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.gold, marginBottom: 6 }}>
          🔗 묶어서 조심할 종목 <span style={{ color: C.textLow, fontWeight: 400 }}>(함께 움직임)</span>
        </div>
        {topCorr.length === 0 ? (
          <div style={{ fontSize: 11, color: C.green, lineHeight: 1.5, padding: '2px 0' }}>
            ✅ 상관계수 0.5 이상으로 강하게 묶인 쌍이 없습니다 — 분산이 잘 되어 있어요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {topCorr.map(p => (
              <div key={`${p.a}-${p.b}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                background: '#1f1410', border: '1px solid #78350f',
              }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace',
                  color: p.r >= 0.7 ? '#fca5a5' : '#fcd34d', minWidth: 34,
                }}>{p.r.toFixed(2)}</span>
                <span style={{ fontSize: 11.5, color: C.textSub }}>
                  {nm(p.a)} <span style={{ color: C.textLow }}>×</span> {nm(p.b)}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.textLow, lineHeight: 1.5, marginTop: 2 }}>
              두 종목 비중의 <b style={{ color: C.textSub }}>합계</b>가 너무 크면, 한 종목에 몰빵한 것과 같습니다.
            </div>
          </div>
        )}
      </div>

      {/* 3) 🛡️ 계좌를 지키는 헷지 커플 */}
      {hedges.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.green, marginBottom: 6 }}>
            🛡️ 계좌를 지키는 헷지 종목 <span style={{ color: C.textLow, fontWeight: 400 }}>(따로/반대로 움직임)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {hedges.map(p => (
              <div key={`${p.a}-${p.b}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                background: '#0c1f17', border: '1px solid #064e3b',
              }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace',
                  color: p.r < 0 ? '#34d399' : '#6ee7b7', minWidth: 34,
                }}>{p.r.toFixed(2)}</span>
                <span style={{ fontSize: 11.5, color: C.textSub }}>
                  {nm(p.a)} <span style={{ color: C.textLow }}>×</span> {nm(p.b)}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.textLow, lineHeight: 1.5, marginTop: 2 }}>
              한쪽이 흔들릴 때 다른 쪽이 버텨주는 <b style={{ color: C.textSub }}>리스크 방어막</b>입니다.
            </div>
          </div>
        </div>
      )}

      {/* 4) 🎓 매트릭스 읽는 법 */}
      <div style={{ padding: '11px 13px', borderRadius: 11, background: C.card2, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.cyan, marginBottom: 7 }}>🎓 매트릭스 읽는 법</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: C.textSub, lineHeight: 1.5 }}>
          <div><b style={{ color: '#fca5a5' }}>+0.7 이상</b> — 한 몸처럼 움직임. 분산 효과 거의 없음.</div>
          <div><b style={{ color: '#6ee7b7' }}>0.0 ~ +0.3</b> — 제 갈 길 가는 종목들. 분산에 좋음.</div>
          <div><b style={{ color: '#34d399' }}>음수(−)</b> — 한쪽이 빠질 때 다른 쪽이 올라주는 방어막.</div>
        </div>
      </div>
    </div>
  )

  return Wrap(
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
     {/* ── 좌측: 히트맵 + 범례 + 요약 ── */}
     <div style={{ flex: '1 1 460px', minWidth: 0 }}>
      {/* ── 히트맵 표 ── */}
      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize, fontFamily: 'monospace' }}>
          <thead>
            <tr>
              {/* 좌상 빈 셀 */}
              <th style={{ width: labelW, minWidth: labelW }} />
              {tickers.map(t => (
                <th key={t} style={{
                  width: cellW, textAlign: 'center', fontWeight: 700,
                  color: C.textSub, paddingBottom: 6, fontSize: fontSize - 0.5,
                  fontFamily: FONT, letterSpacing: '-0.3px',
                }}>
                  {(names[t] || t).slice(0, 7)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((rowTk, i) => (
              <tr key={rowTk}>
                {/* 행 라벨 */}
                <td style={{
                  paddingRight: 8, fontWeight: 700, color: C.textSub,
                  fontSize: fontSize - 0.5, fontFamily: FONT,
                  textAlign: 'right', whiteSpace: 'nowrap', letterSpacing: '-0.3px',
                }}>
                  {(names[rowTk] || rowTk).slice(0, 9)}
                </td>
                {tickers.map((colTk, j) => {
                  const isDiag = i === j
                  const r = matrix[i][j]
                  const { bg, text } = corrColor(r, isDiag)
                  const isHovered = tooltip?.i === i && tooltip?.j === j
                  return (
                    <td
                      key={colTk}
                      onMouseEnter={() => setTooltip({ i, j })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        width: cellW, height: cellH, textAlign: 'center',
                        background: bg, borderRadius: 7, cursor: 'default',
                        fontWeight: isDiag ? 700 : 800, color: text,
                        position: 'relative', transition: 'transform 0.1s',
                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                        boxShadow: isHovered ? `0 0 0 2px ${C.cyan}88` : 'none',
                        zIndex: isHovered ? 2 : 1,
                        border: `1px solid ${isDiag ? '#3a3f5c' : 'transparent'}`,
                      }}
                    >
                      {isDiag ? '—' : r !== null ? r.toFixed(2) : 'N/A'}
                      {/* 툴팁 */}
                      {isHovered && !isDiag && (
                        <div style={{
                          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                          background: '#0a0e1a', border: `1px solid ${C.border}`, borderRadius: 8,
                          padding: '6px 10px', fontSize: 10.5, whiteSpace: 'nowrap', zIndex: 100,
                          color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          fontFamily: FONT, fontWeight: 400,
                        }}>
                          <b style={{ color: text }}>{r !== null ? r.toFixed(3) : 'N/A'}</b>
                          <span style={{ color: C.textLow }}> — {names[rowTk] || rowTk} × {names[colTk] || colTk}</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 범례 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 16, fontSize: 10.5 }}>
        {[
          { bg: '#7f1d1d', text: '#fca5a5', label: 'r ≥ 0.7 · 과도한 동조화' },
          { bg: '#78350f', text: '#fcd34d', label: '0.5 ≤ r < 0.7' },
          { bg: '#3d2b07', text: '#fbbf24', label: '0.3 ≤ r < 0.5' },
          { bg: '#172232', text: '#93c5fd', label: '0.1 ≤ r < 0.3' },
          { bg: '#064e3b', text: '#34d399', label: 'r < 0.1 · 우수한 분산' },
          { bg: '#2d3145', text: '#8a90b0', label: '대각선(자기 자신)' },
        ].map(l => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: l.bg, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
            <span style={{ color: C.textLow }}>{l.label}</span>
          </span>
        ))}
      </div>

      {/* ── 평균 상관계수 요약 ── */}
      <div style={{
        padding: '12px 16px', borderRadius: 12, marginBottom: 12,
        background: C.card2, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 18 }}>{grade.icon}</span>
        <span style={{ fontSize: 13, color: C.text }}>포트폴리오 평균 상관계수</span>
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: grade.color }}>{avgR.toFixed(3)}</span>
        <span style={{ fontSize: 12, color: grade.color, fontWeight: 700 }}>{grade.label}</span>
      </div>

      {/* ── ⚠️ 가짜 분산투자 경고 카드 (평균 r ≥ 0.7) ── */}
      {avgR >= 0.7 && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171', marginBottom: 6 }}>
            ⚠️ 가짜 분산투자 경고
          </div>
          <div style={{ fontSize: 12.5, color: '#fca5a5', lineHeight: 1.7 }}>
            보유 종목 간 동조화가 너무 심해 시장 충격 시 동반 폭락 위험이 있습니다.
            상관계수가 높은 종목들은 사실상 한 종목을 나눠 가진 것과 같아 — 진정한 분산은 서로 다른 방향으로 움직이는 종목들의 조합입니다.
            다른 섹터(예: 기술주↔소비재·유틸리티)나 자산군 다각화를 검토해보세요.
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: '#f87171', fontStyle: 'italic' }}>
            &ldquo;분산투자의 역설 — 상관관계 높은 10개 종목은 1개 종목보다 덜 안전하다.&rdquo; — 피터 린치
          </div>
        </div>
      )}

      {/* ── 푸터 안내 ── */}
      <div style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        📐 최근 60거래일 일별 수익률 기반 피어슨 상관계수(r) · −1.0(완전 역방향) ~ 0(무관) ~ +1.0(완전 동조) · 24h 캐시 ·
        공통 데이터 10일 미만 종목 쌍은 N/A · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
     </div>

     {/* ── 우측: AI 분산 진단 패널 ── */}
     <div style={{ flex: '1 1 290px', minWidth: 270, maxWidth: 440 }}>
       {DiagnosisPanel}
     </div>
    </div>
  )
}
