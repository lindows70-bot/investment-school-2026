# 📄 종목 리서치 리포트 — Anthropic 금융 에이전트式 (3기능 통합)

## 목표
Anthropic 'financial-services' 플러그인의 미국 주식 분석 데모(영상)에서 꼽힌 3기능 —
**① Sector Overview ② Earnings Analysis ③ Morning Note(액션)** — 을 **한 종목에 대한 한 편의
리서치 리포트**로 통합. 학생이 종목 검색 후 리포트를 화면으로 보고, **버튼으로 PDF 다운로드**.

## 원칙
- ⛔ **점수·판정은 기존 SSOT 그대로** — 새 판정기 0. 리포트는 **합성·표현 레이어**만.
- 앱 철학: 무료 데이터(Yahoo·Naver·FRED·DART)·독자 구현. 유료 커넥터·Excel/PPT 미채택 → 화면 리포트 + 인쇄/PDF.
- 서술=Gemini(Jarvis 방식, 환각 가드: 넘겨준 수치 밖 창작 금지). 데이터=결정론.

## 3 섹션 (전부 기존 SSOT 재사용)
| 섹션 | 재사용 소스 | 내용 |
|---|---|---|
| ① 섹터 오버뷰 | sector-rotation 캐시(종목 GICS 섹터 국면) + season(계절 적합) + canonical(섹터) | "이 종목 섹터는 지금 [국면], 계절 [적합/불리]" 합성 |
| ② 어닝 애널리시스 | getEarningsInsight(Jarvis 어닝콜) + getAnalystSignal(추정 리비전) | 최근 실적 3섹션 + EPS 리비전 방향 + 다음 어닝 |
| ③ 액션(모닝노트) | research-verdict(verdict·6축·pros/cons·oneLiner·타점) | "그래서 지금: 매수적합/신중/부적합 + 타점" |
| 총평 | 위 셋 종합 | Gemini 2~3문장 executive summary(수치 근거) |

## 구현
- **`/api/research-report?ticker=&market=`**(공개·개별주식 가드·`research-report-v1:TICKER:MKT:DATE` 6h):
  research-verdict + getEarningsInsight + getAnalystSignal + sector-rotation 병렬 → Gemini 총평·섹터 서술 →
  `{ ticker, name, sector, generatedAt, summary, sector:{phase,label,narrative}, earnings:{insight,revision,narrative}, action:{verdict,score,oneLiner,pros,cons,timing} }`.
- **`ResearchReport.tsx`**: 리서치 페이지 신규 탭 `📄 리서치 리포트`. 3섹션 문서 레이아웃 + **🖨️ PDF 다운로드** 버튼.
- **PDF**: 의존성 0 — `printReport()`가 새 창에 인쇄용 HTML(앱 크롬 제거·문서 스타일) 생성 후 `window.print()` → 브라우저 "PDF로 저장".

## 검증
- 미국주(NVDA 등)·한국주(삼성전자 등)·비주식(ETF 가드) · 각 섹션 데이터 정합(research-verdict·어닝콜과 동일값) · PDF 인쇄 레이아웃 · npm run check → 배포.
