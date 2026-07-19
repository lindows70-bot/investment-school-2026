'use client'
// 🗺️ 종목 추천 지도 — 여러 곳이 각기 다른 근거로 추천하는 걸 한 곳에 모아 위계·근거를 인포그래픽으로 설명(정적 안내 지도)
//    엔진 재구축 0(SSOT 무손상) · 데이터 fetch 0 · 추천 파이프라인 시각화 + 렌즈 메달리온 카드. 학생 혼란 해소.
import type { ReactNode } from 'react'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'

interface Lens { icon: string; name: string; basis: string; href: string; color: string }

// 최종·종합(위계 상단) — 여러 렌즈를 합치거나 내 손익까지 반영
const FINAL: Lens[] = [
  { icon: '🎯', name: '통합 추천', color: TK.violet400, href: '/dashboard?tab=moneyflow&view=unified',
    basis: '가치(25%)·퀄리티(20%)·모멘텀(20%)·주도섹터(10%)·수급(10%)·계절(15%) 6축 종합 랭킹. 펀더멘탈(가치+퀄리티 45%)이 앵커. "여러 근거를 합치면 무엇이 좋은가"의 메인 답.' },
  { icon: '🤖', name: 'AI 리밸런싱', color: TK.emerald500, href: '/dashboard?tab=rebalance',
    basis: '통합 추천 + 내 실제 손익(익절/손절 4분면) + 자산배분까지 반영해 "무엇을 빼고 무엇을 담을지" 최종 처방. 궁극의 통합 결정.' },
]

// 특수 렌즈 — 각기 한 가지 각도로만 본다(그래서 1위가 서로 다르다)
const LENSES: Lens[] = [
  { icon: '🌐', name: '거시경제 AI 추천', color: '#38bdf8', href: '/dashboard?tab=macroai',
    basis: '지금 매크로 국면(금리·CPI·장단기차)에 맞는 성격의 린치 퀀트 우량주. 근거 = 매크로 국면 × 펀더멘탈 점수(린치·PEG·마진·FCF).' },
  { icon: '🎯', name: '맞춤 추천 (국내)', color: TK.amber400, href: '/dashboard?tab=moneyflow&view=reco',
    basis: '외국인·기관이 실제로 사 모으는 국내주. 근거 = 실수급(쌍끌이·개인 이탈) + 저PEG. 미국은 일별 수급이 없어 국내 전용.' },
  { icon: '🎯', name: '알파 헌터', color: '#a855f7', href: '/dashboard?tab=alphahunter',
    basis: '가치(이익)는 오르는데 주가는 안 따라온 괴리(저평가) vs 주가만 펌핑된 거품. 근거 = 이익성장률 − 주가수익률.' },
  { icon: '🚀', name: '10배거 헌터', color: TK.red400, href: '/dashboard?tab=tenbagger',
    basis: '아무 종목이나 입력하면 린치 10루타 7대 기준으로 채점. 근거 = 작은 시총 + 고성장 + 저PEG + 언더커버리지(고위험·발굴형).' },
  { icon: '🧭', name: '섹터 로테이션 시계', color: '#2dd4bf', href: '/dashboard?tab=rotation',
    basis: '지금 돈이 몰려 오르는 섹터·소섹터의 대표 ETF. 근거 = 상대강도 × 모멘텀(자금 흐름의 국면). 개별 종목보다 "흐름".' },
]

// 파이프라인 단계 노드
function Stage({ title, sub, accent, big, children }: { title: string; sub: string; accent?: string; big?: boolean; children?: ReactNode }) {
  return (
    <div style={{
      flex: big ? '1.15 1 190px' : '1 1 168px', minWidth: 150,
      background: accent ? `linear-gradient(155deg, ${accent}22, ${TK.bg1} 78%)` : TK.bg1,
      border: `1.5px solid ${accent ? accent + '99' : BORDER}`, borderRadius: 13, padding: '14px 14px 15px', textAlign: 'center',
      boxShadow: accent ? `0 0 22px ${accent}22, inset 0 0 0 1px ${accent}18` : 'none',
    }}>
      <div style={{ fontSize: big ? 14.5 : 13, fontWeight: 900, color: accent ?? TK.slate200, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 10, color: accent ? `${accent}cc` : TK.sub3, marginTop: 3, fontWeight: 700 }}>{sub}</div>
      {children}
    </div>
  )
}

function Arrow() {
  return <div className="rh-arrow" style={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', color: TK.sub2, fontSize: 20, fontWeight: 900 }}>→</div>
}

function LensCard({ l }: { l: Lens }) {
  return (
    <a href={l.href} className="rh-lens" data-c={l.color} style={{
      display: 'block', textDecoration: 'none', flex: '1 1 300px',
      background: `linear-gradient(160deg, ${l.color}0e, ${TK.bg3} 60%)`, border: `1px solid ${l.color}3a`,
      borderRadius: 13, padding: '14px 15px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* 컬러 메달리온 */}
        <span style={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: 11, background: `${l.color}22`, border: `1px solid ${l.color}66`, display: 'grid', placeItems: 'center', fontSize: 19, boxShadow: `0 0 14px ${l.color}22` }}>{l.icon}</span>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 14, color: TK.slate100, display: 'block' }}>{l.name}</b>
          <span style={{ fontSize: 10, color: l.color, fontWeight: 800, letterSpacing: '0.03em' }}>렌즈</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: l.color, fontWeight: 800 }}>열기 →</span>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${l.color}, ${l.color}00)`, borderRadius: 2, marginBottom: 8 }} />
      <div style={{ fontSize: 11.5, color: TK.sub2, lineHeight: 1.62 }}>{l.basis}</div>
    </a>
  )
}

function FeatureCard({ l }: { l: Lens }) {
  return (
    <a href={l.href} className="rh-feat" data-c={l.color} style={{
      display: 'block', textDecoration: 'none', flex: '1 1 330px', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(150deg, ${l.color}1c, ${TK.bg2} 72%)`, border: `1.5px solid ${l.color}77`,
      borderRadius: 15, padding: '16px 18px', boxShadow: `0 0 26px ${l.color}1f`,
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${l.color}22, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
        <span style={{ width: 46, height: 46, flex: '0 0 auto', borderRadius: 13, background: `${l.color}2a`, border: `1px solid ${l.color}88`, display: 'grid', placeItems: 'center', fontSize: 23, boxShadow: `0 0 18px ${l.color}33` }}>{l.icon}</span>
        <div>
          <b style={{ fontSize: 16.5, color: TK.slate100, letterSpacing: '-0.01em' }}>{l.name}</b>
          <div style={{ fontSize: 10.5, color: l.color, fontWeight: 800, marginTop: 1 }}>여기서 최종 결정</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: l.color, fontWeight: 800 }}>열기 →</span>
      </div>
      <div style={{ fontSize: 12, color: TK.sub, lineHeight: 1.66 }}>{l.basis}</div>
    </a>
  )
}

export default function RecoHub() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .rh-lens,.rh-feat{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
        .rh-lens:hover,.rh-feat:hover{transform:translateY(-3px)}
        @keyframes rhPulse{0%,100%{opacity:.45;transform:translateX(-1px)}50%{opacity:1;transform:translateX(1px)}}
        .rh-arrow{animation:rhPulse 2s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.rh-arrow{animation:none;opacity:.8}}
      `}</style>

      {/* 히어로 */}
      <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, #1a1230, #14101f 55%, ${TK.bg1})`, border: `1px solid ${TK.violet400}55`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${TK.violet400}2e, transparent 68%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ width: 50, height: 50, flex: '0 0 auto', borderRadius: 14, background: `${TK.violet400}26`, border: `1px solid ${TK.violet400}77`, display: 'grid', placeItems: 'center', fontSize: 26, boxShadow: `0 0 24px ${TK.violet400}33` }}>🗺️</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: TK.slate100, letterSpacing: '-0.02em' }}>종목 추천 지도</div>
            <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55, maxWidth: 760 }}>
              여러 화면이 <b style={{ color: TK.slate300 }}>각기 다른 근거</b>로 종목을 추천합니다 — 매크로·수급·가치·모멘텀·섹터 흐름.
              <b style={{ color: TK.violet400 }}> 근거를 알면 헷갈리지 않습니다.</b>
            </div>
          </div>
        </div>
      </div>

      {/* 추천 파이프라인 시각화 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 15, padding: '18px 18px 16px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate200, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>📐</span> 추천의 위계 — 렌즈가 합쳐져 최종 처방이 된다
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
          <Stage title="🔍 특수 렌즈 5종" sub="각기 다른 각도로 본다">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              {LENSES.map(l => (
                <span key={l.name} title={l.name} style={{ width: 27, height: 27, borderRadius: 8, background: `${l.color}22`, border: `1px solid ${l.color}66`, display: 'grid', placeItems: 'center', fontSize: 13 }}>{l.icon}</span>
              ))}
            </div>
          </Stage>
          <Arrow />
          <Stage big accent={TK.violet400} title="🎯 통합 추천" sub="6축 종합 랭킹">
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 10, fontSize: 14 }}>💎🏰📈🧭💰🌦️</div>
          </Stage>
          <Arrow />
          <Stage big accent={TK.emerald500} title="🤖 AI 리밸런싱" sub="내 손익까지 = 최종">
            <div style={{ marginTop: 10, fontSize: 10.5, color: TK.emerald500, fontWeight: 800, letterSpacing: '0.04em' }}>익절 · 손절 · 편입</div>
          </Stage>
        </div>
        <div style={{ fontSize: 11, color: TK.sub3, marginTop: 13, lineHeight: 1.62 }}>
          각 렌즈는 <b>한 가지 각도</b>만 봅니다(그래서 1위가 서로 다른 게 정상). <b style={{ color: TK.violet400 }}>통합 추천</b>이 6축을 합치고,
          <b style={{ color: TK.emerald500 }}> AI 리밸런싱</b>이 내 실제 포트폴리오 손익까지 반영해 ‘무엇을 팔고 무엇을 살지’를 최종 처방합니다.
        </div>
      </div>

      {/* 종합·최종 */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 900, color: TK.emerald500, letterSpacing: '0.05em', margin: '2px 2px 9px' }}>🏆 종합·최종 — 여기서 결정</div>
        <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
          {FINAL.map(l => <FeatureCard key={l.name} l={l} />)}
        </div>
      </div>

      {/* 특수 렌즈 */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 900, color: TK.sub2, letterSpacing: '0.05em', margin: '4px 2px 9px' }}>🔍 특수 렌즈 — 각기 다른 근거(참고용)</div>
        <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
          {LENSES.map(l => <LensCard key={l.name} l={l} />)}
        </div>
      </div>

      {/* 읽는 법 */}
      <div style={{ background: `linear-gradient(160deg, ${TK.green400}0c, ${TK.bg3} 55%)`, border: `1px solid ${TK.green400}33`, borderRadius: 13, padding: '14px 16px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate200, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>🎓 읽는 법</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { i: '🎯', c: TK.green400, t: <><b style={{ color: TK.green400 }}>여러 렌즈가 동시에 꼽는 종목 = 근거가 겹쳐 신뢰도↑.</b> 매크로·수급·가치가 한 종목을 함께 가리키면 강한 신호.</> },
            { i: '🔀', c: TK.blue400, t: <><b>렌즈마다 1위가 다른 건 당연.</b> 보는 각도가 다르기 때문 — 매크로 렌즈는 삼성전자, 가치 렌즈는 다른 종목일 수 있음. 모순이 아니라 다른 질문에 답하는 것.</> },
            { i: '🏆', c: TK.violet400, t: <><b>최종 결정은 🎯통합 추천 → 🤖AI 리밸런싱</b> 순서로. 특수 렌즈는 ‘왜’를 이해하는 참고 자료.</> },
            { i: '✅', c: TK.amber400, t: <>매수 전엔 <b>종목 리서치의 ‘🎯 종합 매수 판정’</b>으로 그 종목 하나를 다시 확인(6축+기술 타이밍).</> },
          ].map((r, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span style={{ width: 24, height: 24, flex: '0 0 auto', borderRadius: 7, background: `${r.c}1e`, border: `1px solid ${r.c}55`, display: 'grid', placeItems: 'center', fontSize: 12 }}>{r.i}</span>
              <div style={{ fontSize: 11.5, color: TK.sub2, lineHeight: 1.6, paddingTop: 2 }}>{r.t}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.5 }}>
        ⚠️ 모든 추천은 교육용 참고 자료이며 매수 지시가 아닙니다. 자동 주문 없음 — 직접 판단·실행하세요.
      </div>
    </div>
  )
}
