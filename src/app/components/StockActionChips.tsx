'use client'
// 🔗 종목 액션 칩 SSOT — "이 종목을 봤다 → 그래서 뭘 하지?"에 어느 화면에서든 같은 답을 준다.
//
// ⚠️ 왜 만들었나(2026-08-08 전수 조사): 추천을 내는 세 표면(브리핑 ③담을 것·통합추천·추천 지도)이
//    6축 점수·권장 편입액·매매 플랜까지 다 보여주면서 **종목 단위 링크가 0건**이었다. 리서치 화면은
//    종합 매수 판정까지 내고도 나가는 링크가 없는 종착역이었고, 관심종목에서 보유로 옮기는 버튼도
//    없어 두 목록이 분리된 세계였다. 결과적으로 "추천을 봤다 → 샀다 → 등록했다"가 학생의 수동
//    타이핑에만 의존했다. 화면 하나하나는 깊은데 화면 사이의 다리가 없던 것.
//
// 이미 잘 하고 있던 곳(hi52-radar·tech-screener)의 칩 패턴을 그대로 추출했다 — 신규 발명 0.
// ⛔ 자동매매 금지: 어떤 칩도 주문을 내지 않는다. '보유 등록'은 이미 산 것을 기록하는 화면으로
//    보내는 링크일 뿐이고, 수량·단가는 학생이 직접 입력한다.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD } from '@/lib/theme'

export type ChipKind = 'research' | 'chart' | 'watch' | 'hold'

const CHIP_BASE: React.CSSProperties = {
  fontSize: FS.micro, fontWeight: 700, textDecoration: 'none',
  borderRadius: RAD.xs, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3,
  lineHeight: 1.5, whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid',
}
const tone = (c: string) => ({ color: c, background: `${c}18`, borderColor: `${c}44` })

/** 종목 액션 칩. 기본은 4종 전부 — `only` 로 필요한 것만 고른다(좁은 카드는 ['research','chart']). */
export default function StockActionChips({
  ticker, name, market, only, compact = false,
}: {
  ticker: string
  name?: string | null
  market?: string | null           // 'KR' | 'US' | 'CRYPTO' — 없으면 티커로 추정
  only?: ChipKind[]
  compact?: boolean                // 아이콘만(라벨 생략) — 행이 좁을 때
}) {
  // 시장 추정: 6자리 숫자 = KR(assetClassifier 와 같은 관례). 명시값이 있으면 그것을 신뢰한다.
  const mkt = market === 'KR' || market === 'US' || market === 'CRYPTO'
    ? market : (/^\d{6}$/.test(ticker) ? 'KR' : 'US')
  const show = (k: ChipKind) => !only || only.includes(k)

  const [wl, setWl] = useState<'idle' | 'saving' | 'done'>('idle')
  const [inWl, setInWl] = useState(false)

  // 이미 관심종목이면 '담김'으로 — 같은 종목을 두 번 담게 하지 않는다(upsert라 사고는 안 나지만 혼란스럽다)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session?.user) return
        const { data } = await sb.from('watchlist').select('ticker').eq('user_id', session.user.id).eq('ticker', ticker).maybeSingle()
        if (alive && data) setInWl(true)
      } catch { /* 비로그인·조회 실패 — 칩은 그대로 두고 클릭 시 처리 */ }
    })()
    return () => { alive = false }
  }, [ticker])

  const addWatch = async () => {
    if (wl !== 'idle' || inWl) return
    setWl('saving')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.user) { window.location.href = '/login'; return }
      const { error } = await sb.from('watchlist')
        .upsert({ user_id: session.user.id, ticker, name: name ?? ticker, market: mkt }, { onConflict: 'user_id,ticker' })
      setWl(error ? 'idle' : 'done')
      if (!error) setInWl(true)
    } catch { setWl('idle') }
  }

  const label = (icon: string, text: string) => compact ? icon : `${icon} ${text}`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {show('research') && (
        <a href={`/research?q=${encodeURIComponent(ticker)}`} style={{ ...CHIP_BASE, ...tone(TK.amber400) }}
          title="종합 매수 판정·거장 위원회·해자까지 이 종목의 근거 전부">
          {label('🎯', '종합 판정')}
        </a>
      )}
      {show('chart') && (
        <a href={`/tech-chart?ticker=${encodeURIComponent(ticker)}&market=${mkt}`} style={{ ...CHIP_BASE, ...tone(TK.violet300) }}
          title="캔들·이평·구름으로 지금 자리 확인">
          {label('📉', '차트')}
        </a>
      )}
      {show('watch') && (
        <button onClick={addWatch} disabled={inWl || wl === 'saving'} style={{
          ...CHIP_BASE, ...tone(inWl || wl === 'done' ? TK.green400 : TK.blue400),
          opacity: wl === 'saving' ? 0.6 : 1,
        }} title={inWl ? '이미 관심종목에 있습니다' : '관심종목에 담아두고 지켜보기(매수 아님)'}>
          {inWl || wl === 'done' ? label('⭐', '담김') : wl === 'saving' ? label('⭐', '담는 중') : label('⭐', '관심')}
        </button>
      )}
      {show('hold') && (
        <a href={`/assets?add=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name ?? '')}&market=${mkt}`}
          style={{ ...CHIP_BASE, ...tone(TK.slate300) }}
          title="이미 매수했다면 보유 종목으로 기록(수량·단가는 직접 입력 — 주문 기능 아님)">
          {label('➕', '보유 등록')}
        </a>
      )}
    </span>
  )
}
