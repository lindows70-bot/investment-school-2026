-- 로그인 안 한 외부인에게 열려 있던 두 저장소를 '로그인 사용자만 읽기'로 좁히는 SQL — Supabase SQL Editor 에서 한 번 실행
-- 왜(2026-10-05 보안 점검): 두 표의 읽기 정책이 `using (true)` 에 대상(to authenticated)이 빠져 있어
--   공개 anon 키만으로 외부인이 읽을 수 있었다(실측: earnings_insights 72행 · insider_signals 236행).
--   주석의 원래 의도는 "로그인한 모든 학생이 읽을 수 있음"이었다. 내용은 공개 시장 정보지만,
--   어떤 종목을 분석했는지(= 학생 보유와 겹치는 종목 목록)가 드러난다.
-- 앱 영향 없음: 두 표는 서버 액션(getEarningsInsight·getInsiderSignal)이 서비스 키로만 읽고 쓴다(RLS 우회).

drop policy if exists "earnings_insights_read" on public.earnings_insights;
create policy "earnings_insights_read"
  on public.earnings_insights for select
  to authenticated
  using (true);

drop policy if exists "insider_signals_read" on public.insider_signals;
create policy "insider_signals_read"
  on public.insider_signals for select
  to authenticated
  using (true);

-- 확인: 두 정책의 대상이 authenticated 인지
select tablename, policyname, roles from pg_policies
 where tablename in ('earnings_insights', 'insider_signals');
