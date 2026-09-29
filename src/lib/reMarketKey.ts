// 부동산 시장 지표(re-market) 캐시 키 SSOT — writer(re-market 라우트)와 reader(re-apt·저울)가 같은 상수를 쓴다(키를 올릴 때 reader 가 조용히 죽지 않게)
//   v3(2026-09-29): kpi 에 asOfBase·asOfMortgage(기준금리·주담대 기준월) 추가 — 이름표 없는 숫자 금지 · v2: 전세 항목코드 P63AC→P64AC 교정
export const RE_MARKET_KEY = 're-market-v3'
