// 시장 탭·홈 요약 공개 데이터 — 공포·탐욕 1년(CNN·코인) · 원·달러 환율 추이(하나은행 매매기준율) · 요즘 강한 분야(섹터 로테이션 캐시 읽기만)
//   ⚠️ 환율 추이는 표시용이다 — 앱 환율 SSOT(/api/exchange-rate)는 바꾸지 않는다(4단계).
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { fetchCnnFngYear } from '@/lib/cnnFng'
import { fetchCryptoFngYear } from '@/lib/cryptoFng'
import { fetchFxTrend } from '@/lib/fxTrend'
import { loadStrongSectors } from '@/lib/strongSectors'
import { okPart, failPart } from '@/lib/marketBoardShared'
import { boardCached } from '@/lib/marketBoardCache'

const KEY = 'market-board-overview-v1'   // 🗓️ 날짜 없는 키 — 30분(셋 다 하루 한 번 바뀌는 값)

async function build() {
  const [cnn, crypto, fx, sectors] = await Promise.all([
    fetchCnnFngYear(),
    fetchCryptoFngYear()
      .then(v => v ? okPart(v, v.date, 'alternative.me fng(limit=366)') : failPart<NonNullable<typeof v>>('조회 실패', 'alternative.me fng(limit=366)')),
    fetchFxTrend(),
    loadStrongSectors(5, 2)
      .then(v => v ? okPart(v, v.asOf, 'app_cache sector-rotation(읽기 전용)')
        : failPart<NonNullable<typeof v>>('최근 3일 섹터 로테이션 계산 결과가 없음(여기서 새로 계산하지 않음)', 'app_cache sector-rotation(읽기 전용)'))
      .catch(() => failPart<never>('캐시 조회 실패', 'app_cache sector-rotation(읽기 전용)')),
  ])
  return {
    fng: { cnn, crypto },
    fx,
    strongSectors: sectors,
    notes: {
      strongSectors: '주가 수익률로 잰 섹터 강도(쏠림점수 = 0.6×1달 상대강도 + 0.4×1주 모멘텀)입니다 — 실제 자금 흐름 데이터가 아닙니다. 대표 종목은 그 섹터 종목 중 1주 수익률 상위입니다.',
      fx: '하나은행 매매기준율(네이버 고시) — 앱의 다른 화면 환율(/api/exchange-rate)과 기준이 다를 수 있습니다.',
      cnnYearAgo: 'CNN 1년 전 값은 원천(previous_1_year)이 준 값입니다.',
    },
  }
}

export async function GET() {
  const body = await boardCached(KEY, 30 * 60_000, build)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
