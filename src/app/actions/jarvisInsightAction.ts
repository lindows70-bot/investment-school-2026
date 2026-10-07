'use server'
// 브라우저(종목 상세 JarvisInsight)용 입구 — 로그인·종목 형식·하루 한도를 검사한 뒤 서버 전용 getEarningsInsight 를 부른다(2026-10-05 보안 점검)
import { getEarningsInsight, type JarvisInput, type JarvisInsight } from '@/app/actions/getEarningsInsight'
import { getAuthedUserId } from '@/lib/cronAuth'
import { cleanTicker, cleanName, cleanMarket } from '@/lib/tickerGuard'
import { takeHeavyQuota, HEAVY_DAILY_LIMIT } from '@/lib/heavyQuota'

export async function getEarningsInsightForUser(input: JarvisInput): Promise<JarvisInsight> {
  // 거절도 화면이 이미 그리는 오류 모양으로 돌려준다(던지면 '분석 중 오류'로만 보여 이유를 못 말한다)
  const fail = (message: string): JarvisInsight => ({
    ticker: String(input?.ticker ?? ''), quarter: '', growthStory: '', managementTone: '', guidance: '',
    sentimentScore: 50, headlines: [], cached: false, status: 'error', message, asOf: new Date().toISOString(),
  })
  const uid = await getAuthedUserId()
  if (!uid) return fail('로그인하면 볼 수 있어요.')
  const ticker = cleanTicker(input?.ticker)
  if (!ticker) return fail('종목 코드 형식이 올바르지 않습니다.')
  const mk = String(input?.market ?? 'US').trim().toUpperCase()
  const market = mk === 'CRYPTO' ? 'CRYPTO' : cleanMarket(mk)   // JarvisInput 규약 'US' | 'KR' | 'CRYPTO' 만
  if (!market) return fail('시장 구분이 올바르지 않습니다.')
  if (!(await takeHeavyQuota(uid))) return fail(`오늘 분석 한도(${HEAVY_DAILY_LIMIT}회)를 다 썼어요 — 내일 다시 열 수 있어요.`)
  return getEarningsInsight({ ...input, ticker, market, name: cleanName(input?.name, ticker) })
}
