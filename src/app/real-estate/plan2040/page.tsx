'use client'
// 🏙️ 2040 서울도시기본계획 교육 페이지 — 최상위 법정계획의 중심지 체계·7대 목표를 투자 학습 관점으로(정책 참조 데이터 큐레이션 · 출처: 서울시 urban.seoul.go.kr)
import Link from 'next/link'
import SeoulPlanMap from '@/app/components/SeoulPlanMap'

const CARD = '#141824', BORDER = '#1e293b'

// 중심지 체계(2040 서울도시기본계획 공식) — 정적 정책 참조 데이터(발표 시 갱신). lawd = 단지 리서치 딥링크
const CORES = [
  { name: '서울도심', role: '국제문화교류 중심', desc: '종로·중구 일대 — 역사문화 자원 기반 글로벌 문화교류', lawd: '11110', gu: '종로구·중구' },
  { name: '여의도·영등포', role: '국제금융 중심', desc: '금융 특화 — 여의도 금융지구 고도화', lawd: '11560', gu: '영등포구' },
  { name: '강남', role: '국제업무 중심', desc: '업무·상업 최상위 — 테헤란로 축 첨단산업 융합', lawd: '11680', gu: '강남구' },
]
const REGIONAL = [
  { name: '용산', note: '국제업무지구·용산공원 — 3도심 연결 요지', lawd: '11170', gu: '용산구' },
  { name: '잠실', note: '스포츠·MICE 복합', lawd: '11710', gu: '송파구' },
  { name: '청량리·왕십리', note: '동북권 교통 결절(GTX)', lawd: '11230', gu: '동대문구·성동구' },
  { name: '창동·상계', note: '동북권 신경제 중심', lawd: '11350', gu: '노원구·도봉구' },
  { name: '상암·수색', note: '미디어·DMC', lawd: '11440', gu: '마포구·은평구' },
  { name: '마곡', note: 'R&D 산업 거점', lawd: '11500', gu: '강서구' },
  { name: '가산·대림', note: 'G밸리 산업 중심', lawd: '11530', gu: '구로구·금천구' },
]
const LOCAL = ['동대문', '망우', '미아', '성수', '신촌', '마포·공덕', '연신내·불광', '목동', '봉천', '사당·이수', '수서·문정', '천호·길동']

// 7대 목표(서울시 공식 페이지 원문 기반) + 투자 관점 번역
const GOALS = [
  { icon: '🚶', title: '보행일상권 조성', official: '걸어서 누리는 다양한 일상', invest: '도보 생활권 안에 일자리·여가·상업이 갖춰진 동네 = 실수요가 선호하는 입지 조건' },
  { icon: '🌊', title: '수변공간 재편', official: '수변 공간의 잠재력 발굴', invest: '한강·지천 수변 열린 공간 — 수변 접근성이 좋은 단지의 재평가 여지' },
  { icon: '🚇', title: '기반시설 입체화', official: '새로운 도시공간 창출', invest: '지상철도 지하화·차량기지 입체화 — 단절됐던 주변 지역의 장기 개선 재료' },
  { icon: '🏙️', title: '중심지 기능 혁신', official: '미래성장거점 육성·연계', invest: '3도심·7광역중심 = 일자리·인프라 집중축 — 주택 수요의 구조적 배후' },
  { icon: '🛸', title: '미래교통 기반시설', official: '기술발전에 선제적 대응', invest: 'GTX·자율주행 인프라 — 교통 결절점의 접근성 프리미엄 변화' },
  { icon: '🌱', title: '탄소중립 안전도시', official: '미래위기에 준비', invest: '노후 주거지 정비(재건축·리모델링)와 맞물리는 축' },
  { icon: '📐', title: '도시계획 대전환', official: '도시의 다양한 모습 구현', invest: '경직된 높이 규제 유연화(35층 룰 폐지) — 정비사업 사업성에 직접 영향' },
]

export default function Plan2040Page() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#1a1410,#0d1017)', border: '1px solid #fb923c44', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>🏙️ 2040 서울도시기본계획 — 서울의 20년 밑그림</div>
        <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 4, lineHeight: 1.6 }}>
          서울시 도시계획 분야의 <b style={{ color: '#fb923c' }}>최상위 법정계획</b> — 향후 20년 서울이 나아갈 방향.
          미래상: <b style={{ color: '#e2e8f0' }}>&ldquo;살기 좋은 나의 서울, 세계 속에 모두의 서울&rdquo;</b>.
          부동산 투자에서 개별 단지의 가격(미시)만큼 중요한 것이 <b style={{ color: '#fb923c' }}>도시가 어디에 돈과 인프라를 심는가(거시)</b>입니다.
        </div>
      </div>

      {/* 공간구조 지도 */}
      <SeoulPlanMap />

      {/* 중심지 체계 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🎯 중심지 체계 — 3도심 · 7광역중심 · 12지역중심</div>
        <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 12px' }}>일자리·교통·상업이 계획적으로 집중되는 축. 카드 클릭 = 해당 지역 단지 리서치로 이동.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CORES.map(c => (
            <Link key={c.name} href={`/real-estate/apt?lawd=${c.lawd}`} style={{ flex: '1 1 240px', textDecoration: 'none', background: '#0f1117', border: '1px solid #fb923c55', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: '#fb923c', fontWeight: 900, fontSize: 14 }}>🏛️ {c.name} <span style={{ color: '#8a9aaa', fontWeight: 400, fontSize: 10.5 }}>{c.gu}</span></div>
              <div style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: 700, marginTop: 3 }}>{c.role}</div>
              <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
            </Link>
          ))}
        </div>
        <div style={{ color: '#a8b5c2', fontSize: 11, fontWeight: 700, margin: '12px 0 6px' }}>7광역중심</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REGIONAL.map(r => (
            <Link key={r.name} href={`/real-estate/apt?lawd=${r.lawd}`} style={{ textDecoration: 'none', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 12px' }}>
              <span style={{ color: '#60a5fa', fontWeight: 800, fontSize: 11.5 }}>{r.name}</span>
              <span style={{ color: '#8a9aaa', fontSize: 10 }}> {r.gu} — {r.note}</span>
            </Link>
          ))}
        </div>
        <div style={{ color: '#a8b5c2', fontSize: 11, fontWeight: 700, margin: '12px 0 6px' }}>12지역중심</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {LOCAL.map(n => <span key={n} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 10.5, color: '#cbd5e1' }}>{n}</span>)}
        </div>
      </div>

      {/* 7대 목표 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>📋 7대 핵심 목표 — 공식 문구와 투자 관점 번역</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
          {GOALS.map(g => (
            <div key={g.title} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12 }}>{g.icon} {g.title} <span style={{ color: '#8a9aaa', fontWeight: 400, fontSize: 10.5 }}>— {g.official}</span></div>
              <div style={{ color: '#a8b5c2', fontSize: 10.5, marginTop: 4, lineHeight: 1.55 }}>💡 {g.invest}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 투자 교육 + 정직 캐비엇 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', fontSize: 11, color: '#a8b5c2', lineHeight: 1.7 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>🎓 도시기본계획을 투자에 어떻게 쓰나</div>
        도시기본계획은 <b style={{ color: '#e2e8f0' }}>&lsquo;어디에 수요가 만들어질 것인가&rsquo;의 20년 지도</b>입니다 — 중심지로 지정된 곳에 일자리·교통(GTX 결절)·인프라 예산이 집중되고, 주택 수요는 일자리를 따라갑니다.
        다만 세 가지를 기억하세요: ① <b style={{ color: '#fb923c' }}>기본계획은 방향이지 확정 사업이 아님</b> — 개별 사업(지하화·정비구역)은 수년~수십 년 걸리고 무산·변경될 수 있습니다.
        ② 계획은 이미 가격에 상당 부분 <b style={{ color: '#fb923c' }}>선반영</b>됩니다(발표 시점이 아니라 착공·진척이 재료). ③ 거시 계획(입지)과 미시 검증(<Link href="/real-estate/apt" style={{ color: '#60a5fa' }}>실거래·전세가율</Link>·<Link href="/real-estate/honeycomb" style={{ color: '#60a5fa' }}>벌집 국면</Link>)을 반드시 함께 보세요 — 좋은 입지도 사이클 상투에 사면 오래 고생합니다.
        <div style={{ marginTop: 8, color: '#8a9aaa', fontSize: 10 }}>출처: 서울특별시 도시계획포털(urban.seoul.go.kr) 2040 서울도시기본계획 · 중심지 체계는 공식 발표 기준 큐레이션(정책 변경 시 갱신 필요) · 교육용 — 특정 지역 매수 추천 아님.</div>
      </div>
    </div>
  )
}
