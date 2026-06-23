'use client'
// 최일 가치분석 터미널 — 분석 로직은 ChoiValuationPanel(SSOT). 이 페이지는 입력 UI 포함 전체 패널을 그대로 렌더.
//    종목 리서치 🧭 탭은 같은 ChoiValuationPanel을 embedded(ticker 자동조회)로 재사용한다.
import ChoiValuationPanel from '@/app/components/ChoiValuationPanel'

export default function ValuationPage() {
  return <ChoiValuationPanel />
}
