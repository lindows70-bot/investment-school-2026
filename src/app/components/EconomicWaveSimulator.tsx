'use client'
// 경제 파동 중첩 시뮬레이터 — 키친(3~4년)·주글라르(9~10년)·콘드라티예프(50~60년) 사인파 합성으로 '왜 4계절(단기)과 현실(장기 AI)이 어긋나나'를 시각 설명
import { useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'

const CARD = '#12151c', BORDER = '#252a36'
const C_KITCHIN = '#60a5fa', C_JUGLAR = '#34d399', C_KOND = '#f59e0b', C_SUM = '#93c5fd'
// 각 파동 주기(년)
const P_KITCHIN = 3.5, P_JUGLAR = 9.5, P_KOND = 55
const YEARS = 60, STEP = 0.25

export default function EconomicWaveSimulator() {
  const [ak, setAk] = useState(1)    // 키친 진폭
  const [aj, setAj] = useState(2)    // 주글라르 진폭
  const [ako, setAko] = useState(5)  // 콘드라티예프 진폭
  const [eduOpen, setEduOpen] = useState(false)

  const data = useMemo(() => {
    const out: { t: number; kitchin: number; juglar: number; kond: number; sum: number }[] = []
    for (let t = 0; t <= YEARS; t += STEP) {
      const kitchin = ak * Math.sin((2 * Math.PI * t) / P_KITCHIN)
      const juglar = aj * Math.sin((2 * Math.PI * t) / P_JUGLAR)
      const kond = ako * Math.sin((2 * Math.PI * t) / P_KOND)
      out.push({ t: Math.round(t * 100) / 100, kitchin, juglar, kond, sum: kitchin + juglar + kond })
    }
    return out
  }, [ak, aj, ako])

  // 우측 끝(현재) 국면: 종합 추세의 값·기울기로 4국면 판정
  const phase = useMemo(() => {
    const n = data.length
    const last = data[n - 1].sum, prev = data[n - 6]?.sum ?? last
    const rising = last >= prev
    if (rising && last >= 0) return { label: '성장 및 확장 국면', color: '#34d399', desc: '세 파동이 상승 동조 — 호황 정점을 향하는 구간' }
    if (rising && last < 0) return { label: '회복 국면', color: '#60a5fa', desc: '바닥을 다지고 반등하는 구간(저점 탈출)' }
    if (!rising && last >= 0) return { label: '둔화 국면', color: '#f59e0b', desc: '고점을 통과해 상승 동력이 식는 구간' }
    return { label: '침체 국면', color: '#f87171', desc: '하강 파동이 겹쳐 위축되는 구간' }
  }, [data])

  const Slider = ({ label, sub, v, set, color }: { label: string; sub: string; v: number; set: (n: number) => void; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 240px' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#cdd6e3', fontSize: 11, fontWeight: 700 }}>{label}</div>
        <div style={{ color: '#7f93a8', fontSize: 9.5 }}>{sub}</div>
      </div>
      <input type="range" min={0} max={10} step={1} value={v} onChange={e => set(Number(e.target.value))}
        style={{ width: 110, accentColor: color }} />
      <span style={{ width: 26, textAlign: 'center', color: '#e2e8f0', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{v}</span>
    </div>
  )

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🌊 경제 파동 중첩 시뮬레이터</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>키친·주글라르·콘드라티예프 3대 파동의 합 = 실제 경기</span>
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10.5, marginBottom: 6 }}>
        <span style={{ color: C_KITCHIN }}>■ 키친 (3~4년·재고)</span>
        <span style={{ color: C_JUGLAR }}>■ 주글라르 (9~10년·설비투자)</span>
        <span style={{ color: C_KOND }}>■ 콘드라티예프 (50~60년·기술혁신)</span>
        <span style={{ color: C_SUM, fontWeight: 800 }}>■ 종합 시장 추세</span>
      </div>

      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <ReferenceLine y={0} stroke="#3a4152" />
            <XAxis dataKey="t" type="number" domain={[0, YEARS]} ticks={[0, 10, 20, 30, 40, 50, 60]}
              tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={{ stroke: BORDER }} tickLine={false}
              label={{ value: '시간 (년) →', position: 'insideBottomRight', offset: -2, fill: '#7f93a8', fontSize: 9.5 }} />
            <YAxis tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={34}
              label={{ value: '경기 지수 ↑', position: 'insideTopLeft', fill: '#7f93a8', fontSize: 9.5, dy: -2 }} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              labelFormatter={(v) => `${v}년차`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any, n: any) => [Number(val).toFixed(1), { kitchin: '키친', juglar: '주글라르', kond: '콘드라티예프', sum: '종합' }[n as string] ?? n]} />
            <Line type="monotone" dataKey="kitchin" stroke={C_KITCHIN} strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.7} />
            <Line type="monotone" dataKey="juglar" stroke={C_JUGLAR} strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.7} />
            <Line type="monotone" dataKey="kond" stroke={C_KOND} strokeWidth={1.4} dot={false} isAnimationActive={false} opacity={0.85} />
            <Line type="monotone" dataKey="sum" stroke={C_SUM} strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 종합 국면 라벨 */}
      <div style={{ textAlign: 'center', margin: '6px 0 10px' }}>
        <div style={{ color: '#8a9aaa', fontSize: 11 }}>시장 종합 추세</div>
        <div style={{ color: phase.color, fontWeight: 800, fontSize: 15 }}>{phase.label}</div>
        <div style={{ color: '#7f93a8', fontSize: 10.5 }}>{phase.desc}</div>
      </div>

      {/* 진폭 슬라이더 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
        <Slider label="키친 파동 (재고, 3~4년)" sub="단기 — 재고 조정" v={ak} set={setAk} color={C_KITCHIN} />
        <Slider label="주글라르 파동 (설비투자, 9~10년)" sub="중기 — CAPEX 주기" v={aj} set={setAj} color={C_JUGLAR} />
        <Slider label="콘드라티예프 파동 (기술혁신, 50~60년)" sub="장기 — 산업혁명급 패러다임" v={ako} set={setAko} color={C_KOND} />
      </div>

      {/* 🎓 교육 + 우리 앱 연결 */}
      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 2px', textAlign: 'left' }}>
        <span style={{ color: '#f7931a', fontWeight: 800, fontSize: 12 }}>🎓 왜 4계절(거시)과 현실(AI)이 어긋날까?</span>
        <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: '#aab6c4', fontSize: 11, lineHeight: 1.65, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>📊 <b style={{ color: C_KITCHIN }}>키친(3~4년)</b> = 기업 <b>재고</b> 사이클. 짧고 잦은 잔물결(앱의 📦재고 회전율 레이더가 이 고점을 잡습니다).</div>
          <div>🏭 <b style={{ color: C_JUGLAR }}>주글라르(9~10년)</b> = <b>설비투자(CAPEX)</b> 사이클. 지금 AI 데이터센터·전력망 붐이 이 파동의 상승 초입입니다.</div>
          <div>🚀 <b style={{ color: C_KOND }}>콘드라티예프(50~60년)</b> = <b>기술혁명</b> 파동(증기·전기·IT, 그리고 지금 <b>AI</b>). 너무 거대해서 단기 금리 파동(4계절 여름)쯤은 가볍게 압도합니다.</div>
          <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 8, padding: '8px 11px' }}>
            🧭 <b style={{ color: '#93c5fd' }}>핵심</b> — 4계절 내비게이터는 <b>단·중기 파동(키친·주글라르)</b>을 측정합니다. 그런데 지금 시장은 <b>콘드라티예프 상승 파동(AI)</b>이라는 거대한 해일 위에 있어, "여름이라 기술주 불리"라는 교과서를 무시하고 오릅니다. <b>괴리는 버그가 아니라, 측정 중인 파동보다 더 큰 파동이 시장을 끌고 가고 있다는 신호</b>입니다.
          </div>
          <div style={{ color: '#7f93a8' }}>⚠️ 위 차트는 파동 원리를 보여주는 <b>교육용 사인파 모델</b>(실측 경기 데이터 아님)입니다. 진폭을 바꿔보며 &lsquo;큰 파동이 작은 파동을 어떻게 압도하는지&rsquo;를 직접 확인하세요.</div>
        </div>
      )}
    </div>
  )
}
