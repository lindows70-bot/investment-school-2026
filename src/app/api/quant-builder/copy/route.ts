// ⚠️ 폐기됨(deprecated) — '내 포트폴리오로 복사하기'가 가상 종목을 실제 investments에 섞어 오염시키던 문제로 제거.
// 대안: 투자 타임머신 탭의 [AI 퀀트 빌더 추천] 토글로 추천안을 DB 기록 없이 백테스트한다. 정리는 /api/quant-builder/cleanup.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({
    error: 'deprecated',
    message: '복사하기는 실제 포트폴리오 오염 방지를 위해 제거되었습니다. 투자 타임머신 탭에서 [AI 퀀트 빌더 추천] 토글로 확인하세요.',
  }, { status: 410 })
}
