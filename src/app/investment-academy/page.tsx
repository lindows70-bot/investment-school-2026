'use client'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

// ── 피터 린치 6대 분류 ────────────────────────────────────────────────────────
const LYNCH_TYPES = [
  {
    emoji: '🐢', name: '저성장주', en: 'Slow Growers',
    color: '#9ca3af',
    desc: '연 2~4% 성장. 배당이 주 수입원. GE, 유틸리티 등 성숙 산업 대표주.',
    tip: '배당수익률 > 성장률이면 보유 검토',
  },
  {
    emoji: '🛡️', name: '대형우량주', en: 'Stalwarts',
    color: '#60a5fa',
    desc: '연 10~12% 안정 성장. 포트폴리오의 방패. 코카콜라·P&G 등.',
    tip: 'PER 20~25배에 매수, 30~35배엔 차익 실현',
  },
  {
    emoji: '🚀', name: '고성장주', en: 'Fast Growers',
    color: '#34d399',
    desc: '연 20~25%+ 고성장. 텐배거(10배)의 주요 후보. 리스크도 크다.',
    tip: 'PEG < 0.5 이하면 적극 매수 고려',
  },
  {
    emoji: '🎢', name: '경기순환주', en: 'Cyclicals',
    color: '#fb923c',
    desc: '경기 업황에 따라 실적이 급등락. 철강·자동차·항공 등.',
    tip: '경기저점에 매수, 고점에서 매도가 핵심',
  },
  {
    emoji: '💎', name: '자산주', en: 'Asset Plays',
    color: '#a78bfa',
    desc: '장부 가치보다 숨겨진 자산이 많은 기업. 부동산·자원 보유사.',
    tip: 'PBR < 1이면 청산 가치 이하 매수 기회',
  },
  {
    emoji: '🔄', name: '회생주', en: 'Turnarounds',
    color: '#f87171',
    desc: '파산 위기 극복 후 급반등하는 기업. 성공 시 수십 배 수익 가능.',
    tip: '부채 감소 + 현금흐름 개선이 핵심 신호',
  },
]

// ── 버핏 해자 4대 요소 ─────────────────────────────────────────────────────────
const MOATS = [
  {
    emoji: '👑', name: '무형 자산',
    color: '#fbbf24',
    desc: '브랜드, 특허, 정부 인허가. 경쟁자가 쉽게 복제할 수 없는 가치.',
    example: '코카콜라·LVMH·퀄컴',
  },
  {
    emoji: '🌐', name: '네트워크 효과',
    color: '#34d399',
    desc: '사용자가 늘수록 서비스 가치가 기하급수적으로 증가.',
    example: '비자카드·메타·링크드인',
  },
  {
    emoji: '🔒', name: '교체 비용',
    color: '#60a5fa',
    desc: '고객이 경쟁사 제품으로 바꾸기 너무 비싸거나 복잡한 구조.',
    example: '마이크로소프트·세일즈포스',
  },
  {
    emoji: '⚡', name: '원가 우위',
    color: '#f87171',
    desc: '경쟁자보다 더 낮은 비용으로 생산·운영할 수 있는 구조적 강점.',
    example: '아마존·코스트코·월마트',
  },
]

// ── 비교 테이블 데이터 ─────────────────────────────────────────────────────────
const COMPARE = [
  { label: '투자 철학',   lynch: '성장주 발굴',       buffett: '가치주 장기 보유' },
  { label: '핵심 전략',   lynch: '텐배거(10배) 사냥', buffett: '스노우볼(복리 누적)' },
  { label: '종목 발굴',   lynch: '생활 속 발견',       buffett: '재무제표 심층 분석' },
  { label: '핵심 지표',   lynch: 'PEG 비율',           buffett: 'ROE·FCF·안전마진' },
  { label: '보유 기간',   lynch: '수년 (성장 확인 후)', buffett: '영구 보유 ("Never sell")' },
  { label: '리스크 관리', lynch: '분산 투자(40~50종목)', buffett: '집중 투자(10~20종목)' },
  { label: '대표 종목',   lynch: 'Hanes·Taco Bell 초기', buffett: '코카콜라·BNSF·애플' },
]

export default function InvestmentAcademyPage() {
  return (
    <div style={{
      padding: '36px 28px 60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#dde4f0',
      maxWidth: 1080,
    }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── 페이지 헤더 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
          🎓 INVESTMENT ACADEMY
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#f1f5f9', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          투자 거장들의 디지털 도서관
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
          피터 린치와 워런 버핏의 검증된 원칙을 배우고, 내 포트폴리오에 직접 적용해보세요.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════
          섹션 1: 피터 린치 — 성장의 마법
      ══════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 56 }}>
        {/* 섹션 타이틀 */}
        <div style={{
          background: N, boxShadow: SHO, borderRadius: 14,
          padding: '20px 24px', marginBottom: 24,
          borderLeft: '4px solid #34d399',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              SECTION 1
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
              📈 피터 린치 — 성장의 마법
            </h2>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', maxWidth: 300 }}>
            "주식시장에서 10루타를 치려면 평범한 기업을 특별하게 볼 줄 알아야 한다."
          </div>
        </div>

        {/* 6대 분류 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
          {LYNCH_TYPES.map(t => (
            <div key={t.name} style={{
              background: N, boxShadow: SHO, borderRadius: 13,
              padding: '18px 20px',
              borderTop: `3px solid ${t.color}`,
              animation: 'fadeIn 0.4s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: t.color, fontWeight: 600, letterSpacing: '0.06em' }}>{t.en}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 10px' }}>{t.desc}</p>
              <div style={{
                background: '#13162a', boxShadow: SHI, borderRadius: 7,
                padding: '7px 10px', fontSize: 11, color: t.color, fontWeight: 600,
              }}>
                💡 {t.tip}
              </div>
            </div>
          ))}
        </div>

        {/* PEG 공식 박스 */}
        <div style={{
          background: N, boxShadow: SHO, borderRadius: 14,
          padding: '22px 28px',
          border: '1px solid rgba(52,211,153,0.2)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            📐 PEG 핵심 공식
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* 공식 */}
            <div style={{
              background: '#13162a', boxShadow: SHI, borderRadius: 10,
              padding: '16px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                PEG = PER ÷ EPS 성장률(%)
              </div>
            </div>
            {/* 판정 기준 */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { range: '0.5 이하', label: '강력 저평가', color: '#ef4444' },
                { range: '0.5 ~ 1.0', label: '저평가', color: '#34d399' },
                { range: '1.0 ~ 1.5', label: '적정', color: '#fbbf24' },
                { range: '1.5 이상', label: '고평가', color: '#60a5fa' },
              ].map(p => (
                <div key={p.range} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: p.color, fontFamily: 'monospace' }}>{p.range}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          섹션 2: 워런 버핏 — 복리의 마법
      ══════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 56 }}>
        <div style={{
          background: N, boxShadow: SHO, borderRadius: 14,
          padding: '20px 24px', marginBottom: 24,
          borderLeft: '4px solid #fbbf24',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              SECTION 2
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
              💰 워런 버핏 — 복리의 마법
            </h2>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', maxWidth: 300 }}>
            "10년 보유할 자신이 없다면, 10분도 갖지 마라."
          </div>
        </div>

        {/* 경제적 해자 4대 요소 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 14 }}>
            🏰 경제적 해자 (Economic Moat) — 4대 요소
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            {MOATS.map(m => (
              <div key={m.name} style={{
                background: N, boxShadow: SHO, borderRadius: 13,
                padding: '18px 20px',
                borderTop: `3px solid ${m.color}`,
              }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{m.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>{m.name}</div>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 10px' }}>{m.desc}</p>
                <div style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>예) {m.example}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 안전 마진 */}
        <div style={{
          background: N, boxShadow: SHO, borderRadius: 14,
          padding: '22px 28px',
          border: '1px solid rgba(251,191,36,0.2)',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              🛡️ 안전 마진 (Margin of Safety)
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
              기업의 <strong style={{ color: '#f1f5f9' }}>내재 가치(Intrinsic Value)</strong>보다
              충분히 싼 가격에 매수함으로써 판단 오류와 시장 변동성에 대한 안전장치를 확보하는 원칙.
              버핏은 통상 내재 가치 대비 <strong style={{ color: '#fbbf24' }}>30~40% 할인된 가격</strong>을 목표로 한다.
            </p>
          </div>
          <div style={{
            background: '#13162a', boxShadow: SHI, borderRadius: 10,
            padding: '16px 20px', textAlign: 'center', minWidth: 140,
          }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>목표 할인율</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24' }}>30~40%</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>내재가치 대비</div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          섹션 3: 거장 스타일 비교 테이블
      ══════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 56 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          SECTION 3
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: '0 0 20px' }}>
          ⚔️ 거장 스타일 비교
        </h2>

        <div style={{ background: N, boxShadow: SHO, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#141728' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#454868', textTransform: 'uppercase', letterSpacing: '0.08em', width: '22%' }}>항목</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#34d399', width: '39%' }}>
                  📈 피터 린치
                </th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#fbbf24', width: '39%' }}>
                  💰 워런 버핏
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={row.label} style={{
                  borderTop: '1px solid #1e2140',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(20,23,40,0.4)',
                }}>
                  <td style={{ padding: '13px 20px', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {row.label}
                  </td>
                  <td style={{ padding: '13px 20px', color: '#dde4f0', lineHeight: 1.5 }}>{row.lynch}</td>
                  <td style={{ padding: '13px 20px', color: '#dde4f0', lineHeight: 1.5 }}>{row.buffett}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          섹션 4: Next Master — Coming Soon
      ══════════════════════════════════════════════════════════ */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#454868', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          SECTION 4
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1b1e2e 50%, #0f0f1a 100%)',
          boxShadow: SHO,
          borderRadius: 16,
          padding: '48px 36px',
          textAlign: 'center',
          border: '1px dashed #2a2d42',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 배경 장식 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            fontSize: 200, opacity: 0.03, pointerEvents: 'none', userSelect: 'none',
          }}>✦</div>

          <div style={{ fontSize: 36, marginBottom: 16 }}>🌟</div>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: '#454868', margin: '0 0 12px', letterSpacing: '0.04em' }}>
            Next Master is Coming...
          </h3>
          <p style={{ fontSize: 13, color: '#363855', margin: 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            다음 거장의 지혜가 곧 이 공간을 채웁니다.<br/>
            하워드 막스, 필립 피셔, 조지 소로스 중 누가 될까요?
          </p>
          <div style={{
            display: 'inline-block', marginTop: 20,
            padding: '6px 16px', borderRadius: 20,
            background: '#13162a', boxShadow: SHI,
            fontSize: 11, color: '#363855', fontWeight: 600, letterSpacing: '0.08em',
          }}>
            COMING SOON
          </div>
        </div>
      </section>

    </div>
  )
}
