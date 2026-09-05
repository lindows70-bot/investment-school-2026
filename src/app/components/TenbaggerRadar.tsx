'use client'
import { TK } from '@/lib/theme'

/**
 * TenbaggerRadar v3 — 포트폴리오 평단가 자동 연동
 *
 * ◆ 변경 사항 (v2 → v3)
 *  - localStorage 수동 입력 완전 폐기
 *  - 부모 dashboard의 investments 배열 props 수신
 *    → purchase_price 를 기준가(basePrice)로 자동 매핑
 *  - 포트폴리오 미등록 종목: "미등록" 배지 + 게이지 비활성
 *  - loading=true 일 때 스켈레톤 UI 표시
 */

// ────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────
interface LivePriceMinimal {
  currentPrice: number
  changePct?:   number
}

interface PortfolioInvestment {
  ticker:         string
  purchase_price: number
  currency:       string
  name?:          string
  market?:        string
}

interface TenbaggerRadarProps {
  priceMap:    Record<string, LivePriceMinimal>
  investments: PortfolioInvestment[]   // 대시보드 investments 전달
  loading:     boolean                 // 포트폴리오 로딩 중 여부
  usdKrw?:     number
}

interface StockConfig {
  ticker:   string
  name:     string
  nameEn:   string
  market:   'US' | 'KR'
  currency: 'USD' | 'KRW'
  emoji:    string
}

// ────────────────────────────────────────────────────────────────
// ✅ 제1원칙: 하드코딩 종목 목록 완전 제거
// 종목 목록은 investments props 에서 동적으로 파생됩니다.
// ────────────────────────────────────────────────────────────────

// 마켓별 기본 이모지 (특정 종목 의존 없음)
function getDefaultEmoji(market: string, currency: string): string {
  if (market === 'CRYPTO') return '🪙'
  if (currency === 'KRW')  return '🇰🇷'
  return '📈'
}

// ────────────────────────────────────────────────────────────────
// 마일스톤 (배수 기준)
// ────────────────────────────────────────────────────────────────
const MILESTONES = [
  // ⚠️ 1배(원금)은 '본전' 눈금이다 — 파랑을 쓰면 손실 막대(blue400)와 뜻이 겹친다 → 중립 회색
  { label: '1배(원금)', sublabel: '±0%',   pct: 0,   barPos: 10, color: TK.sub3 },
  { label: '2배(2루타)', sublabel: '+100%', pct: 100, barPos: 35, color: TK.emerald400 },
  { label: '5배(홈런)',  sublabel: '+400%', pct: 400, barPos: 63, color: TK.orange400 },
  { label: '10배🏆',    sublabel: '+900%', pct: 900, barPos: 90, color: TK.amber400 },
]

// ────────────────────────────────────────────────────────────────
// 유틸 함수
// ────────────────────────────────────────────────────────────────
function getBarPosition(returnPct: number): number {
  if (returnPct < 0)   return Math.max(0, 10 + (Math.max(returnPct, -100) / 100) * 10)
  if (returnPct < 100) return 10 + (returnPct / 100) * 25
  if (returnPct < 400) return 35 + ((returnPct - 100) / 300) * 28
  if (returnPct < 900) return 63 + ((returnPct - 400) / 500) * 27
  return Math.min(100, 90 + ((returnPct - 900) / 500) * 10)
}

/**
 * 막대 색 = **내 보유 손익의 부호**(한국식: 빨강=플러스 · 파랑=마이너스).
 *
 * ⚠️ 2026-09-06 수정: 예전엔 색 하나로 부호와 '몇 루타냐'를 동시에 말하려 했다
 *    (`<0 red500 / <100 blue400 / <400 emerald400 …`). 그래서 같은 대시보드에서
 *    **-47.5% 가 KPI 카드에선 파랑, 이 카드에선 빨강**으로 나왔다(앱 반복 함정:
 *    "컴포넌트 하나만 미국식이면 바로 옆 표와 정반대로 읽힌다").
 *    단계(1루·2루·홈런·10배)는 **막대 위치 + 마일스톤 눈금 + 이모지·문구**가 이미 말하므로
 *    색까지 겸할 필요가 없다. 한 채널에 한 뜻.
 */
function getBarColor(returnPct: number): string {
  return returnPct < 0 ? TK.blue400 : TK.red400
}

/** 원금 회복에 필요한 상승률 — -50%는 +50%가 아니라 +100%가 있어야 돌아온다 */
function recoveryPct(returnPct: number): number {
  const loss = -returnPct                      // 0 < loss < 100
  return loss >= 100 ? Infinity : (loss / (100 - loss)) * 100
}

function getLynchMessage(returnPct: number): { text: string; color: string } {
  // 🎨 색은 **부호**만 말한다(한국식: 빨강=플러스·파랑=마이너스). 단계·심각도는 이모지와 문장이 말한다.
  //    예전엔 손실이 red400(미국식)이고 수익이 blue→emerald→orange 로 올라가, 한 채널이 부호와 단계를
  //    동시에 말하려다 같은 화면 KPI 와 정반대가 됐다. 10배만 금색(amber)을 남긴다 — 축하 배지라서다.
  // ⚠️ 예전엔 음수 전체가 한 버킷이라 -0.1% 와 -48% 가 똑같이 "펀더멘탈을 믿고 버텨라"를
  //    받았다. 같은 화면의 급락 경보와 정면으로 모순됐다. 손실 깊이에 따라 나누고,
  //    위로 대신 '회복에 필요한 상승률'이라는 사실을 보여준다.
  if (returnPct < -50) return { color: TK.blue400,
    text: `🩹 반토막 구간 — 원금 회복에 +${recoveryPct(returnPct).toFixed(0)}%가 필요합니다. 추가 매수 전에 매수 근거가 아직 살아 있는지부터 확인하세요.` }
  if (returnPct < -25) return { color: TK.blue400,
    text: `🧭 조정이 깊습니다 — 원금 회복에 +${recoveryPct(returnPct).toFixed(0)}%가 필요합니다. 주가가 아니라 실적·점유율이 꺾였는지를 보세요.` }
  if (returnPct < -10) return { color: TK.blue400,
    text: '📉 조정 구간 — 살 때의 이유가 그대로인지 점검할 시점입니다. 이유가 살아 있으면 흔들림은 소음입니다.' }
  if (returnPct < -0.5) return { color: TK.sub2,
    text: '⚾ 흔한 등락 폭입니다. 좋은 공을 기다리는 타자의 심정으로 기다리세요.' }
  // ±0.5% 는 사실상 본전 — 여기에 "1루 진출 성공"을 붙이면 성과를 과장하게 된다
  if (returnPct <= 0.5) return { color: TK.sub2,
    text: '⚾ 아직 본전 구간입니다. 타석에 들어섰을 뿐, 성과를 논하기엔 이릅니다.' }
  if (returnPct < 100) return { color: TK.red400, text: '🏃‍♂️ 1루 진출 성공! 주가 흔들림에 털리지 말고 2루타를 향해 전진하세요.' }
  if (returnPct < 400) return { color: TK.red400, text: '🥈 대형 안타 작렬! 이미 원금은 확보되었습니다. 복리의 마법이 시작됩니다.' }
  if (returnPct < 900) return { color: TK.red400, text: '🔥 홈런성 타구! 텐배거가 눈앞에 보입니다. 절대 중간에 내리지 마세요.' }
  return { color: TK.amber400, text: '🏆 텐배거 달성! 피터 린치조차 감탄할 위대한 10루타의 주역이 되셨습니다!' }
}

function fmtPrice(v: number, currency: string): string {
  if (currency === 'KRW') return '₩' + Math.round(v).toLocaleString('ko-KR')
  if (currency === 'JPY')  return '¥' + Math.round(v).toLocaleString('ja-JP')
  if (currency === 'EUR')  return '€' + v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ────────────────────────────────────────────────────────────────
// 진행 바 컴포넌트
// ────────────────────────────────────────────────────────────────
function ProgressBar({
  returnPct, barPos, barColor, isTenbagger,
}: {
  returnPct:   number
  barPos:      number
  barColor:    string
  isTenbagger: boolean
}) {
  return (
    <div className="select-none">
      {/* 마일스톤 레이블 */}
      <div className="relative h-[22px] mb-1">
        {MILESTONES.map(m => {
          const reached = returnPct >= m.pct
          return (
            <div key={m.pct} className="absolute top-0 flex flex-col items-center"
              style={{ left: `${m.barPos}%`, transform: 'translateX(-50%)' }}>
              <span className="text-[8.5px] font-bold leading-tight whitespace-nowrap transition-colors duration-500"
                style={{ color: reached ? m.color : '#6a7f96' }}>
                {m.label}
              </span>
              <span className="text-[7px] leading-tight whitespace-nowrap"
                style={{ color: reached ? `${m.color}99` : '#5a7088' }}>
                {m.sublabel}
              </span>
            </div>
          )
        })}
      </div>

      {/* 바 트랙 (단일 positioning context) */}
      <div className="relative" style={{ height: 20 }}>
        {/* 레일 */}
        <div className="absolute rounded-full"
          style={{ left:0, right:0, top:'50%', height:12, transform:'translateY(-50%)', background:'rgba(20,30,48,1)', border:'1px solid rgba(30,45,65,1)' }}
        />
        {/* 진행 채우기 */}
        <div className="absolute rounded-full transition-all duration-700 ease-out"
          style={{
            left:0, top:'50%', height:12, transform:'translateY(-50%)',
            width: `${Math.max(0.5, barPos)}%`,
            // ⚠️ 음수 분기가 barColor 를 건너뛰고 빨강을 직접 그리고 있었다 — 한국식(손실=파랑)과 정반대.
            //    이제 양쪽 다 barColor(부호 색)를 쓴다.
            background: returnPct < 0
              ? `linear-gradient(90deg,${barColor}40 0%,${barColor}b3 100%)`
              : `linear-gradient(90deg,#0f1e30 0%,${barColor}cc 100%)`,
            boxShadow: returnPct >= 0 ? `0 0 10px ${barColor}50` : 'none',
          }}
        />
        {/* 눈금선 */}
        {MILESTONES.map(m => (
          <div key={m.pct} className="absolute transition-colors duration-500"
            style={{
              left:`${m.barPos}%`, top:'50%', height:14, width:1.5,
              transform:'translateY(-50%)', borderRadius:1,
              background: returnPct >= m.pct ? `${m.color}90` : 'rgba(40,60,85,0.8)',
            }}
          />
        ))}
        {/* 야구공 인디케이터 */}
        <div className="absolute z-10 transition-all duration-700 ease-out"
          style={{
            left:`${Math.max(2, Math.min(98, barPos))}%`,
            top:'50%', transform:'translate(-50%,-50%)',
            width:20, height:20, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: isTenbagger ? 11 : 9,
            background: isTenbagger
              ? `radial-gradient(circle at 35% 35%,#fde68a,${TK.amber500})`
              : `radial-gradient(circle at 35% 35%,white 0%,${barColor} 100%)`,
            border:`2px solid ${isTenbagger ? TK.amber500 : barColor}`,
            boxShadow:`0 2px 8px ${barColor}90,0 0 0 2px rgba(0,0,0,0.5)`,
          }}
        >
          {isTenbagger ? '🏆' : '⚾'}
        </div>
      </div>

      {/* 마일스톤 달성 점 */}
      <div className="relative" style={{ height:10, marginTop:3 }}>
        {MILESTONES.map(m => (
          <div key={m.pct} className="absolute transition-all duration-500"
            style={{
              left:`${m.barPos}%`, top:2, transform:'translateX(-50%)',
              width:6, height:6, borderRadius:'50%',
              background: returnPct >= m.pct ? m.color : '#1a2535',
              border:`1.5px solid ${returnPct >= m.pct ? m.color : '#8899aa'}`,
              boxShadow: returnPct >= m.pct ? `0 0 7px ${m.color}90` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 개별 종목 카드
// ────────────────────────────────────────────────────────────────
function StockCard({
  stock, basePrice, currentPrice, isRegistered,
}: {
  stock:        StockConfig
  basePrice:    number | null   // null = 포트폴리오 미등록
  currentPrice: number | null
  isRegistered: boolean
}) {
  const hasData     = isRegistered && basePrice !== null && basePrice > 0
  const hasPrice    = hasData && currentPrice !== null && currentPrice > 0
  const returnPct   = hasPrice ? ((currentPrice! - basePrice!) / basePrice!) * 100 : 0
  const barPos      = hasPrice ? getBarPosition(returnPct) : 0
  const barColor    = hasPrice ? getBarColor(returnPct) : TK.border
  const message     = hasPrice ? getLynchMessage(returnPct) : null
  const isWin       = returnPct >= 0
  const isTenbagger = returnPct >= 900
  const reachedCount = MILESTONES.filter(m => returnPct >= m.pct).length

  return (
    <div className="relative flex flex-col gap-3 rounded-xl p-4 transition-all duration-300"
      style={{
        background: isTenbagger
          ? 'linear-gradient(135deg,rgba(251,191,36,0.10) 0%,rgba(251,146,60,0.07) 100%)'
          : 'rgba(10,16,28,0.95)',
        border: isTenbagger
          ? '1px solid rgba(251,191,36,0.45)'
          : '1px solid rgba(25,38,58,1)',
        boxShadow: isTenbagger
          ? '0 0 28px rgba(251,191,36,0.12),inset 0 1px 0 rgba(251,191,36,0.08)'
          : '0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      {/* 텐배거 광배 */}
      {isTenbagger && (
        <div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background:'radial-gradient(ellipse at top,rgba(251,191,36,0.07) 0%,transparent 70%)' }}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{stock.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold leading-tight" style={{ color:TK.slate200 }}>
                {stock.name}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background:'rgba(96,165,250,0.12)', color:TK.blue400 }}>
                {stock.ticker}
              </span>
              {/* 포트폴리오 상태 배지 */}
              {!isRegistered ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background:'rgba(51,65,85,0.6)', color:TK.sub3, border:'1px solid rgba(51,65,85,0.8)' }}>
                  포트폴리오 미등록
                </span>
              ) : isTenbagger ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background:'rgba(251,191,36,0.18)', color:TK.amber400, border:'1px solid rgba(251,191,36,0.4)' }}>
                  🏆 10배 달성!
                </span>
              ) : null}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color:TK.sub6 }}>
              {stock.nameEn} · {stock.market}
            </div>
          </div>
        </div>

        {/* 마일스톤 달성 점 4개 */}
        {isRegistered && (
          <div className="flex gap-1.5 items-center flex-shrink-0 mt-0.5">
            {MILESTONES.map((m, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all duration-500"
                style={{
                  background: reachedCount > i ? m.color : '#1a2535',
                  border:`1px solid ${reachedCount > i ? m.color : '#8899aa'}`,
                  boxShadow: reachedCount > i ? `0 0 5px ${m.color}70` : 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 가격 정보 */}
      {isRegistered ? (
        <div className="grid grid-cols-2 gap-2">
          {/* 포트폴리오 평단가 (자동 연동) */}
          <div className="flex flex-col gap-1 rounded-lg px-3 py-2"
            style={{ background:'rgba(10,18,32,0.8)', border:'1px solid rgba(25,38,58,1)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color:TK.sub6 }}>포트폴리오 평단가</span>
              <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background:'rgba(52,211,153,0.10)', color:TK.emerald400 }}>
                AUTO
              </span>
            </div>
            <span className="text-sm font-mono font-bold" style={{ color:TK.sub2 }}>
              {basePrice ? fmtPrice(basePrice, stock.currency) : '—'}
            </span>
          </div>

          {/* 현재가 + 수익률 */}
          <div className="flex flex-col gap-1 rounded-lg px-3 py-2 transition-colors duration-300"
            style={{
              // 카드 틴트도 한국식 — 수익 빨강 / 손실 파랑(예전엔 초록/빨강 미국식이었다)
              background: hasPrice ? (isWin ? `${TK.red400}0d` : `${TK.blue400}0d`) : 'rgba(10,18,32,0.8)',
              border: hasPrice ? (isWin ? `1px solid ${TK.red400}2e` : `1px solid ${TK.blue400}2e`) : '1px solid rgba(25,38,58,1)',
            }}>
            <span className="text-[10px] font-medium" style={{ color:TK.sub6 }}>현재가 / 수익률</span>
            {hasPrice ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm font-mono font-bold" style={{ color:TK.slate200 }}>
                  {fmtPrice(currentPrice!, stock.currency)}
                </span>
                <span className="text-xs font-mono font-bold"
                  style={{ color: isWin ? TK.red400 : TK.blue400 }}>   {/* 내 손익 — 한국식 */}
                  {isWin ? '+' : ''}{returnPct.toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-xs animate-pulse" style={{ color:TK.border }}>로딩 중…</span>
            )}
          </div>
        </div>
      ) : (
        /* 미등록 종목 안내 */
        <div className="rounded-lg px-3 py-3 text-[11px] leading-relaxed"
          style={{ background:'rgba(15,20,35,0.6)', border:'1px solid rgba(25,38,58,1)', color:TK.sub6 }}>
          자산관리 탭에서 이 종목을 포트폴리오에 추가하면<br />
          실시간 텐배거 진행도가 자동으로 계산됩니다.
        </div>
      )}

      {/* 게이지 (등록 종목만) */}
      {isRegistered && (
        <ProgressBar
          returnPct={returnPct}
          barPos={barPos}
          barColor={barColor}
          isTenbagger={isTenbagger}
        />
      )}

      {/* 린치 격려 메시지 (등록 + 현재가 있는 종목만) */}
      {isRegistered && message && (
        <div className="rounded-lg px-3 py-2 text-[11px] leading-relaxed"
          style={{
            background:`${barColor}0c`,
            border:`1px solid ${barColor}20`,
            color: message.color,
          }}>
          {message.text}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 카드 스켈레톤
// ────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background:'rgba(10,16,28,0.95)', border:'1px solid rgba(25,38,58,1)' }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg" style={{ background:TK.bg10, animation:'pulse 1.5s infinite' }} />
        <div style={{ flex:1 }}>
          <div className="h-3 w-32 rounded mb-1.5" style={{ background:TK.bg10, animation:'pulse 1.5s infinite' }} />
          <div className="h-2.5 w-20 rounded" style={{ background:'#141c28', animation:'pulse 1.5s infinite' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0,1].map(i => (
          <div key={i} className="rounded-lg px-3 py-2 h-14"
            style={{ background:'rgba(10,18,32,0.8)', border:'1px solid rgba(25,38,58,1)', animation:'pulse 1.5s infinite' }} />
        ))}
      </div>
      <div className="h-14 rounded-lg" style={{ background:'rgba(15,20,35,0.6)', animation:'pulse 1.5s infinite' }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────
export default function TenbaggerRadar({ priceMap, investments, loading }: TenbaggerRadarProps) {
  // ✅ 제1원칙 준수: investments 배열에서 동적으로 종목 목록 생성 (하드코딩 없음)
  const stocks: StockConfig[] = investments.map(inv => ({
    ticker:   inv.ticker,
    name:     inv.name ?? inv.ticker,
    nameEn:   inv.ticker,
    market:   (inv.market ?? 'US') as 'US' | 'KR',
    currency: (inv.currency ?? 'USD') as 'USD' | 'KRW',
    emoji:    getDefaultEmoji(inv.market ?? 'US', inv.currency ?? 'USD'),
  }))

  // 요약 KPI (동적 종목 목록 기준)
  const tenbaggers = stocks.filter(s => {
    const bp = s.ticker ? investments.find(i => i.ticker === s.ticker)?.purchase_price : undefined
    const cp = priceMap[s.ticker.toUpperCase()]?.currentPrice
    if (!bp || !cp) return false
    return ((cp - bp) / bp) * 100 >= 900
  }).length
  const winners = stocks.filter(s => {
    const bp = investments.find(i => i.ticker === s.ticker)?.purchase_price
    const cp = priceMap[s.ticker.toUpperCase()]?.currentPrice
    if (!bp || !cp) return false
    return cp >= bp
  }).length
  const returnRates = stocks.map(s => {
    const bp = investments.find(i => i.ticker === s.ticker)?.purchase_price
    const cp = priceMap[s.ticker.toUpperCase()]?.currentPrice
    if (!bp || !cp) return null
    return ((cp - bp) / bp) * 100
  }).filter((r): r is number => r !== null)
  const avgRet = returnRates.length
    ? returnRates.reduce((a,b) => a+b, 0) / returnRates.length
    : 0

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background:'#060b13', border:'1px solid rgba(20,32,52,1)' }}>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom:'1px solid rgba(18,28,46,1)', background:'rgba(8,14,24,0.9)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background:'rgba(251,191,36,0.10)', border:'1px solid rgba(251,191,36,0.2)', fontSize:18 }}>
            🏆
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color:TK.slate200 }}>
              피터 린치 텐배거 마일스톤 트래커
            </div>
            <div className="text-[11px] mt-0.5" style={{ color:TK.sub6 }}>
              포트폴리오 평단가 자동 연동 · 전체 보유 종목 10배 달성 진행도
            </div>
          </div>
        </div>

        {/* 요약 KPI */}
        {!loading && (
          <div className="hidden sm:flex items-center gap-5">
            {[
              { label: '보유 종목',   val: `${stocks.length}개`,            color: TK.blue400 },
              { label: '수익 종목',   val: `${winners} / ${stocks.length}`, color: TK.emerald400 },
              { label: '텐배거 달성',     val: `${tenbaggers}건`,            color: TK.amber400 },
              { label: '평균 수익률',     val: `${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(1)}%`,
                color: avgRet >= 0 ? TK.red400 : TK.blue400 },   /* 평균 수익률 — 한국식 */
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className="text-base font-mono font-bold leading-none" style={{ color:item.color }}>
                  {item.val}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color:'#8899aa' }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 마일스톤 범례 */}
      <div className="flex items-center gap-3 px-5 py-2 flex-wrap"
        style={{ borderBottom:'1px solid rgba(15,25,42,1)', background:'rgba(6,10,18,0.6)' }}>
        <span className="text-[10px] font-bold tracking-widest" style={{ color:'#8a9db5' }}>MILESTONE</span>
        {MILESTONES.map((m, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background:m.color, boxShadow:`0 0 5px ${m.color}50` }} />
            <span className="text-[10px] font-mono font-semibold" style={{ color:m.color }}>{m.label}</span>
            {i < MILESTONES.length - 1 && <span className="text-[10px]" style={{ color:'#6a7f96' }}>›</span>}
          </div>
        ))}
        <div className="ml-auto text-[10px] flex items-center gap-1.5" style={{ color:'#8a9db5' }}>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background:'rgba(52,211,153,0.10)', color:TK.emerald400 }}>AUTO</span>
          포트폴리오 평단가 자동 연동
        </div>
      </div>

      {/* 종목 카드 그리드 — investments 완전 동적 */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          : stocks.length === 0
          ? (
            <div className="col-span-3 py-12 text-center text-sm" style={{ color: TK.sub6 }}>
              자산관리 탭에서 종목을 추가하면 텐배거 진행도가 표시됩니다.
            </div>
          )
          : stocks.map(stock => {
              const inv = investments.find(i => i.ticker === stock.ticker)
              const bp  = inv?.purchase_price ?? null
              const cp  = priceMap[stock.ticker.toUpperCase()]?.currentPrice ?? null
              return (
                <StockCard
                  key={stock.ticker}
                  stock={stock}
                  basePrice={bp}
                  currentPrice={cp}
                  isRegistered={bp !== null}
                />
              )
            })
        }
      </div>

      {/* 린치 인용구 푸터 */}
      <div className="px-5 py-3 flex items-start gap-2"
        style={{ borderTop:'1px solid rgba(15,25,42,1)', background:'rgba(6,10,18,0.6)' }}>
        <span className="text-base flex-shrink-0">💬</span>
        <p className="text-[11px] leading-relaxed" style={{ color:'#8a9db5' }}>
          <span style={{ color:TK.amber500, fontWeight:700 }}>피터 린치: </span>
          &quot;10배짜리 종목(Tenbagger)은 단 한 개만 있어도 포트폴리오 전체의 실수를 만회하고도 남는다.
          핵심은 성장하는 기업을 포트폴리오에 품고, 주가 등락에 흔들리지 않고 오래 보유하는 것이다.&quot;
        </p>
      </div>
    </div>
  )
}
