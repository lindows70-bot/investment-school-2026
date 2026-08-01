# 실적 리포트 — 컨텍스트 노트 (결정 기록)

## 데이터 실측 판정표
| 소스 | 결과 | 비고 |
|---|---|---|
| SEC `company_tickers.json` | ✅ 10,412종 778KB | 티커→CIK, 무키 |
| SEC `submissions/CIK*.json` | ✅ | `filings.recent.items`에 '2.02' 필터 |
| full submission `{acc}.txt` | ✅ 0.6~1.1MB | 문서 TYPE으로 EX-99.x 추출 |
| 파일명 정규식 `/ex[-_]?99/i` | ❌ 2/3 실패 | NVDA `q1fy27pr.htm`·GOOGL `googexhibit991q22026.htm` |
| 컨콜 Q&A 전문 | ❌ | SEC 부재. Motley Fool·Seeking Alpha 유료·스크랩 리스크 |
| DART 잠정실적 | ⚠️ 숫자 위주 | 삼성전자 2026-07-30 확인. 서술형 IR은 회사 홈페이지 PDF |
| Yahoo `earningsHistory` | ✅ (기존) | beat/miss는 이미 `earnResults`가 담당 — 중복 구현 금지 |

## 채택하지 않은 안과 이유
- **컨콜 전사 스크랩**: 유료·약관 리스크. EX-99.1+99.2로 실적·가이던스·세그먼트는 커버되고, Q&A 없이도 NotebookLM 요약의 핵심에 도달
- **beat/miss 재계산**: `earnResults`(어닝 결과 브리핑)가 이미 `surprisePercent` 제공값을 쓰는 SSOT — 리포트는 그 값을 **읽기만** (제2원칙)
- **티커 하드코딩 리스트**: 시총 상위 50을 큐레이션 상수로 박으면 제1원칙 위반이자 시총 변동에 거짓말이 됨 → `ScreenedStock.marketCap` 노출(이미 계산 중이라 추가 fetch 0)로 동적 선정
- **한국 편입(v1)**: DART 잠정실적은 매출·영업이익 숫자뿐이라 "요약할 서술"이 없음. 억지로 넣으면 미국 리포트와 품질이 갈림
- **Gemini에 숫자 판정 위임**: 서술만. beat/miss·6축·타점은 전부 결정론 SSOT

## 임계값 근거
- **대상 50종**: 사용자 확정. Gemini 무료 한도상 한 번에 50개 요약은 무리 → 크론이 배치(요약 없는 것부터 N개씩)로 며칠에 걸쳐 채움
- **분기 캐시 100일**: 실적은 분기 1회 → accession이 바뀌지 않으면 재수집·재요약 안 함
- **CIK 맵 30일**: 신규 상장 반영 주기로 충분

## 검증에서 발견한 것
- (수집 실측) 4/4 성공 — NVDA는 EX-99.2 CFO Commentary까지 확보(세그먼트·차기 가이던스 포함)
- 핵심어 포함 확인: revenue / net income / diluted / guidance / outlook / gross margin / dividend / data center
- ⚠️ 유니버스에 `marketCap`이 노출돼 있지 않았음(fcfYield 계산엔 쓰면서 필드로는 안 내보냄) → 필드 추가 + `UNIVERSE_KEY` v10→v11
