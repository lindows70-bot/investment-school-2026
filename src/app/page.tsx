import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/start') // 착지는 /start 한 곳에서(역할·화면 모드 쿠키)
}
