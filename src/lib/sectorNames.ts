// GICS 11개 업종의 한국어 이름 — 브라우저에서도 쓸 수 있는 순수 표(서버 모듈 import 없음)
//   ⚠️ 같은 뜻의 표가 이미 etfAlternative(GICS_SECTOR_ETF.ko)·season-sector(US_ETF.ko)·CorrelationMatrix·QuantBuilderLab 에 흩어져 있다.
//      etfAlternative 는 서버 전용 모듈(appCache)을 끌어와 학생 화면에서 못 쓴다 — 새 코드는 여기서 가져가고, 기존 표는 그 화면을 손볼 때 이리 옮긴다.
//      이름은 etfAlternative·season-sector 와 같게 맞췄다(자유소비재·필수소비재·커뮤니케이션).
export const GICS_KO: Record<string, string> = {
  'Energy': '에너지', 'Basic Materials': '소재', 'Industrials': '산업재',
  'Consumer Cyclical': '자유소비재', 'Consumer Defensive': '필수소비재', 'Healthcare': '헬스케어',
  'Financial Services': '금융', 'Technology': '기술', 'Communication Services': '커뮤니케이션',
  'Utilities': '유틸리티', 'Real Estate': '부동산',
}
/** GICS 영어 이름 → 한국어. 표에 없으면 원문 그대로(지어내지 않는다) */
export const sectorKo = (s: string | null | undefined): string | null => (s ? GICS_KO[s] ?? s : null)
