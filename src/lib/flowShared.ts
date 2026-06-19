// 수급 판정 공용 로직 — 서버/클라이언트 양쪽이 같은 기준을 쓰도록 분리(서버 의존성 0)
import type { FlowStatus } from '@/lib/moneyFlow'

// '유입·임박' 단일 판정(SSOT) — 확정 유입(INFLOW) 또는 모멘텀 임박(≥40). 단, 이탈·과열(CROWDED)은
//  경보가 우선이라 제외(과열 종목이 MFI·거인 점수로 momentum이 높아 '유입'으로도 잡히던 이중계상 버그 차단)
export const isInflowNear = (e: { status: FlowStatus; momentum: number }) =>
  e.status !== 'CROWDED' && (e.status === 'INFLOW' || e.momentum >= 40)
