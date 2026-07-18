'use client'
// 🗺️ 종목 추천 지도 — 여러 곳이 각기 다른 근거로 추천하는 걸 한 곳에 모아 위계·근거를 설명(정적 안내 지도)
//    엔진 재구축 0(SSOT 무손상) · 데이터 fetch 0 · 각 렌즈 "무슨 근거로 추천하나" + 바로가기. 학생 혼란 해소.
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'

interface Lens { icon: string; name: string; basis: string; href: string; color: string }

// 최종·종합(위계 상단) — 여러 렌즈를 합치거나 내 손익까지 반영
const FINAL: Lens[] = [
  { icon: '🎯', name: '통합 추천', color: TK.violet400, href: '/dashboard?tab=moneyflow&view=unified',
    basis: '가치(25%)·퀄리티(20%)·모멘텀(20%)·수급(15%)·계절(20%) 5축 종합 랭킹. 펀더멘탈(가치+퀄리티 45%)이 앵커. "여러 근거를 합치면 무엇이 좋은가"의 메인 답.' },
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

function Card({ l, big }: { l: Lens; big?: boolean }) {
  return (
    <a href={l.href} style={{
      display: 'block', textDecoration: 'none', flex: big ? '1 1 320px' : '1 1 300px',
      background: big ? `${l.color}12` : TK.bg3, border: `1px solid ${big ? l.color + '66' : BORDER}`,
      borderRadius: 12, padding: '13px 15px', transition: 'all 0.12s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = l.color }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = big ? l.color + '66' : BORDER }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 17 }}>{l.icon}</span>
        <b style={{ fontSize: 14, color: TK.slate100 }}>{l.name}</b>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: l.color, fontWeight: 700 }}>열기 →</span>
      </div>
      <div style={{ fontSize: 11.5, color: TK.sub2, lineHeight: 1.6 }}>{l.basis}</div>
    </a>
  )
}

export default function RecoHub() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,#141020,${TK.bg1})`, border: `1px solid ${TK.violet400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>🗺️ 종목 추천 지도</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55 }}>
          여러 화면이 <b style={{ color: TK.slate300 }}>각기 다른 근거</b>로 종목을 추천합니다 — 매크로·수급·가치·모멘텀·섹터 흐름.
          <b style={{ color: TK.violet400 }}> 근거를 알면 헷갈리지 않습니다.</b> 각 렌즈가 무엇을 보는지, 어디서 최종 결정을 내리는지 한눈에.
        </div>
      </div>

      {/* 위계 흐름 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TK.slate200, marginBottom: 8 }}>📐 추천의 위계 — 렌즈들이 합쳐져 최종 처방이 된다</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ padding: '6px 11px', borderRadius: 8, background: TK.bg1, border: `1px solid ${BORDER}`, color: TK.sub2 }}>🔍 특수 렌즈들<br /><span style={{ fontSize: 9.5, color: TK.sub4 }}>매크로·수급·가치·10배거·섹터</span></span>
          <span style={{ color: TK.sub3, fontSize: 16 }}>→</span>
          <span style={{ padding: '6px 11px', borderRadius: 8, background: `${TK.violet400}18`, border: `1px solid ${TK.violet400}66`, color: TK.violet400, fontWeight: 700 }}>🎯 통합 추천<br /><span style={{ fontSize: 9.5, color: TK.sub3 }}>5축 종합 랭킹</span></span>
          <span style={{ color: TK.sub3, fontSize: 16 }}>→</span>
          <span style={{ padding: '6px 11px', borderRadius: 8, background: `${TK.emerald500}18`, border: `1px solid ${TK.emerald500}66`, color: TK.emerald500, fontWeight: 700 }}>🤖 AI 리밸런싱<br /><span style={{ fontSize: 9.5, color: TK.sub3 }}>내 손익까지 = 최종</span></span>
        </div>
        <div style={{ fontSize: 11, color: TK.sub3, marginTop: 9, lineHeight: 1.6 }}>
          각 렌즈는 <b>한 가지 각도</b>만 봅니다(그래서 1위가 서로 다른 게 정상). <b style={{ color: TK.violet400 }}>통합 추천</b>이 5축을 합치고,
          <b style={{ color: TK.emerald500 }}> AI 리밸런싱</b>이 내 실제 포트폴리오 손익까지 반영해 ‘무엇을 팔고 무엇을 살지’를 최종 처방합니다.
        </div>
      </div>

      {/* 최종·종합 */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: TK.emerald500, letterSpacing: '0.05em', margin: '2px 2px 8px' }}>🏆 종합·최종 — 여기서 결정</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {FINAL.map(l => <Card key={l.name} l={l} big />)}
        </div>
      </div>

      {/* 특수 렌즈 */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: TK.sub2, letterSpacing: '0.05em', margin: '4px 2px 8px' }}>🔍 특수 렌즈 — 각기 다른 근거(참고용)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {LENSES.map(l => <Card key={l.name} l={l} />)}
        </div>
      </div>

      {/* 교육 포인트 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 15px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TK.slate200, marginBottom: 7 }}>🎓 읽는 법</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: TK.sub2, lineHeight: 1.75 }}>
          <li><b style={{ color: TK.green400 }}>여러 렌즈가 동시에 꼽는 종목 = 근거가 겹쳐 신뢰도↑.</b> 매크로·수급·가치가 한 종목을 함께 가리키면 강한 신호.</li>
          <li><b>렌즈마다 1위가 다른 건 당연.</b> 보는 각도가 다르기 때문 — 매크로 렌즈는 삼성전자, 가치 렌즈는 다른 종목일 수 있음. 모순이 아니라 다른 질문에 답하는 것.</li>
          <li><b>최종 결정은 🎯통합 추천 → 🤖AI 리밸런싱</b> 순서로. 특수 렌즈는 ‘왜’를 이해하는 참고 자료.</li>
          <li>매수 전엔 <b>종목 리서치의 &lsquo;🎯 종합 매수 판정&rsquo;</b>으로 그 종목 하나를 다시 확인(4축+기술 타이밍).</li>
        </ul>
      </div>

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.5 }}>
        ⚠️ 모든 추천은 교육용 참고 자료이며 매수 지시가 아닙니다. 자동 주문 없음 — 직접 판단·실행하세요.
      </div>
    </div>
  )
}
