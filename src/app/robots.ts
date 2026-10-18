// 검색엔진 색인 차단 — 학생 개인 포트폴리오 앱이라 색인될 이유가 없다(2026-10-19 8차 점검: robots·noindex 가 어디에도 없었다)
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
