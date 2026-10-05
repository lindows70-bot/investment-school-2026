-- 현재 RLS·저장소 정책을 '읽기만' 하는 조회문 — Supabase SQL Editor 에서 실행하고 결과를 보안 점검에 넘긴다(아무것도 바꾸지 않음)
-- 왜(2026-10-05 보안 점검): 브라우저가 직접 쓰는 표(strategy_configs·notices·lounge_posts·lounge_comments·investments·transactions·watchlist)와
--   공개 저장소 strategy-pdf 의 쓰기 권한은 정책에만 달려 있는데, 그 정책이 저장소에 SQL 로 남아 있지 않아 코드만으로는 판정할 수 없다.

-- 1) 표마다 RLS 가 켜져 있는가
select c.relname as 표, c.relrowsecurity as rls_켜짐
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by 1;

-- 2) public 스키마 정책 전부(누가 · 무엇을 · 어떤 조건으로)
select tablename as 표, policyname as 정책, cmd as 동작, roles as 대상, qual as 읽기_조건, with_check as 쓰기_조건
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd, policyname;

-- 3) 저장소(파일) 정책 — strategy-pdf 업로드·삭제가 선생님만인가
select policyname as 정책, cmd as 동작, roles as 대상, qual as 조건, with_check as 쓰기_조건
  from pg_policies
 where schemaname = 'storage'
 order by policyname;

-- 4) 저장소 버킷 공개 여부
select id as 버킷, public as 공개 from storage.buckets order by 1;
