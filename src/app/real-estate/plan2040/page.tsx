'use client'
// 🏙️ 2040 서울도시기본계획 교육 페이지 — 최상위 법정계획의 중심지 체계·7대 목표를 투자 학습 관점으로(정책 참조 데이터 큐레이션 · 출처: 서울시 urban.seoul.go.kr)
import Link from 'next/link'
import { TK } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border

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
// 12지역중심 — 2040 공식 도면 표기 기준(마포·공덕 아님 '마포' — 2030 계획과 명칭 다름)
const LOCAL = ['동대문', '망우', '미아', '성수', '신촌', '마포', '연신내·불광', '목동', '봉천', '사당·이수', '수서·문정', '천호·길동']

// 7대 목표(서울시 공식 페이지 원문 기반) + 투자 관점 번역 + 공식 일러스트(urban.seoul.go.kr)
const GOALS = [
  { icon: '🚶', title: '보행일상권 조성', official: '걸어서 누리는 다양한 일상', invest: '도보 생활권 안에 일자리·여가·상업이 갖춰진 동네 = 실수요가 선호하는 입지 조건', img: '/plan2040/goal1.png' },
  { icon: '🌊', title: '수변공간 재편', official: '수변 공간의 잠재력 발굴', invest: '한강·지천 수변 열린 공간 — 수변 접근성이 좋은 단지의 재평가 여지', img: '/plan2040/goal2.png' },
  { icon: '🚇', title: '기반시설 입체화', official: '새로운 도시공간 창출', invest: '지상철도 지하화·차량기지 입체화 — 단절됐던 주변 지역의 장기 개선 재료', img: '/plan2040/goal3.png' },
  { icon: '🏙️', title: '중심지 기능 혁신', official: '미래성장거점 육성·연계', invest: '3도심·7광역중심 = 일자리·인프라 집중축 — 주택 수요의 구조적 배후', img: '/plan2040/goal4.png' },
  { icon: '🛸', title: '미래교통 기반시설', official: '기술발전에 선제적 대응', invest: 'GTX·자율주행 인프라 — 교통 결절점의 접근성 프리미엄 변화', img: '/plan2040/goal5.png' },
  { icon: '🌱', title: '탄소중립 안전도시', official: '미래위기에 준비', invest: '노후 주거지 정비(재건축·리모델링)와 맞물리는 축', img: '/plan2040/goal6.png' },
  { icon: '📐', title: '도시계획 대전환', official: '도시의 다양한 모습 구현', invest: '경직된 높이 규제 유연화(35층 룰 폐지) — 정비사업 사업성에 직접 영향', img: '/plan2040/goal7.png' },
]

// 4대 주제도(서울시 공식 도면 — 정적 이미지, 정책 변경 시 갱신)
const THEME_MAPS = [
  { src: '/plan2040/centers.png', title: '🎯 중심지 체계', desc: '3도심·7광역중심·12지역중심의 중심지 체계 유지 및 기능 고도화' },
  { src: '/plan2040/transport.png', title: '🚄 광역교통축', desc: '광역철도망(GTX)과 중심지 체계를 연계하여 서울 대도시권 실현' },
  { src: '/plan2040/industry.png', title: '🏭 산업·경제축', desc: '4대 혁신축 — 국제경제(금융·핀테크)·감성문화(미디어)·청년첨단(바이오·ICT)·미래융합(AI·로봇·MICE)' },
  { src: '/plan2040/green.png', title: '🌳 공원·녹지·수변축', desc: '한강·남북녹지축 중심 도심 녹지 회복, 수변 중심의 도시공간 재편' },
]

export default function Plan2040Page() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,#1a1410,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>🏙️ 2040 서울도시기본계획 — 서울의 20년 밑그림</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.6 }}>
          서울시 도시계획 분야의 <b style={{ color: TK.orange400 }}>최상위 법정계획</b> — 향후 20년 서울이 나아갈 방향.
          미래상: <b style={{ color: TK.slate200 }}>&ldquo;살기 좋은 나의 서울, 세계 속에 모두의 서울&rdquo;</b>.
          부동산 투자에서 개별 단지의 가격(미시)만큼 중요한 것이 <b style={{ color: TK.orange400 }}>도시가 어디에 돈과 인프라를 심는가(거시)</b>입니다.
        </div>
      </div>

      {/* 원본 종합 공간구조도(서울시 공식 도면) */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🗺️ 2040 서울 공간구조 종합도 — 서울시 공식 도면</div>
        <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 10px' }}>중심지(🔴3도심·🔵7광역·🟡12지역) + 광역교통축(빨강 실선·GTX) + 수변축(파랑) + 남북녹지축(초록)이 한 장에.</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/plan2040/map-master.png" alt="2040 서울 공간구조 종합도" style={{ width: '100%', height: 'auto', borderRadius: 10, background: '#fff' }} />
        <div style={{ color: TK.sub, fontSize: 10, marginTop: 6 }}>출처: 서울특별시 도시계획포털(urban.seoul.go.kr) — 2040 서울도시기본계획 공식 도면</div>
      </div>

      {/* 중심지 체계 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🎯 중심지 체계 — 3도심 · 7광역중심 · 12지역중심</div>
        <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 12px' }}>일자리·교통·상업이 계획적으로 집중되는 축. 카드 클릭 = 해당 지역 단지 리서치로 이동.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CORES.map(c => (
            <Link key={c.name} href={`/real-estate/apt?lawd=${c.lawd}`} style={{ flex: '1 1 240px', textDecoration: 'none', background: TK.bg3, border: `1px solid ${TK.orange400}55`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: TK.orange400, fontWeight: 900, fontSize: 14 }}>🏛️ {c.name} <span style={{ color: TK.sub, fontWeight: 400, fontSize: 10.5 }}>{c.gu}</span></div>
              <div style={{ color: TK.slate200, fontSize: 11.5, fontWeight: 700, marginTop: 3 }}>{c.role}</div>
              <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
            </Link>
          ))}
        </div>
        <div style={{ color: TK.sub9, fontSize: 11, fontWeight: 700, margin: '12px 0 6px' }}>7광역중심</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REGIONAL.map(r => (
            <Link key={r.name} href={`/real-estate/apt?lawd=${r.lawd}`} style={{ textDecoration: 'none', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 12px' }}>
              <span style={{ color: TK.blue400, fontWeight: 800, fontSize: 11.5 }}>{r.name}</span>
              <span style={{ color: TK.sub, fontSize: 10 }}> {r.gu} — {r.note}</span>
            </Link>
          ))}
        </div>
        <div style={{ color: TK.sub9, fontSize: 11, fontWeight: 700, margin: '12px 0 6px' }}>12지역중심</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {LOCAL.map(n => <span key={n} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 10.5, color: TK.slate300 }}>{n}</span>)}
        </div>
      </div>

      {/* 4대 주제도(원본 도면) */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>📐 4대 공간계획 도면 — 중심지·교통·산업·녹지 축</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {THEME_MAPS.map(m => (
            <div key={m.title} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>{m.title}</div>
              <div style={{ color: TK.sub, fontSize: 10.5, margin: '3px 0 8px', lineHeight: 1.5 }}>{m.desc}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.title} style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#fff', padding: 6, boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ color: TK.sub, fontSize: 10, marginTop: 8 }}>출처: 서울특별시 도시계획포털 공식 도면 · 계획은 방향이며 개별 사업은 변경·지연될 수 있음(교육용).</div>
      </div>

      {/* 7대 목표 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>📋 7대 핵심 목표 — 공식 문구와 투자 관점 번역</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
          {GOALS.map(g => (
            <div key={g.title} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 13px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.img} alt={g.title} style={{ width: '100%', height: 96, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>{g.icon} {g.title} <span style={{ color: TK.sub, fontWeight: 400, fontSize: 10.5 }}>— {g.official}</span></div>
              <div style={{ color: TK.sub9, fontSize: 10.5, marginTop: 4, lineHeight: 1.55 }}>💡 {g.invest}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 투자 교육 + 정직 캐비엇 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', fontSize: 11, color: TK.sub9, lineHeight: 1.7 }}>
        <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>🎓 도시기본계획을 투자에 어떻게 쓰나</div>
        도시기본계획은 <b style={{ color: TK.slate200 }}>&lsquo;어디에 수요가 만들어질 것인가&rsquo;의 20년 지도</b>입니다 — 중심지로 지정된 곳에 일자리·교통(GTX 결절)·인프라 예산이 집중되고, 주택 수요는 일자리를 따라갑니다.
        다만 세 가지를 기억하세요: ① <b style={{ color: TK.orange400 }}>기본계획은 방향이지 확정 사업이 아님</b> — 개별 사업(지하화·정비구역)은 수년~수십 년 걸리고 무산·변경될 수 있습니다.
        ② 계획은 이미 가격에 상당 부분 <b style={{ color: TK.orange400 }}>선반영</b>됩니다(발표 시점이 아니라 착공·진척이 재료). ③ 거시 계획(입지)과 미시 검증(<Link href="/real-estate/apt" style={{ color: TK.blue400 }}>실거래·전세가율</Link>·<Link href="/real-estate/honeycomb" style={{ color: TK.blue400 }}>벌집 국면</Link>)을 반드시 함께 보세요 — 좋은 입지도 사이클 상투에 사면 오래 고생합니다.
        <div style={{ marginTop: 8, color: TK.sub, fontSize: 10 }}>출처: 서울특별시 도시계획포털(urban.seoul.go.kr) 2040 서울도시기본계획 · 중심지 체계는 공식 발표 기준 큐레이션(정책 변경 시 갱신 필요) · 교육용 — 특정 지역 매수 추천 아님.</div>
      </div>
    </div>
  )
}
