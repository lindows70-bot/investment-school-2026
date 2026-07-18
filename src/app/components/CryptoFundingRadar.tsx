'use client'
// 🪙 크립토 펀딩비·OI 과열 레이더 — BTC·ETH·SOL 무기한 선물 펀딩비 + 미결제약정(OI)로 레버리지 froth 감지
//    펀딩 高양(+)=롱 과열(청산 위험) / 음(−)=숏 과밀(역발상 반등). 코인 랩 ₿ 뷰. 경보만.
import { useEffect, useState, type ReactNode } from 'react'
import type { CryptoFundingResult, CoinFroth, FundVerdict } from '@/app/api/crypto-funding/route'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'
const V_META: Record<FundVerdict, { color: string; label: string }> = {
  long_hot: { color: TK.red400, label: '롱 과열' },
  short_skew: { color: '#38bdf8', label: '숏 과밀' },
  neutral: { color: TK.green500, label: '정상' },
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${Math.round(v).toLocaleString()}`
}

/** 미니 스파크라인 — 연율화 펀딩(0 기준선, 양=빨강/음=파랑) */
function Spark({ vals }: { vals: number[] }) {
  if (vals.length < 3) return null
  const w = 120, h = 30
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals)
  const rng = max - min || 1
  const x = (i: number) => (i / (vals.length - 1)) * w
  const y = (v: number) => h - ((v - min) / rng) * h
  const zeroY = y(0)
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = vals[vals.length - 1]
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke={TK.slate600} strokeWidth={0.7} strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke={last >= 0 ? TK.red400 : '#38bdf8'} strokeWidth={1.4} />
    </svg>
  )
}

function CoinCard({ c }: { c: CoinFroth }) {
  const m = V_META[c.verdict]
  // 펀딩 게이지: −50%~+100% 매핑
  const gPct = Math.max(0, Math.min(100, ((c.fundingAnnual + 50) / 150) * 100))
  return (
    <div style={{ flex: '1 1 240px', background: TK.bg3, border: `1px solid ${c.verdict !== 'neutral' ? m.color + '55' : BORDER}`, borderRadius: 12, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{c.emoji}</span>
        <b style={{ fontSize: 13.5, color: TK.slate100 }}>{c.name}</b>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: m.color, background: `${m.color}22`, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '2px 7px' }}>
          {c.severity === 'high' ? '🔥 ' : ''}{m.label}
        </span>
      </div>

      {/* 펀딩 연율화 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: c.fundingAnnual >= 30 ? TK.red400 : c.fundingAnnual <= -5 ? '#38bdf8' : TK.slate100, fontFamily: 'monospace' }}>
          {c.fundingAnnual > 0 ? '+' : ''}{c.fundingAnnual.toFixed(1)}%
        </span>
        <span style={{ fontSize: 10, color: TK.sub3 }}>연율 펀딩비</span>
      </div>
      {/* 게이지 */}
      <div style={{ position: 'relative', height: 6, background: TK.bg1, borderRadius: 3, margin: '6px 0 8px' }}>
        <div style={{ position: 'absolute', left: `${(50 / 150) * 100}%`, top: -2, width: 1, height: 10, background: TK.slate500 }} />
        <div style={{ position: 'absolute', left: `${Math.min(gPct, 50 / 150 * 100)}%`, width: `${Math.abs(gPct - 50 / 150 * 100)}%`, height: 6, borderRadius: 3, background: c.fundingAnnual >= 0 ? TK.red400 : '#38bdf8' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: TK.sub2, flexWrap: 'wrap' }}>
        <span title="최근 30일 평균 펀딩비(연율). 지금 값이 일시적인지 추세인지 비교용">30일평균 <b style={{ color: TK.slate300 }}>{c.fundingAvg30 > 0 ? '+' : ''}{c.fundingAvg30.toFixed(1)}%</b></span>
        <span title="지금 펀딩비가 과거 이력에서 어느 높이인가(65%=과거보다 낮았던 날이 65%). 90%+면 역사적으로도 뜨거움">백분위 <b style={{ color: TK.slate300 }}>{c.fundingPctile}%</b></span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: TK.sub2, marginTop: 3, flexWrap: 'wrap' }}>
        <span title="미결제약정 = 아직 청산 안 된 선물 계약 총액 = 시장에 깔린 레버리지(빚) 총량">OI <b style={{ color: TK.slate300 }}>{fmtUsd(c.oiValueUsd)}</b></span>
        {c.oiChange30 != null && (
          <span title="OI 30일 변화. +25%↑(🔥)=새 빚 급증(레버리지 빌드업) / −=빚 정리(디레버리징)">30일 <b style={{ color: c.oiBuildup ? TK.amber400 : (c.oiChange30 >= 0 ? TK.green400 : TK.slate400) }}>{c.oiChange30 > 0 ? '+' : ''}{c.oiChange30}%</b>{c.oiBuildup ? ' 🔥' : ''}</span>
        )}
      </div>
      <div style={{ marginTop: 8 }}><Spark vals={c.fundingSpark} /></div>
    </div>
  )
}

/** 🎓 용어를 비유로 풀어주는 교육 블록 — 기본 펼침(접혀 있으면 학생이 못 봄) */
function EduBlock() {
  const [open, setOpen] = useState(true)
  const Row = ({ q, a }: { q: string; a: ReactNode }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: TK.slate200, marginBottom: 3 }}>{q}</div>
      <div style={{ fontSize: 11, color: TK.sub2, lineHeight: 1.6 }}>{a}</div>
    </div>
  )
  return (
    <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '11px 14px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: TK.slate100, fontSize: 12.5, fontWeight: 800 }}>
        🎓 처음이라면 — 펀딩비·OI 쉽게 이해하기
        <span style={{ marginLeft: 'auto', color: TK.sub3, fontSize: 11 }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <Row q="🎯 무기한 선물이 뭔가요?" a={<>만기가 없는 코인 <b>레버리지(빚투) 상품</b>이에요. &lsquo;오른다&rsquo;에 거는 쪽을 <b style={{ color: TK.red400 }}>롱</b>, &lsquo;내린다&rsquo;에 거는 쪽을 <b style={{ color: '#38bdf8' }}>숏</b>이라 합니다. 실제 코인을 사는 게 아니라 방향에 베팅하는 거라, 여기 쏠림을 보면 <b>대중이 어느 쪽에 빚내서 몰렸는지</b>가 보여요.</>} />
          <Row q="💰 펀딩비(funding rate)란?" a={<>롱과 숏 사이에 <b>8시간마다 주고받는 수수료</b>예요. 🍔 <b>붐비는 쪽이 한산한 쪽에 자릿세를 내는 것</b>과 같아요. <b style={{ color: TK.red400 }}>양(+)</b>이면 롱이 숏에게 지급 → 다들 오른다에 몰림(<b>롱 과열</b>). <b style={{ color: '#38bdf8' }}>음(−)</b>이면 숏이 롱에게 지급 → 다들 내린다에 몰림(<b>숏 과밀·공포</b>). 즉 <b>어느 쪽이 붐비는지 알려주는 온도계</b>입니다.</>} />
          <Row q="📊 &lsquo;연율 펀딩비 +3.4%&rsquo;는 무슨 뜻?" a={<>8시간 수수료를 <b>1년치로 환산</b>한 값이에요. +3.4% = &lsquo;지금 속도면 롱이 1년에 원금의 3.4%를 숏에게 낸다&rsquo;. 평소엔 대략 <b>+5~11%</b>. <b style={{ color: TK.red400 }}>+30%를 넘으면 롱이 너무 붐빔=과열</b>(작은 하락에도 강제청산 도미노 위험). <b style={{ color: '#38bdf8' }}>음수(−)면 숏이 붐빔</b>(반등하면 숏들이 서둘러 되사서 급등=&lsquo;숏스퀴즈&rsquo; 연료).</>} />
          <Row q="📈 미결제약정(OI)이란?" a={<>아직 청산 안 된 선물 계약의 <b>총 규모($)</b> = <b>시장에 깔린 레버리지(빚) 총량</b>이에요. OI가 <b>급증</b>하면 새 빚이 계속 들어오는 것(사이클 후반 과열 주의), <b>감소</b>하면 빚을 정리하는 것(디레버리징). 가격이 오르는데 OI도 늘면 &lsquo;새 돈이 들어온 진짜 상승&rsquo;, 가격만 오르고 OI는 그대로면 &lsquo;힘 약한 상승&rsquo;일 수 있어요.</>} />
          <Row q="🎚️ &lsquo;백분위 65%&rsquo;는?" a={<>지금 펀딩비가 <b>과거 이력에서 어느 높이인가</b>예요. 65% = &lsquo;과거 날들 중 지금보다 낮았던 날이 65%&rsquo; = 평범~약간 높은 편. 90%+면 역사적으로도 뜨거운 상태입니다.</>} />
          <Row q="🚦 판정 색은 어떻게 읽나요?" a={<><b style={{ color: TK.green500 }}>🟢 정상</b> = 레버리지 붐빔 낮음. <b style={{ color: TK.red400 }}>🔴 롱 과열</b> = 다들 빚내서 롱 → 조금만 빠져도 강제청산이 도미노로 터질 수 있음, <b>추격매수 자제</b>. <b style={{ color: '#38bdf8' }}>🔵 숏 과밀</b> = 다들 하락에 베팅한 공포 극단 → 반등 시 숏스퀴즈 가능(단 하락 추세면 함정이니 현물·추세와 함께).</>} />
          <div style={{ fontSize: 10.5, color: TK.sub3, lineHeight: 1.55, borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 2 }}>
            💡 한 줄 요약: <b style={{ color: TK.slate300 }}>펀딩비 = 롱·숏 어디가 붐비나(온도), OI = 빚이 얼마나 쌓였나(총량)</b>. 둘 다 높으면 &lsquo;레버리지가 잔뜩 낀 과열&rsquo;이라 작은 충격에도 크게 흔들려요. <b>가격 차트만으론 안 보이는 위험</b>을 미리 보는 도구입니다.
          </div>
        </div>
      )}
    </div>
  )
}

export default function CryptoFundingRadar() {
  const [data, setData] = useState<CryptoFundingResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crypto-funding').then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(() => setErr('펀딩비 데이터를 불러오지 못했습니다.'))
  }, [])

  if (err) return (
    <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, fontSize: 12, color: TK.sub3 }}>
      🪙 펀딩비·OI 레이더 — {err === 'binance_unreachable' ? 'Binance 선물 데이터에 일시적으로 접근할 수 없습니다.' : err}
    </div>
  )
  if (!data) return <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, fontSize: 12, color: TK.sub3, textAlign: 'center' }}>🪙 펀딩비·OI 계산 중…</div>

  const om = V_META[data.overall]
  return (
    <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: TK.slate100 }}>🪙 펀딩비·미결제약정(OI) 과열 레이더</div>
        <div style={{ fontSize: 11, color: TK.sub3, marginTop: 3, lineHeight: 1.5 }}>
          무기한 선물의 <b style={{ color: TK.slate300 }}>펀딩비</b>=롱/숏 어느 쪽이 과밀한가의 온도. 高양(+)=<b style={{ color: TK.red400 }}>롱 과열</b>(청산 위험) / 음(−)=<b style={{ color: '#38bdf8' }}>숏 과밀</b>(역발상 반등). Binance 무료 데이터.
        </div>
      </div>

      {/* 종합 배너 */}
      <div style={{ background: `${om.color}14`, border: `1px solid ${om.color}55`, borderRadius: 10, padding: '10px 13px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TK.slate100 }}>{data.headline}</div>
        <div style={{ fontSize: 11, color: TK.sub2, marginTop: 5, lineHeight: 1.55 }}>{data.note}</div>
      </div>

      {/* 코인 카드 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {data.coins.map(c => <CoinCard key={c.key} c={c} />)}
      </div>

      {/* 🎓 학생용 용어 교육 — 비유로 풀이(기본 펼침) */}
      <EduBlock />

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.55 }}>
        연율 펀딩 = 8h 펀딩비 × 3 × 365. 🔴 ≥30% 롱 과열 / 🔵 ≤−5% 숏 과밀. OI = 미결제약정 명목가(레버리지 총량). ⚠️ 펀딩비는 후행·단기 지표이며 과열이 곧 하락은 아니다(고펀딩 지속 랠리도 흔함) — 경보는 비중·레버리지 점검 신호이지 매매 지시가 아니다. 코인은 ≤5% 소액·잃어도 되는 돈만.
      </div>
    </div>
  )
}
