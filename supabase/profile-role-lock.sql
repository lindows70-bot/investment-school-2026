-- 역할(role·is_admin)을 본인이 바꾸지 못하게 잠그는 SQL — Supabase SQL Editor 에서 한 번 실행
-- 왜: ① 가입 트리거가 가입 정보(raw_user_meta_data)의 role 을 그대로 믿어, 공개 키로 role:'teacher' 를 넣어 가입하면 선생님이 됐다.
--     ② '본인 프로필 수정' 정책이 컬럼 제한이 없어, 로그인한 학생이 자기 role 을 teacher 로 바꿀 수 있었다.
--     선생님 역할은 RLS 로 모든 학생의 보유·거래를 읽는다(investments·transactions 'teacher 전체 조회').
-- 앱은 가입 때 항상 role:'student' 만 보내므로(login/page.tsx) 이 잠금으로 깨지는 화면은 없다.

-- 1) 가입 트리거: 역할은 가입 정보와 무관하게 항상 student
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2) profiles 의 role·is_admin 은 서버(서비스 키)·SQL Editor 만 바꾼다
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := coalesce(auth.role(), '') = 'service_role'
                        or current_user in ('postgres', 'supabase_admin');
begin
  if privileged then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'student';
    if coalesce((to_jsonb(new)->>'is_admin')::boolean, false) then
      raise exception '관리자 권한은 스스로 정할 수 없습니다';
    end if;
  elsif new.role is distinct from old.role
     or (to_jsonb(new)->>'is_admin') is distinct from (to_jsonb(old)->>'is_admin') then
    raise exception '역할은 선생님(관리자)만 바꿀 수 있습니다';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- 3) 확인: 선생님이 1명(본인)뿐인지
select role, count(*) as 인원 from public.profiles group by role order by role;
