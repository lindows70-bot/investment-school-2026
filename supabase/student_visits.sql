-- 학생 접속 기록 — 사용자당 하루 1행(학생 간단 모드 효과 측정의 기준선)
create table if not exists public.student_visits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  visit_date date not null,
  first_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, visit_date)
);
alter table public.student_visits enable row level security;
create policy "student_visits insert own" on public.student_visits for insert with check (auth.uid() = user_id);
create policy "student_visits read own"   on public.student_visits for select using (auth.uid() = user_id);
