import { TK } from '@/lib/theme'
// GICS 섹터(Yahoo 표기) → 한글명·아이콘·색상 SSOT — 🏛️GICS 전통 산업 섹터 탭과 동일 아이콘 체계.
// 리밸런싱·퀀트빌더의 추천/탈락 종목에 테마·섹터 구분 배지를 달 때 공용으로 재사용(제2원칙).
export interface SectorMeta { ko: string; icon: string; color: string }

export const GICS_SECTOR_META: Record<string, SectorMeta> = {
  'Energy':                   { ko: '에너지',        icon: '⚡', color: TK.amber500 },
  'Basic Materials':          { ko: '소재',          icon: '🧱', color: TK.violet400 },
  'Industrials':               { ko: '산업재',        icon: '🏗️', color: TK.blue400 },
  'Consumer Cyclical':         { ko: '자유소비재',    icon: '🛒', color: TK.orange400 },
  'Consumer Defensive':        { ko: '필수소비재',    icon: '🥫', color: TK.green400 },
  'Healthcare':                { ko: '헬스케어',      icon: '💊', color: TK.red400 },
  'Financial Services':        { ko: '금융',          icon: '💰', color: '#facc15' },
  'Technology':                { ko: 'IT/기술',       icon: '💻', color: TK.cyan400 },
  'Communication Services':    { ko: '커뮤니케이션',  icon: '📡', color: '#e879f9' },
  'Utilities':                  { ko: '유틸리티',      icon: '🔌', color: TK.emerald400 },
  'Real Estate':                { ko: '부동산',        icon: '🏢', color: TK.slate400 },
}

/** GICS 섹터명(또는 null/미상) → 표시 메타. 매핑 밖 값은 회색 중립 배지로 graceful. */
export function sectorMeta(raw: string | null | undefined): SectorMeta | null {
  // '기타' = getSector()의 조회실패/비주식(크립토 등) 폴백값 — 오분류 배지를 보여주느니 숨기는 게 정직
  if (!raw || raw === '—' || raw === '-' || raw === '기타') return null
  return GICS_SECTOR_META[raw] ?? { ko: raw, icon: '📦', color: TK.sub3 }
}
