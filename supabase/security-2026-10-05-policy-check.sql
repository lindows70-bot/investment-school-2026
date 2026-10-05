-- 현재 정책을 '읽기만' 하는 조회문(아무것도 바꾸지 않음) — 이 파일 내용을 통째로 복사해 Supabase SQL Editor 에 붙여 넣고 Run
select schemaname as 구역, tablename as 표, policyname as 정책, cmd as 동작, roles as 대상, qual as 읽기_조건, with_check as 쓰기_조건
  from pg_policies
 where schemaname in ('public', 'storage')
 order by 1, 2, 4, 3;
