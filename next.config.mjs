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

  // 외부 이미지 허용 도메인 (필요 시 추가)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },

  // Yahoo Finance / CoinGecko 서버사이드 fetch 시 CORS 헤더 추가
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },

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
