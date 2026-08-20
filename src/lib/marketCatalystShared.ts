// 🔥 마켓 카탈리스트 캐시 키 SSOT — writer(market-catalyst route)·reader(weekly-report)가 이것만 쓴다.
//    라우트 파일은 임의 export 가 금지라(Next 라우트 타입 검증) 키 상수는 lib 에 둔다(SECTOR_ROTATION_KEY 패턴).
// v4: 🪙 암호화폐 트래킹 — 뉴스 피드(EN·KO) + 수급 블랙홀 BTC/ETH 등락 + 프롬프트 우선순위(2026-08-20 사용자 요청:
//     BTC +8% 급등일에 '시장의 눈'이 침묵 — 뉴스 쿼리 5종에 암호화폐 키워드가 없었고 트렌딩도 코인 심볼을 걸렀다)
export const MARKET_CATALYST_KEY = (dateKst: string) => `market-catalyst-v4:${dateKst}`
