// 종목 국기 SSOT — ⚠️ `market: 'US'` 는 국적이 아니라 '한국이 아님' 이다.
// 유럽·일본·중국 종목이 전부 🇺🇸 로 찍히던 사고가 두 번 있었다
// (실적 리포트 상위 50이 전부 일본인데 미국기 · 승패 해부실 케링(FR) US 오표기).
// 국적은 ① 명시된 origin ② 티커 접미사 ③ 6자리 숫자=KR 순으로 결정한다.

/** 야후 티커 접미사 → 국기. 우리 유니버스(EU/JP/CN 확장분)에 실제로 등장하는 것만. */
const SUFFIX_FLAG: Record<string, string> = {
  L: '🇬🇧', TO: '🇨🇦', V: '🇨🇦', AX: '🇦🇺', NZ: '🇳🇿',
  T: '🇯🇵', KS: '🇰🇷', KQ: '🇰🇷', HK: '🇭🇰', SS: '🇨🇳', SZ: '🇨🇳', TW: '🇹🇼', SI: '🇸🇬',
  PA: '🇫🇷', DE: '🇩🇪', F: '🇩🇪', BE: '🇩🇪', MI: '🇮🇹', MC: '🇪🇸', AS: '🇳🇱', BR: '🇧🇪',
  SW: '🇨🇭', VX: '🇨🇭', ST: '🇸🇪', OL: '🇳🇴', CO: '🇩🇰', HE: '🇫🇮', LS: '🇵🇹', VI: '🇦🇹',
  IR: '🇮🇪', SA: '🇧🇷', MX: '🇲🇽',
}

/** origin(있으면) → 티커 접미사 → market 순으로 국기를 정한다. */
export function flagOf(market?: string | null, ticker?: string | null, origin?: string | null): string {
  const o = (origin ?? '').toUpperCase()
  if (o === 'KR') return '🇰🇷'
  if (o === 'JP') return '🇯🇵'
  if (o === 'CN') return '🇨🇳'
  if (o === 'EU') return '🇪🇺'
  if (o === 'US') return '🇺🇸'

  const t = (ticker ?? '').trim().toUpperCase()
  if (t) {
    const dot = t.lastIndexOf('.')
    if (dot > 0) {
      const suf = t.slice(dot + 1)
      if (SUFFIX_FLAG[suf]) return SUFFIX_FLAG[suf]
    }
    if (/^\d{6}$/.test(t) || /^\d{4}[A-Z]\d$/.test(t)) return '🇰🇷'   // 005930 · 0117V0(신형 ETF)
  }

  const m = (market ?? '').toUpperCase()
  if (m === 'KR') return '🇰🇷'
  if (m === 'CRYPTO') return '🪙'
  return '🇺🇸'
}
