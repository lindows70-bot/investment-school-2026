/** @type {import('next').NextConfig} */
const nextConfig = {

  // 빌드 출력 폴더 — 기본 .next. 로컬 strict 빌드 검증 시 NEXT_DIST_DIR=.next-build 로 분리해
  // 실행 중인 dev 서버의 .next 를 덮어쓰지 않게 한다(흰 화면·재시작 방지). `npm run check:build` 사용.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // yahoo-finance2 를 번들링하지 않고 Node.js 런타임에서 직접 사용 (Vercel 포함)
  // Next.js 14: experimental.serverComponentsExternalPackages
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2', 'pdf-parse'],
    // recharts 배럴 임포트를 딥 패스로 자동 변환(160+ 파일 공통) — 번들·컴파일 시간 절감. 실패 시 원래 동작으로 조용히 폴백
    optimizePackageImports: ['recharts', 'lucide-react'],
  },

  // 이미지 최적화 끔 — 앱은 next/image 를 쓰지 않는데 '/_next/image' 가 열려 있었고, 허용 목록 '**.supabase.co' 는
  //   **남의 Supabase 프로젝트까지** 허용해 공격자가 올린 이미지를 우리 서버가 처리하게 만들 수 있었다
  //   (Next 14.2 의 이미지 최적화 취약점 — AVIF 원격 코드 실행 등 · 2026-10-04 보안 점검)
  images: { unoptimized: true },

  // ⛔ /api 에 'Access-Control-Allow-Origin: *' 를 두지 않는다(2026-10-04 보안 점검으로 삭제).
  //   예전 주석은 "야후·코인게코 서버사이드 fetch 용"이었지만 서버가 외부를 부를 때는 CORS 가 필요 없다.
  //   이 헤더는 **다른 사이트가 방문자 브라우저로 우리 API(AI·재계산)를 대신 부르게** 해 줄 뿐이었다.

  // 빌드 시 ESLint 경고로 배포 실패 방지 (CI에서는 별도 lint 단계 권장)
  eslint: {
    ignoreDuringBuilds: false,
  },

  // TypeScript 오류로 배포 실패 방지 (프로덕션에서는 true 비권장)
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
