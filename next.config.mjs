/** @type {import('next').NextConfig} */
const nextConfig = {
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
