# 🔌 킬스위치 체크리스트

- [x] Phase 0 데이터 실측 (판정표는 context-notes)
- [x] `lib/oecdCli.ts` — fetchCli SSOT + 키 상수(v1→v2), `cliNextPrev`·기준월 추가
- [x] reader 3곳 교체 — `regionSeason`·`portfolio-flow`·`season-navigator`
- [x] `lib/killSwitch.ts` — 순수 함수, 임계값은 `seasonNavigator` 판정식에서 역산
- [x] `api/season-navigator` — `killSwitch` 필드 + 캐시 v11→v12
- [x] `TYPICAL_LAG.oecdCli` 등록 (실측 2개월)
- [x] 컴포넌트 — 4계절 축 진단 아래 + 물가축 AND 게이트 경고
- [x] 독립 재계산 검증 — `scripts/verify-kill-switch.mjs` 15건 전부 통과
- [x] `npm run check:build` → 커밋 → 배포 → 프로덕션 확인
      - `season-sector` = `inflation`(☀️ 여름) — 검증 스크립트 판정과 일치
      - `app_cache` v2 8개 지역 전부 기록, **v1과 cli·cliPrev 가 소수점 12자리까지 동일**(판정 무변화 확인)
- [x] `docs/history/2026-08.md` 기록
- [x] 화면 렌더 확인 — 사용자 스크린샷 + 로그인된 Chrome 으로 직접 확인
      - 킬스위치 표·게이트 경고·3개 결과 카드·제외 사유 전부 정상
      - 4계절 카드 우측 하단 `국면 SSOT: 금리 고점·인상 경계` 로 교정 반영 확인
- [x] 화면검증에서 추가로 잡은 것 2건 (아래 '남은 것' 위 항목들 참조)

## 검증 스크립트 (수동 실행 — 판정식·라벨을 건드릴 때 돌린다)
```
node scripts/verify-kill-switch.mjs        # 18건 — 임계값이 판정식과 같은가 + 행이 혼자 읽어도 참인가
node scripts/verify-season-regression.mjs  # 19건 — CLI SSOT 교체가 다운스트림 판정을 바꿨는가
node scripts/verify-regime-label.mjs       # 5건(96조합) — 라벨이 금리 방향을 부정하는가
```
※ `NODE_PATH=<프로젝트>/node_modules` 필요(lib 단위검증 레시피).

## 남은 것 (이번 기능 범위 밖 — 사용자 판단 대기)
- [ ] 🧹 `oecd-cli-*-v1` 8행 — reader 가 없어 방치 상태(무해). 지우려면 사용자 확인 후
- [ ] 🤖 검증 3종을 야간 감사(`scripts/nightly-audit.mjs`)에 편입할지 — 지금은 수동
- [ ] 💬 매크로 허브 금리 카드 문구(`동결~소폭 인상 기대`) — 라벨과 **모순은 아니고** 표현만 다름. 손대지 않음
