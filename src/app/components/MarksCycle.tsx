'use client'
// 🕰️ 하워드 막스 마켓 사이클 시계추 UI — 4축 탐욕↔공포 종합 진자 + 스탠스 다이얼 + 2차적 사고 박스
import { useEffect, useState } from 'react'
import type { MarksCycleResult, MarksAxis } from '@/app/api/marks-cycle/route'
import PermanentLossRadar from '@/app/components/PermanentLossRadar'

const BORDER = '#2a2f3a'
// 구간별 색(역발상): 탐욕=빨강(경계) ↔ 공포=초록(기회)
const ZONE_COLOR: Record<string, string> = {
  euphoria: '#ef4444', optimism: '#f59e0b', balance: '#64748b', pessimism: '#14b8a6', panic: '#22c55e',
}

export default function MarksCycle() {
  const [data, setData] = useState<MarksCycleResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/marks-cycle').then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(() => setErr('시계추 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.'))
  }, [])

  if (err) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>🕰️ 사이클 시계추 계산 중…</div>

  const color = ZONE_COLOR[data.zone] ?? '#64748b'
  // 진자 각도: pendulum −100(공포·왼쪽)=180°, 0=90°(꼭대기), +100(탐욕·오른쪽)=0°
  const cx = 150, cy = 140, R = 118
  const angle = (180 - ((data.pendulum + 100) / 200) * 180) * (Math.PI / 180)
  const nx = cx + R * Math.cos(angle), ny = cy - R * Math.sin(angle)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#141824,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>🕰️ 하워드 막스 마켓 사이클 시계추</div>
        <div style={{ fontSize: 12, color: '#8599ae', marginTop: 4, lineHeight: 1.5 }}>
          군중 심리는 늘 <b style={{ color: '#ef4444' }}>극단적 낙관</b>과 <b style={{ color: '#22c55e' }}>극단적 비관</b> 사이를 시계추처럼 오간다.
          지금 어디에 서 있는지 4개 축으로 읽고, 막스식 역발상 스탠스를 제시한다. <b style={{ color: '#cbd5e1' }}>예측이 아니라 현재 위치.</b>
        </div>
      </div>

      {/* 시계추 게이지 + 스탠스 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ flex: '1 1 300px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, textAlign: 'center' }}>
          <svg viewBox="0 0 300 165" style={{ width: '100%', maxWidth: 340 }}>
            {/* 반원 눈금대 */}
            <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#1e2430" strokeWidth={16} strokeLinecap="round" />
            {/* 구간 색대(공포→균형→탐욕) */}
            <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" strokeWidth={16} strokeLinecap="round"
              stroke="url(#marksGrad)" opacity={0.55} />
            <defs>
              <linearGradient id="marksGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22c55e" /><stop offset="50%" stopColor="#64748b" /><stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {/* 바늘 */}
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={3.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={7} fill={color} />
            {/* 양끝 라벨 */}
            <text x={cx - R} y={cy + 20} fill="#22c55e" fontSize={10} fontWeight={700} textAnchor="middle">공포</text>
            <text x={cx + R} y={cy + 20} fill="#ef4444" fontSize={10} fontWeight={700} textAnchor="middle">탐욕</text>
            {/* 온도 */}
            <text x={cx} y={cy - 22} fill={color} fontSize={30} fontWeight={800} textAnchor="middle">{data.temp}</text>
            <text x={cx} y={cy - 6} fill="#8599ae" fontSize={9.5} textAnchor="middle">탐욕 온도(0=공포·100=과열)</text>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>{data.zoneLabel}</div>
        </div>

        {/* 스탠스 카드 */}
        <div style={{ flex: '1 1 300px', background: '#0f1117', border: `1.5px solid ${color}55`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: '#8599ae', fontWeight: 700 }}>막스식 투자 스탠스</div>
          <div style={{ fontSize: 22, fontWeight: 800, color, margin: '4px 0 8px' }}>{data.stanceIcon} {data.stance}</div>
          <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>{data.stanceMsg}</div>
          <div style={{ fontSize: 10.5, color: '#6e7f8f', marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            ⚖️ 막스: <i>&ldquo;고점에선 안 잃는 게, 저점에선 과감함이 이긴다.&rdquo;</i> — 사이클 위치에 따라 공격/방어의 무게를 바꿔라.
          </div>
        </div>
      </div>

      {/* 🩸 강제 매도자 역발상 매수 창 */}
      {(() => {
        const oc = data.opportunity.level === 'strong' ? '#22c55e' : data.opportunity.level === 'fear' ? '#14b8a6' : data.opportunity.level === 'forced' ? '#f59e0b' : '#4b5563'
        const active = data.opportunity.level !== 'none'
        return (
          <div style={{ background: active ? `${oc}14` : '#0f1117', border: `1.5px solid ${oc}${active ? '66' : '33'}`, borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: oc }}>{data.opportunity.label}</div>
            <div style={{ fontSize: 11.5, color: '#cbd5e1', marginTop: 4, lineHeight: 1.55 }}>{data.opportunity.msg}</div>
            <div style={{ fontSize: 10, color: '#6e7f8f', marginTop: 6 }}>막스: 안전마진은 남들이 <b style={{ color: '#94a3b8' }}>팔 수밖에 없을 때</b> 생긴다 — 단 &lsquo;싼 데는 이유가 있다&rsquo;(칼날)와 구분.</div>
          </div>
        )
      })()}

      {/* 4축 분해 */}
      <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🔍 무엇이 시계추를 움직이나 — 4축 분해</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.axes.map((a: MarksAxis) => (
            <div key={a.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{a.icon} {a.label}</span>
                <span style={{ color: a.temp == null ? '#6e7f8f' : (a.temp >= 58 ? '#ef4444' : a.temp <= 42 ? '#22c55e' : '#94a3b8'), fontWeight: 700, fontFamily: 'monospace' }}>
                  {a.temp == null ? '—' : `${a.temp}`}
                </span>
              </div>
              <div style={{ height: 7, background: '#1e2430', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                {a.temp != null && <div style={{ width: `${a.temp}%`, height: '100%', background: a.temp >= 58 ? '#ef4444' : a.temp <= 42 ? '#22c55e' : '#64748b', borderRadius: 4 }} />}
                {/* 중앙(균형) 마커 */}
                <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 9, background: '#4b5563' }} />
              </div>
              <div style={{ fontSize: 10.5, color: '#8599ae', marginTop: 2 }}>{a.detail} <span style={{ color: '#5b6b7c' }}>· {a.source}</span></div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#6e7f8f', marginTop: 10 }}>
          각 축 0~100 탐욕 온도(빨강=탐욕/과열, 초록=공포/침체, 세로선=균형). 가중: 심리 30·밸류 30·레버리지 20·신용 20{data.usedAxes < 4 ? ` · ${4 - data.usedAxes}개 축 데이터 실패(가중 재정규화)` : ''}.
        </div>
      </div>

      {/* 2차적 사고 박스 */}
      <div style={{ background: 'linear-gradient(135deg,#161a26,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>🎯 2차적 사고 — 남들과 똑같이 생각하면 초과수익은 없다</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 240px', background: '#0f1117', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #64748b' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>1차적 사고 (표면)</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>{data.secondLevel.first}</div>
          </div>
          <div style={{ flex: '1 1 240px', background: '#0f1117', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 4 }}>2차적 사고 (한 겹 더)</div>
            <div style={{ fontSize: 12.5, color: '#e2e8f0', lineHeight: 1.5 }}>{data.secondLevel.second}</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: '#6e7f8f', marginTop: 8 }}>
          → 개별 종목의 &lsquo;그 기대가 이미 가격에 반영됐나&rsquo;는 리서치의 <b style={{ color: '#94a3b8' }}>역-DCF(내재기대)</b>·<b style={{ color: '#94a3b8' }}>노이즈 캔슬러(쏠림)</b>로 확인.
        </div>
      </div>

      {/* 정직 캐비엇 */}
      <div style={{ fontSize: 10.5, color: '#6e7f8f', lineHeight: 1.6, padding: '0 4px' }}>
        ⚠️ 막스 원칙: <b>&ldquo;사이클은 알아도 타이밍은 모른다.&rdquo;</b> 이 시계추는 미래를 예측하지 않고 <b>현재 위치</b>만 읽는다.
        극단일수록 신호가 강하고, 균형 구간에선 개별 종목 판단이 우선. 부실채권·사모펀드 같은 막스의 실제 무대는 학생 투자 대상이 아니라 <b>원리</b>(안전마진·역발상)만 차용.
        리스크의 진짜 정의 = 가격 변동성이 아니라 <b>영구적 원금 손실</b> — 무서워서 투매하면 손실을 확정한다.
        · 레이 달리오 페이지(부채 사이클 메커니즘)와 상호보완(막스=군중 심리 시계추).
      </div>

      {/* 🛡️ 리스크 재정의 — 내 종목 변동성 vs 영구손실 */}
      <PermanentLossRadar />
    </div>
  )
}
