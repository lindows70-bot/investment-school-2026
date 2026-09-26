// 학생 간단 모드 레이아웃 — 모든 /s 화면을 학생 셸로 감싼다
import StudentShell from '@/app/components/student/StudentShell'
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>
}
