'use client'

import { useState, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

// 도넛 차트 데이터
const DONUT_DATA = [
  { name: 'Core',      value: 48, color: '#3b5bdb' },
  { name: 'Satellite', value: 52, color: '#f59e0b' },
]

// 섹터별 비중 (우측 요약)
const SECTORS = [
  { label: '반도체 노출',  pct: 32, color: '#60a5fa', note: '직접+간접 합산' },
  { label: '전략·전력',   pct: 20, color: '#34d399', note: '원자력·AI전력·GEV·ETN' },
  { label: 'AI-바이오',   pct:  4, color: '#a78bfa', note: 'IBB·XBI·TEM 신규' },
  { label: 'K방산',       pct:  4, color: '#fb923c', note: 'PLUS K방산' },
  { label: '대체(BTC)',   pct:  6, color: '#fbbf24', note: '디지털자산 분산' },
  { label: '현금·CMA',   pct:  5, color: '#9ca3af', note: '파킹 유동성 확보' },
]

const ISSUES = [
  {
    no: 1,
    topic: 'AI-바이오 비중',
    verdict: '최종 4% 확정',
    verdictColor: '#34d399',
    basis: '2%는 수익 기여 불가, 6%는 미검증 — 4%가 최적 균형점',
    badge: '확정',
    badgeColor: '#065f46',
    badgeBorder: '#34d399',
  },
  {
    no: 2,
    topic: '나스닥100 조정',
    verdict: '최종 15%',
    verdictColor: '#60a5fa',
    basis: '반도체 비중 32% 포함 고려 및 재원 2% 확보',
    badge: '조정',
    badgeColor: '#1e3a5f',
    badgeBorder: '#60a5fa',
  },
  {
    no: 3,
    topic: 'Tiger 건설',
    verdict: '전액 매도',
    verdictColor: '#f87171',
    basis: '실적 부진 및 전력 테마와 무관 — 포지션 청산',
    badge: '매도',
    badgeColor: '#7f1d1d',
    badgeBorder: '#f87171',
  },
  {
    no: 4,
    topic: 'Eaton (ETN)',
    verdict: '3% 유지',
    verdictColor: '#fbbf24',
    basis: '수주잔고 $440B로 강력한 모멘텀 — 보유 지속',
    badge: '유지',
    badgeColor: '#78350f',
    badgeBorder: '#fbbf24',
  },
]

export default function MasterStrategyPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [report, setReport]       = useState<{ name: string; date: string } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) { showToast('⚠️ PDF 파일만 업로드할 수 있습니다.'); return }

    setIsAnalyzing(true)
    setTimeout(() => {
      const today = new Date()
      const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`
      setReport({ name: file.name, date: dateStr })
      setIsAnalyzing(false)
      showToast('✅ 분석 완료 — 차트와 테이블 데이터가 최신 리포트로 업데이트되었습니다.')
      // 동일 파일 재선택 가능하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = ''
    }, 3000)
  }

  return (
    <div style={{
      padding: '36px 28px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#dde4f0',
      maxWidth: 960,
    }}>

      {/* ── 상단 헤더 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            🏹 MASTER STRATEGY · 2026 Q2
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.6px', lineHeight: 1.2 }}>
            2026 Q2 발키리(Valkyrie) 전략 포트폴리오
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, fontWeight: 500 }}>
            Core-Satellite 자산배분 모델 · Get Rich Slowly 투자학교
          </p>
        </div>

        {/* 버튼 그룹 */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>

          {/* 업로드 버튼 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            disabled={isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 10, border: '1px solid #374151',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              background: isAnalyzing ? '#13162a' : '#1b1e2e',
              color: isAnalyzing ? '#6b7280' : '#a5b4fc',
              fontSize: 13, fontWeight: 700,
              boxShadow: SHI,
              opacity: isAnalyzing ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isAnalyzing
              ? <><span style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>⏳</span> 리포트 분석 중...</>
              : <><span style={{ fontSize: 16 }}>⬆️</span> 새 리포트 업로드 (.pdf)</>
            }
          </button>

          {/* PDF 다운로드 버튼 */}
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #4338ca, #6366f1)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}
            onClick={() => alert('PDF 파일이 준비되면 다운로드됩니다.')}
          >
            <span style={{ fontSize: 16 }}>📄</span>
            리포트 PDF 다운로드
          </button>
        </div>
      </div>

      {/* ── 현재 적용된 리포트 정보 바 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderRadius: 10, marginBottom: 20,
        background: '#13162a', boxShadow: SHI,
        fontSize: 12, color: '#6b7280',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 14 }}>📌</span>
        <span style={{ fontWeight: 600, color: '#9ca3af' }}>현재 적용된 리포트:</span>
        <span style={{ fontWeight: 700, color: '#a5b4fc' }}>
          {report?.name ?? 'Valkyrie_Final4.pdf'}
        </span>
        <span style={{ color: '#4b5563' }}>
          ({report?.date ?? '2026.05.01'})
        </span>
        {isAnalyzing && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 6, padding: '3px 10px',
          }}>
            ⏳ 리포트 분석 중...
          </span>
        )}
      </div>

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
          padding: '14px 20px', borderRadius: 12,
          background: '#1b1e2e', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #252840',
          color: '#dde4f0', fontSize: 13, fontWeight: 600,
          maxWidth: 400, lineHeight: 1.5,
          animation: 'slideUp 0.25s ease-out',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ── 자산 배분 시각화 ── */}
      <div style={{
        background: N, boxShadow: SHO, borderRadius: 16,
        padding: '24px 28px', marginBottom: 28,
        display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* 섹션 제목 */}
        <div style={{ width: '100%', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
            📊 Core-Satellite 배분 현황
          </span>
        </div>

        {/* 왼쪽: 도넛 차트 */}
        <div style={{ flexShrink: 0, position: 'relative', width: 220, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DONUT_DATA}
                cx="50%" cy="50%"
                innerRadius={68} outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {DONUT_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#141728', border: '1px solid #252840', borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any, name: any) => [`${val}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* 중앙 텍스트 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center' as const, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 11, color: '#454868', fontWeight: 600, marginBottom: 2 }}>총 투자</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#dde4f0' }}>1억 원</div>
          </div>
        </div>

        {/* 도넛 범례 */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, minWidth: 140 }}>
          {DONUT_DATA.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#dde4f0' }}>{d.name}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: d.color, lineHeight: 1.1 }}>{d.value}%</div>
              </div>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ width: 1, height: 160, background: '#1e2140', flexShrink: 0, alignSelf: 'center' }} />

        {/* 오른쪽: 섹터별 비중 요약 */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#363855', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
            섹터별 주요 비중
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {SECTORS.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* 퍼센트 바 */}
                <div style={{ width: 100, flexShrink: 0 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: '#0e1020',
                    boxShadow: 'inset 2px 2px 4px #0a0c14',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${s.pct * 3}%`,
                      background: s.color, borderRadius: 3,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
                {/* 수치 */}
                <span style={{ fontSize: 14, fontWeight: 800, color: s.color, minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>
                  {s.pct}%
                </span>
                {/* 레이블 */}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#dde4f0' }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: '#454868', marginLeft: 6 }}>{s.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 핵심 쟁점 판정 테이블 ── */}
      <div style={{ background: N, boxShadow: SHO, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>

        {/* 테이블 헤더 */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #252840', background: '#141728' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🔍 핵심 쟁점 판정 — 최종 확정
          </span>
        </div>

        {/* 컬럼 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 160px 1fr',
          gap: 0,
          padding: '10px 24px',
          borderBottom: '1px solid #1e2140',
          background: '#13162a',
        }}>
          {['#', '쟁점 항목', '최종 판정', '판정 근거'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: '#454868', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
          ))}
        </div>

        {/* 데이터 행 */}
        {ISSUES.map((row, idx) => (
          <div
            key={row.no}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 160px 1fr',
              gap: 0,
              padding: '18px 24px',
              borderBottom: idx < ISSUES.length - 1 ? '1px solid #1e2140' : 'none',
              background: idx % 2 === 0 ? 'transparent' : 'rgba(20,23,40,0.4)',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
          >
            {/* 번호 */}
            <span style={{ fontSize: 13, fontWeight: 800, color: '#363855' }}>{row.no}</span>

            {/* 쟁점 */}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#dde4f0' }}>{row.topic}</span>

            {/* 판정 배지 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: row.verdictColor,
                background: `${row.badgeColor}88`,
                border: `1px solid ${row.verdictColor}55`,
                borderRadius: 6, padding: '3px 9px',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap' as const,
              }}>
                {row.badge}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: row.verdictColor, whiteSpace: 'nowrap' as const }}>
                {row.verdict}
              </span>
            </div>

            {/* 근거 */}
            <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{row.basis}</span>
          </div>
        ))}
      </div>

      {/* ── 교장의 한마디 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1e1e2e 100%)',
        border: '1px solid #312e81',
        borderRadius: 14,
        padding: '28px 32px',
        boxShadow: SHO,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          fontSize: 100, opacity: 0.04, pointerEvents: 'none',
          userSelect: 'none',
        }}>❝</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
          💬 교장의 한마디
        </div>
        <blockquote style={{ margin: 0, borderLeft: '3px solid #6366f1', paddingLeft: 20 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#e0e7ff', lineHeight: 1.7, margin: '0 0 14px', fontStyle: 'italic' }}>
            "좋은 투자는 항상 근거가 명확하다.<br />
            숫자로 설명할 수 없는 투자는 하지 않는다."
          </p>
          <footer style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
            — Peter Lynch
          </footer>
        </blockquote>
      </div>

    </div>
  )
}
