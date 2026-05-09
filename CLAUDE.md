# 2026 투자학교 포트폴리오 앱

## 프로젝트 개요
Next.js 14 (App Router) + Supabase + Tailwind CSS + TypeScript + Recharts로 구축한 투자학교 포트폴리오 관리 웹앱.

## 기술 스택
- **프레임워크**: Next.js 14 (App Router, Server Components)
- **DB / Auth**: Supabase (PostgreSQL + Row Level Security)
- **스타일링**: Tailwind CSS (다크 모드 기본, custom design system)
- **차트**: Recharts
- **아이콘**: lucide-react
- **유틸**: tailwind-merge, clsx, date-fns

## 디렉토리 구조
```
src/
├── app/
│   ├── (auth)/          # 로그인 · 회원가입 (공개)
│   ├── (dashboard)/     # 포트폴리오 · 관리자 (인증 필요)
│   └── layout.tsx
├── components/
│   ├── ui/              # 공통 UI (Navbar, Button, Badge 등)
│   └── portfolio/       # 도메인 컴포넌트
├── lib/supabase/        # client.ts / server.ts
├── types/index.ts       # 공통 타입
└── middleware.ts        # 라우트 보호
```

## 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL=https://jfqhriwgnlopxewdocpr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```
`.env.local`에 설정 (절대 커밋 금지).

## Supabase 스키마
`supabase-schema.sql` 참조. Supabase Dashboard → SQL Editor에서 실행.

### 테이블
| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (auth.users 확장, is_admin 포함) |
| `holdings` | 보유 종목 (주식·코인, 피터 린치 분류) |

### 관리자 지정
```sql
update public.profiles set is_admin = true where email = 'admin@example.com';
```

## 피터 린치 6대 분류
| 영문 키 | 한국어 |
|---------|--------|
| `slow_grower` | 완만한 성장주 |
| `stalwart` | 대형 우량주 |
| `fast_grower` | 빠른 성장주 |
| `cyclical` | 경기 순환주 |
| `turnaround` | 회생 기업주 |
| `asset_play` | 자산 보유주 |

## 개발 명령어
```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 체크
```

## 코딩 컨벤션
- 서버 컴포넌트 우선, 클라이언트 상태가 필요한 경우만 `'use client'`
- Tailwind 클래스는 `tailwind-merge` (twMerge) 사용
- `any` 타입 사용 시 `eslint-disable` 주석 필요
- 컴포넌트 파일은 PascalCase, 유틸은 camelCase
- Supabase 쿼리는 항상 에러 핸들링 포함

## 주요 라우트
| 경로 | 설명 | 인증 |
|------|------|------|
| `/` | → `/portfolio` 리다이렉트 | - |
| `/login` | 이메일 로그인 | 공개 |
| `/signup` | 회원가입 | 공개 |
| `/portfolio` | 내 포트폴리오 대시보드 | 필요 |
| `/admin` | 전체 학생 현황 | 관리자만 |
