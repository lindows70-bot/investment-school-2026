'use client'

/**
 * 🤖 JarvisInsight — 어닝콜 애널리스트 (비밀병기 4단계)
 *
 * 종목 상세(리서치) 페이지 하단에 배치. 학생 입력 0 — 종목이 선택되면 자동 분석.
 * 서버 액션 getEarningsInsight 를 호출(게으른 캐싱)하여 피터 린치 페르소나로
 * 성장 스토리 / 경영진 태도 / 다음 분기 가이던스 3개 섹션을 보여준다.
 *
 * 스타일: 린치 가치평가 엔진(LynchValuationEngine)과 동일 컨벤션
 *   - 플랫 카드 + C 색상 토큰, monospace 수치, 배지/헤더 패턴 통일
 */

import { useState, useEffect } from 'react'
import { getEarningsInsight, type JarvisInsight, type JarvisFacts } from '@/app/actions/getEarningsInsight'
import { TK } from '@/lib/theme'

interface Props {
  ticker: string
  name:   string
  market: string
  facts?: JarvisFacts
}

// ── 색상 토큰 (LynchValuationEngine과 동일 팔레트 + AI 액센트) ────────────────
const C = {
  card:    TK.bg7,
  card2:   TK.bg5,
  border:  TK.line1,
  gold:    TK.amber500,
  green:   TK.green400,
  red:     TK.red400,
  blue:    TK.blue400,
  cyan:    TK.cyan400,   // Jarvis(AI) 액센트
  text:    TK.slate100,
  textSub: TK.slate400,
  textLow: TK.sub3,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// 감성 점수(0~100) → 색/라벨 (높을수록 긍정)
function sentiment(score: number): { color: string; label: string; emoji: string } {
  if (score < 35) return { color: C.red,    label: '부정적',     emoji: '🌧' }
  if (score < 50) return { color: TK.orange400, label: '신중',       emoji: '⛅' }
  if (score < 65) return { color: C.gold,    label: '중립~긍정',  emoji: '🌤' }
  if (score < 80) return { color: C.green,   label: '긍정적',     emoji: '☀️' }
  return { color: C.cyan, label: '매우 긍정적', emoji: '🚀' }
}

const SECTIONS: { key: keyof Pick<JarvisInsight, 'growthStory' | 'managementTone' | 'guidance'>; icon: string; title: string; hint: string }[] = [
  { key: 'growthStory',    icon: '🌱', title: '성장 스토리',       hint: '지금 이 회사가 어떤 성장 국면인가' },
  { key: 'managementTone', icon: '🎙', title: '경영진 태도',       hint: '실적·뉴스에서 읽히는 경영진의 자신감' },
  { key: 'guidance',       icon: '🧭', title: '다음 분기 가이던스', hint: '앞으로 체크해야 할 핵심 포인트' },
]

// ── 공통 헤더 (LynchValuationEngine 헤더 패턴) ───────────────────────────────
function Header({ name, ticker }: { name: string; ticker: string }) {
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 14,
      background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(30,41,59,1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Jarvis 어닝콜 애널리스트</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>
            SECRET · AI
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.textLow }}>
          피터 린치가 {name || ticker}의 최근 실적을 친절하게 풀어드립니다 · 공시·뉴스 자동 분석
        </div>
      </div>
    </div>
  )
}

export default function JarvisInsight({ ticker, name, market, facts }: Props) {
  const [data,    setData]    = useState<JarvisInsight | null>(null)
  const [loading, setLoading] = useState(false)

  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    let retry: ReturnType<typeof setTimeout> | undefined
    setLoading(true); setData(null)
    getEarningsInsight({ ticker, name, market, facts })
      .then(r => {
        if (!alive) return
        setData(r)
        // 무료 RPM 한도 → 22초 뒤 자동 재시도 (학생이 수동 새로고침 안 해도 됨)
        if (r.status === 'rate_limited') retry = setTimeout(() => setNonce(n => n + 1), 22000)
      })
      .catch(() => { if (alive) setData({
        ticker, quarter: '', growthStory: '', managementTone: '', guidance: '',
        sentimentScore: 50, headlines: [], cached: false, status: 'error',
        message: '분석 중 오류가 발생했습니다.', asOf: new Date().toISOString(),
      }) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; if (retry) clearTimeout(retry) }
    // facts는 객체라 deps에서 제외(티커 변경이 트리거) — 의도적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, market, nonce])

  // ── 로딩 ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Header name={name} ticker={ticker} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '22px 20px', borderRadius: 12,
          background: C.card, border: `1px solid ${C.border}`,
        }}>
          <div className="jarvis-spin" style={{ width: 22, height: 22, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.cyan, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Jarvis가 경영진의 어닝콜을 분석 중입니다…</div>
            <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>공시 자료와 최근 뉴스를 읽고 린치의 관점으로 정리하고 있어요</div>
          </div>
        </div>
        <style jsx>{`@keyframes jarvis-spin { to { transform: rotate(360deg) } } .jarvis-spin { animation: jarvis-spin 0.8s linear infinite }`}</style>
      </div>
    )
  }

  if (!data) return null

  // ── 키 미설정 / 한도 / 에러 안내 ──────────────────────────────────────
  if (data.status !== 'ok') {
    const isKey  = data.status === 'no_key'
    const isRate = data.status === 'rate_limited'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Header name={name} ticker={ticker} />
        <div style={{ padding: '18px 20px', borderRadius: 12, background: C.card, border: `1px solid ${isRate ? C.gold + '55' : C.border}`, fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>
          {isKey ? (
            <>
              <div style={{ fontWeight: 700, color: C.gold, marginBottom: 6 }}>⚙️ AI 엔진 설정이 필요합니다</div>
              <code style={{ color: C.cyan, fontFamily: 'monospace' }}>GEMINI_API_KEY</code> 환경변수가 설정되면 Jarvis가 자동으로 분석을 시작합니다. (관리자에게 문의하세요)
            </>
          ) : isRate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="jarvis-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.gold, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: C.gold, marginBottom: 3 }}>⏳ 잠시만요 — 자동으로 다시 분석합니다</div>
                <div>{data.message}</div>
              </div>
              <style jsx>{`@keyframes jarvis-spin { to { transform: rotate(360deg) } } .jarvis-spin { animation: jarvis-spin 0.8s linear infinite }`}</style>
            </div>
          ) : (
            <>{data.message || '잠시 후 다시 시도해 주세요.'}</>
          )}
        </div>
      </div>
    )
  }

  const s = sentiment(data.sentimentScore)

  // ── 분석 결과 ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      <Header name={name} ticker={ticker} />

      {/* 감성 점수 + 린치 인트로 (선택 요약 카드 패턴) */}
      <div style={{
        display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
        padding: '14px 18px', borderRadius: 12,
        background: C.card, border: `1px solid ${s.color}44`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: `${s.color}18`, border: `1px solid ${s.color}44` }}>
          <span style={{ fontSize: 22 }}>{s.emoji}</span>
          <div>
            <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>실적 감성</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{data.sentimentScore}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.label}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: C.textSub, lineHeight: 1.6, fontStyle: 'italic' }}>
          &ldquo;이번 <strong style={{ color: C.text }}>{data.quarter}</strong> 실적, 내가 린치의 시각으로 쭉 살펴봤어. 아래 세 가지만 기억해 두면 돼.&rdquo;
        </div>
      </div>

      {/* 감성 바 */}
      <div style={{ height: 6, background: C.card2, borderRadius: 999, overflow: 'hidden', marginTop: -6 }}>
        <div style={{ height: '100%', width: `${data.sentimentScore}%`, background: s.color, borderRadius: 999, transition: 'width 0.7s' }} />
      </div>

      {/* 3개 섹션 */}
      {SECTIONS.map(sec => (
        <div key={sec.key} style={{ padding: '15px 18px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.cyan}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{sec.icon}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{sec.title}</span>
            <span style={{ fontSize: 10.5, color: C.textLow }}>· {sec.hint}</span>
          </div>
          <div style={{ fontSize: 13, color: TK.slate300, lineHeight: 1.75 }}>
            {data[sec.key] || '관련 정보를 충분히 확보하지 못했어요.'}
          </div>
        </div>
      ))}

      {/* 출처 헤드라인 (투명성) */}
      {data.headlines.length > 0 && (
        <details style={{ padding: '12px 18px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
          <summary style={{ fontSize: 11, color: C.textSub, cursor: 'pointer', listStyle: 'none' }}>
            📰 분석에 참고한 뉴스 {data.headlines.length}건 보기
          </summary>
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
            {data.headlines.map((h, i) => (
              <li key={i} style={{ fontSize: 11, color: C.textLow, lineHeight: 1.6, marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0 }}>·</span>{h}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 푸터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: -4 }}>
        <span style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
          ⚠️ AI(Gemini)가 공개 뉴스·재무지표로 생성한 교육용 해설입니다. 투자 권유가 아니며 사실과 다를 수 있습니다.
        </span>
        <span style={{ fontSize: 9.5, color: C.textLow, fontFamily: 'monospace' }}>
          {data.cached ? '💾 저장된 분석' : '✨ 방금 분석'} · {data.quarter}
        </span>
      </div>
    </div>
  )
}
