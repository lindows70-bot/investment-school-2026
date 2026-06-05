/**
 * src/lib/appCache.ts — 영구 캐시(Supabase app_cache 테이블) · 서버 전용
 *
 * 인메모리 캐시는 ① 서버리스 인스턴스 재시작 시 소실 ② 여러 인스턴스 간 미공유 →
 * 무거운 수집(13F 크롤·DART 5%룰 크롤)이 인스턴스마다 중복 실행되는 문제.
 * → DB(app_cache)에 결과를 영구 저장해 '전 인스턴스 공유 + 콜드스타트 생존'.
 *
 * 설계: 모두 graceful — 테이블 미생성/크레덴셜 없음이면 조용히 null/no-op → 기존 인메모리로 폴백(무중단).
 *
 * 사용 테이블 (Supabase SQL — 1회 실행):
 *   create table if not exists app_cache (
 *     key text primary key,
 *     payload jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 */

import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** 캐시 조회 — maxAgeMs 이내 신선하면 payload, 아니면 null (테이블 없어도 null) */
export async function getCache<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const db = admin()
    if (!db) return null
    const { data } = await db.from('app_cache').select('payload, updated_at').eq('key', key).maybeSingle()
    if (!data) return null
    if (Date.now() - new Date(data.updated_at as string).getTime() > maxAgeMs) return null
    return data.payload as T
  } catch { return null }
}

/** 캐시 저장 (upsert) — 실패(테이블 미존재 등)는 조용히 무시 */
export async function setCache(key: string, payload: unknown): Promise<void> {
  try {
    const db = admin()
    if (!db) return
    await db.from('app_cache').upsert({ key, payload, updated_at: new Date().toISOString() })
  } catch { /* graceful */ }
}

/**
 * 특정 사용자 캐시 무효화 — 매수/매도로 보유종목이 바뀌면 호출.
 * user.id를 키에 포함한 '조립 결과' 캐시(ai-rebalance, corr-matrix 등)만 삭제하고,
 * 티커 단위 공유 캐시(jarvis-metrics:ticker 등)는 건드리지 않는다(다른 사용자도 쓰므로).
 * 반환값은 삭제된 행 수. 실패는 조용히 0.
 */
export async function bustUserCache(userId: string): Promise<number> {
  try {
    const db = admin()
    if (!db || !userId) return 0
    const { data } = await db.from('app_cache').delete().like('key', `%${userId}%`).select('key')
    return data?.length ?? 0
  } catch { return 0 }
}
