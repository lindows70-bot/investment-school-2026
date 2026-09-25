// 학생 홈 자리 — 2단계(홈 카드들)가 들어오기 전까지 내 자산으로 보낸다
import { redirect } from 'next/navigation'
export default function StudentHome() { redirect('/s/assets') }
