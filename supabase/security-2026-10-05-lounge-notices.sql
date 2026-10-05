-- 공지 작성은 선생님만 · 라운지 작성자 이름·관리자 표시는 DB 가 정한다 — Supabase SQL Editor 에서 한 번 실행
-- 왜(2026-10-05 보안 점검 · 정책 조회 결과):
--   ① notices 의 insert 정책이 `auth.uid() IS NOT NULL` 이라 **어느 학생이나 공지를 올릴 수 있었다**(수정·삭제는 선생님만이었다).
--   ② lounge_posts·lounge_comments 의 insert 는 user_id 만 확인하고, 작성자 이름(author_name)·관리자 글 표시(is_admin_post)는
--      브라우저가 보낸 값을 그대로 저장한다 — 화면 대신 요청을 직접 만들면 남의 이름·'관리자' 배지로 글을 쓸 수 있었다.
-- 앱 영향: 정상 화면은 원래 맞는 값을 보내므로 바뀌는 것이 없다(SchoolLounge.tsx 는 full_name → 이메일 앞부분 → '학생', role=teacher 로 같은 규칙).

-- 1) 공지 작성 → 선생님만
drop policy if exists "insert_notices" on public.notices;
create policy "insert_notices"
  on public.notices for insert
  with check (current_user_is_teacher());

-- 2) 라운지 글·댓글: 저장할 때 작성자 프로필에서 이름·역할을 읽어 덮어쓴다(작성자 = 행의 user_id · 선생님이 학생 글을 고쳐도 표시는 작성자 기준)
create or replace function public.lounge_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_email text;
  v_role  text;
begin
  select full_name, email, role into v_name, v_email, v_role from profiles where id = new.user_id;
  new.author_name := coalesce(nullif(v_name, ''), nullif(split_part(coalesce(v_email, ''), '@', 1), ''), '학생');
  if tg_table_name = 'lounge_posts' then
    new.is_admin_post := coalesce(v_role = 'teacher', false);
  end if;
  return new;
end;
$$;

drop trigger if exists lounge_posts_fill_author on public.lounge_posts;
create trigger lounge_posts_fill_author
  before insert or update on public.lounge_posts
  for each row execute function public.lounge_fill_author();

drop trigger if exists lounge_comments_fill_author on public.lounge_comments;
create trigger lounge_comments_fill_author
  before insert or update on public.lounge_comments
  for each row execute function public.lounge_fill_author();

-- 3) 확인: 공지 작성 정책이 선생님 함수로 바뀌었는가 · 트리거 2개가 걸렸는가
select 'policy' as 종류, policyname as 이름, with_check as 조건 from pg_policies where tablename = 'notices' and cmd = 'INSERT'
union all
select 'trigger', tgname, tgrelid::regclass::text from pg_trigger where tgname in ('lounge_posts_fill_author', 'lounge_comments_fill_author');
