/** @type {import('next').NextConfig} */
const nextConfig = {
  // ★ 핵심: dev와 build가 서로 다른 폴더 사용 → 캐시 충돌 영구 차단
  //   dev   → .next/       (기본값)
  //   build → .next-build/ (Vercel은 이 폴더 자동 감지)
  distDir: process.env.NEXT_BUILD_DIR ?? '.next',

  // yahoo-finance2 를 번들링하지 않고 Node.js 런타임에서 직접 사용 (Vercel 포함)
  // Next.js 14: experimental.serverComponentsExternalPackages
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2'],
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
