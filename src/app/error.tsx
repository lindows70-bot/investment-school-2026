'use client'
// 페이지 오류 경계(루트 레이아웃은 살아 있을 때) — ChunkLoadError 는 한 번 자동 새로고침, 그 외는 다시 시도 버튼(2026-10-18 7차 점검)
import { useEffect } from 'react'
import { TK, FS } from '@/lib/theme'
import { isChunkLoadError, reloadOnceForChunk } from '@/lib/chunkReload'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { if (isChunkLoadError(error)) reloadOnceForChunk() }, [error])
  const chunk = isChunkLoadError(error)
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, color: TK.slate100 }}>{chunk ? '새 버전으로 다시 여는 중이에요' : '이 화면을 그리다 문제가 생겼어요'}</p>
        <p style={{ margin: '12px 0 20px', fontSize: FS.body, color: TK.sub, lineHeight: 1.6 }}>
          {chunk ? '앱이 업데이트돼 이전 화면 조각을 못 받았어요. 자동으로 새로 고칩니다.' : '잠시 뒤 다시 시도해 주세요. 계속되면 선생님께 알려 주세요.'}
        </p>
        <button onClick={() => (chunk ? window.location.reload() : reset())}
          style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: `1px solid ${TK.border}`, background: TK.bg3, color: TK.slate100, fontSize: FS.body, fontWeight: 700, cursor: 'pointer' }}>
          {chunk ? '지금 새로 고치기' : '다시 시도'}
        </button>
      </div>
    </div>
  )
}
